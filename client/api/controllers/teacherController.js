import { db } from '../config/db.js';
import { PinService } from '../services/pinService.js';
import { ExcelService } from '../services/excelService.js';

export class TeacherController {
  static getActiveSession(req, res) {
    const { teacherId } = req.query;
    const sessions = db.get('sessions');
    const active = sessions.find(s => s.status === 'active' && (!teacherId || s.teacherId === teacherId));

    if (!active) {
      return res.json({ success: true, active: false });
    }

    const now = new Date();
    const endTime = new Date(active.endTime);
    if (now > endTime) {
      active.status = 'closed';
      db.set('sessions', sessions);
      return res.json({ success: true, active: false, message: 'Session auto-closed (time expired)' });
    }

    const pinInfo = PinService.getCurrentPinInfo(active.id);
    const attendance = db.get('attendance').filter(a => a.sessionId === active.id);
    
    // Calculate total students across all selected divisions
    const sessionDivisions = active.divisions || [active.division];
    const totalStudents = db.get('students').filter(
      s => (!active.department || s.department === active.department) && sessionDivisions.includes(s.division)
    ).length;

    const remainingSessionMs = Math.max(0, endTime.getTime() - now.getTime());
    const remainingSessionSec = Math.ceil(remainingSessionMs / 1000);

    res.json({
      success: true,
      active: true,
      session: {
        ...active,
        divisions: sessionDivisions,
        remainingSessionSec,
        pinInfo,
        totalPresent: attendance.length,
        totalStudents,
        attendees: attendance
      }
    });
  }

  static startSession(req, res) {
    const {
      teacherId,
      teacherName,
      subjectId,
      subjectName,
      department = 'comp',
      divisions = ['SY-A'],
      division = 'SY-A',
      batch = 'All',
      durationMinutes = 3
    } = req.body;

    const effectiveDivisions = Array.isArray(divisions) && divisions.length > 0 ? divisions : [division];
    const effectiveSubjectName = subjectName || 'Class Lecture';

    const sessions = db.get('sessions');
    // Close any previous active sessions for this teacher
    sessions.forEach(s => {
      if (s.teacherId === teacherId && s.status === 'active') {
        s.status = 'closed';
      }
    });

    const startTime = new Date();
    const settings = db.getSettings();
    const effectiveDuration = Math.min(Number(durationMinutes) || settings.defaultDurationMinutes, settings.maxDurationMinutes);
    const endTime = new Date(startTime.getTime() + effectiveDuration * 60 * 1000);
    const sessionId = `SESS_${Date.now()}`;

    const newSession = {
      id: sessionId,
      teacherId: teacherId || `T_${department}_${Date.now()}`,
      teacherName: teacherName || 'Faculty In-Charge',
      subjectId: subjectId || `SUB_${Date.now()}`,
      subjectName: effectiveSubjectName,
      department,
      divisions: effectiveDivisions,
      division: effectiveDivisions.join(', '),
      batch,
      date: startTime.toISOString().split('T')[0],
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMinutes: effectiveDuration,
      status: 'active',
      totalPresent: 0
    };

    sessions.push(newSession);
    db.set('sessions', sessions);

    const pinInfo = PinService.getCurrentPinInfo(sessionId);
    const totalStudents = db.get('students').filter(
      s => (!department || s.department === department) && effectiveDivisions.includes(s.division)
    ).length;

    res.json({
      success: true,
      session: {
        ...newSession,
        remainingSessionSec: effectiveDuration * 60,
        pinInfo,
        totalPresent: 0,
        totalStudents,
        attendees: []
      }
    });
  }

  static extendSession(req, res) {
    const { sessionId, extraMinutes = 1 } = req.body;
    const sessions = db.get('sessions');
    const session = sessions.find(s => s.id === sessionId && s.status === 'active');

    if (!session) {
      return res.status(404).json({ success: false, error: 'Active session not found' });
    }

    const currentEnd = new Date(session.endTime);
    const newEnd = new Date(currentEnd.getTime() + Number(extraMinutes) * 60 * 1000);
    session.endTime = newEnd.toISOString();
    session.durationMinutes += Number(extraMinutes);

    db.set('sessions', sessions);

    const remainingSessionSec = Math.max(0, Math.ceil((newEnd.getTime() - Date.now()) / 1000));
    res.json({ success: true, remainingSessionSec, session });
  }

  static endSession(req, res) {
    const { sessionId } = req.body;
    const sessions = db.get('sessions');
    const session = sessions.find(s => s.id === sessionId);

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    session.status = 'closed';
    session.endTime = new Date().toISOString();
    db.set('sessions', sessions);

    const attendance = db.get('attendance').filter(a => a.sessionId === sessionId);
    session.totalPresent = attendance.length;
    db.set('sessions', sessions);

    res.json({ success: true, message: 'Session closed successfully', totalPresent: attendance.length });
  }

  static manualMark(req, res) {
    const { sessionId, studentId, rollNo } = req.body;
    const sessions = db.get('sessions');
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });

    const students = db.get('students');
    const student = students.find(
      s => s.id === studentId || s.rollNo === Number(rollNo || studentId)
    );
    if (!student) return res.status(404).json({ success: false, error: 'Student record not found in roster' });

    const attendance = db.get('attendance');
    const alreadyMarked = attendance.find(a => a.sessionId === sessionId && a.studentId === student.id);
    if (alreadyMarked) {
      return res.json({ success: true, message: 'Student is already marked present' });
    }

    const record = {
      id: `ATT_${sessionId}_${student.id}`,
      sessionId,
      studentId: student.id,
      rollNo: student.rollNo,
      studentName: student.name,
      department: student.department || session.department,
      division: student.division,
      batch: student.batch,
      subjectId: session.subjectId,
      subjectName: session.subjectName,
      timestamp: new Date().toISOString(),
      status: 'Present',
      verifiedVia: 'Manual Override'
    };

    attendance.push(record);
    db.set('attendance', attendance);

    session.totalPresent = (session.totalPresent || 0) + 1;
    db.set('sessions', sessions);

    res.json({ success: true, data: record });
  }

  static exportSessionExcel(req, res) {
    const { sessionId } = req.params;
    const sessions = db.get('sessions');
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });

    const attendance = db.get('attendance').filter(a => a.sessionId === sessionId);
    const buffer = ExcelService.generateSessionExcel(session, attendance);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Attendance_${session.subjectName.replace(/\s+/g, '_')}_${session.date}.xlsx`);
    res.send(buffer);
  }
}
