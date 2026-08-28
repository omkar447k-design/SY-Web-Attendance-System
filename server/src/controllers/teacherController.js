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
      return res.json({ success: true, active: false });
    }

    const pinInfo = PinService.getCurrentPinInfo(active.id);
    const attendance = db.get('attendance').filter(a => a.sessionId === active.id);
    const sessionDivisions = active.divisions || [active.division];
    const totalStudents = db.get('students').filter(
      s => (!active.department || s.department === active.department) && sessionDivisions.includes(s.division)
    ).length;
    const remainingSessionSec = Math.max(0, Math.ceil((endTime.getTime() - now.getTime()) / 1000));

    res.json({
      success: true,
      active: true,
      session: {
        ...active,
        pinInfo,
        remainingSessionSec,
        totalPresent: attendance.length,
        totalStudents,
        attendees: attendance
      }
    });
  }

  static startSession(req, res) {
    const {
      teacherId,
      teacherName = 'Faculty Member',
      subjectName,
      department = 'comp',
      divisions = ['SY-A'],
      batch = 'All',
      durationMinutes = 3
    } = req.body;

    if (!subjectName) {
      return res.status(400).json({ success: false, error: 'Subject is required' });
    }

    const selectedDivs = Array.isArray(divisions) && divisions.length > 0 ? divisions : ['SY-A'];
    const divisionLabel = selectedDivs.join(' + ');

    const sessions = db.get('sessions');
    sessions.forEach(s => {
      if (s.teacherId === teacherId && s.status === 'active') {
        s.status = 'closed';
      }
    });

    const now = new Date();
    const duration = Math.min(Math.max(Number(durationMinutes) || 3, 1), 15);
    const endTime = new Date(now.getTime() + duration * 60 * 1000);

    const newSession = {
      id: `SESS_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      teacherId,
      teacherName,
      subjectId: `SUB_${Date.now()}`,
      subjectName,
      department,
      division: divisionLabel,
      divisions: selectedDivs,
      batch,
      startTime: now.toISOString(),
      endTime: endTime.toISOString(),
      durationMinutes: duration,
      status: 'active',
      totalPresent: 0
    };

    sessions.push(newSession);
    db.set('sessions', sessions);

    db.addLog({
      type: 'FACULTY_LECTURE_START',
      teacherId,
      teacherName,
      department,
      subjectName,
      division: divisionLabel,
      divisions: selectedDivs,
      batch,
      durationMinutes: duration,
      status: 'LECTURE_SESSION_ACTIVE',
      details: `Faculty ${teacherName} started lecture for ${divisionLabel}`
    });

    const pinInfo = PinService.getCurrentPinInfo(newSession.id);
    const totalStudents = db.get('students').filter(
      s => (!department || s.department === department) && selectedDivs.includes(s.division)
    ).length;

    res.json({
      success: true,
      session: {
        ...newSession,
        pinInfo,
        remainingSessionSec: duration * 60,
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
    session.durationMinutes = (session.durationMinutes || 0) + Number(extraMinutes);
    db.set('sessions', sessions);

    const now = new Date();
    const remainingSessionSec = Math.max(0, Math.ceil((newEnd.getTime() - now.getTime()) / 1000));

    res.json({
      success: true,
      message: `Session extended by ${extraMinutes} minute(s)`,
      remainingSessionSec,
      session
    });
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

    const attendance = db.get('attendance').filter(a => a.sessionId === session.id);
    db.addLog({
      type: 'FACULTY_LECTURE_END',
      teacherId: session.teacherId,
      teacherName: session.teacherName,
      department: session.department,
      subjectName: session.subjectName,
      division: session.division,
      totalPresent: attendance.length,
      status: 'LECTURE_CLOSED',
      details: `Lecture concluded with ${attendance.length} verified present students`
    });

    res.json({
      success: true,
      message: 'Session locked and attendance concluded',
      session
    });
  }

  static manualMark(req, res) {
    const { sessionId, rollNo, studentId } = req.body;
    const sessions = db.get('sessions');
    const session = sessions.find(s => s.id === sessionId && s.status === 'active');

    if (!session) {
      return res.status(404).json({ success: false, error: 'Active session not found' });
    }

    const students = db.get('students');
    const student = students.find(s => s.id === studentId || s.rollNo === Number(rollNo));

    if (!student) {
      return res.status(404).json({ success: false, error: `Student with Roll No ${rollNo} not found` });
    }

    const attendance = db.get('attendance');
    const existing = attendance.find(a => a.sessionId === sessionId && a.studentId === student.id);
    if (existing) {
      return res.json({ success: true, message: 'Student already marked present', record: existing });
    }

    const record = {
      id: `ATT_${sessionId}_${student.id}`,
      sessionId: session.id,
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
      verifiedVia: 'Teacher Manual Override'
    };

    attendance.push(record);
    db.set('attendance', attendance);

    session.totalPresent = (session.totalPresent || 0) + 1;
    db.set('sessions', sessions);

    res.json({
      success: true,
      message: `Marked Roll No ${student.rollNo} as Present`,
      record
    });
  }

  static exportSessionExcel(req, res) {
    const { sessionId } = req.params;
    const buffer = ExcelService.generateSessionReport(sessionId);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Lecture_Attendance_${sessionId}.xlsx`);
    res.send(buffer);
  }
}
