import { db } from '../config/db.js';
import { generateRotatingPin, verifyPin } from '../services/pinGenerator.js';
import { ExcelService } from '../services/excelService.js';

export class TeacherController {
  static checkStatus(req, res) {
    const { teacherName, department } = req.body;
    if (!teacherName) {
      return res.status(400).json({ success: false, error: 'Teacher name is required' });
    }

    const teachers = db.get('teachers');
    const teacher = teachers.find(t => t.name?.toLowerCase() === teacherName.trim().toLowerCase());

    if (!teacher || !teacher.password) {
      return res.json({
        success: true,
        isFirstTime: true,
        message: 'First-time login setup'
      });
    }

    return res.json({
      success: true,
      isFirstTime: false,
      teacher: {
        id: teacher.id,
        name: teacher.name,
        department: teacher.department,
        subjectName: teacher.subjectName
      }
    });
  }

  static auth(req, res) {
    const { teacherName, department, subjectName, password, newPassword, isFirstTimeSetup } = req.body;

    if (!teacherName) {
      return res.status(400).json({ success: false, error: 'Faculty name is required' });
    }

    const teachers = db.get('teachers');
    let teacher = teachers.find(t => t.name?.toLowerCase() === teacherName.trim().toLowerCase());

    if (isFirstTimeSetup) {
      if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({ success: false, error: 'Password must be at least 4 characters long' });
      }

      if (teacher) {
        teacher.password = newPassword;
        teacher.department = department || teacher.department;
        teacher.subjectName = subjectName || teacher.subjectName;
      } else {
        teacher = {
          id: `T_${department || 'entc'}_${Date.now()}`,
          name: teacherName.trim(),
          email: `${teacherName.trim().toLowerCase().replace(/\s+/g, '.')}@college.edu`,
          department: department || 'entc',
          subjectName: subjectName || 'Subject',
          password: newPassword,
          role: 'Teacher',
          createdAt: new Date().toISOString()
        };
        teachers.push(teacher);
      }

      db.set('teachers', teachers);

      return res.json({
        success: true,
        message: 'Password set successfully! Logging in...',
        teacher: {
          id: teacher.id,
          name: teacher.name,
          department: teacher.department,
          subjectName: teacher.subjectName
        }
      });
    }

    if (!teacher || !teacher.password) {
      return res.json({
        success: true,
        isFirstTime: true,
        message: 'Please set your password first'
      });
    }

    if (teacher.password !== password) {
      return res.status(401).json({ success: false, error: 'Invalid password. Please try again.' });
    }

    if (subjectName) teacher.subjectName = subjectName;
    if (department) teacher.department = department;
    db.set('teachers', teachers);

    return res.json({
      success: true,
      message: 'Authentication successful',
      teacher: {
        id: teacher.id,
        name: teacher.name,
        department: teacher.department,
        subjectName: teacher.subjectName
      }
    });
  }

  static getActiveSession(req, res) {
    const { teacherId } = req.query;
    const sessions = db.get('sessions');
    const active = sessions.find(s => s.status === 'active' && (!teacherId || s.teacherId === teacherId));

    if (!active) {
      return res.json({ success: true, active: false, message: 'No active session' });
    }

    const pinInfo = generateRotatingPin(active.id);
    const now = new Date();
    const endTime = new Date(active.endTime);
    const remainingSessionSec = Math.max(0, Math.ceil((endTime.getTime() - now.getTime()) / 1000));

    if (remainingSessionSec <= 0) {
      active.status = 'closed';
      db.set('sessions', sessions);
      return res.json({ success: true, active: false, message: 'Session expired' });
    }

    const attendance = db.get('attendance').filter(a => a.sessionId === active.id);
    const selectedDivs = active.divisions || [active.division || 'SY-A'];
    const registeredCount = db.get('students').filter(
      s => (!active.department || s.department === active.department) && selectedDivs.includes(s.division)
    ).length;
    const totalStudents = Math.max(registeredCount, 80 * selectedDivs.length);

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
    const { teacherId, teacherName, subjectName, department, divisions, division, batch = 'All', durationMinutes = 3 } = req.body;

    if (!subjectName) {
      return res.status(400).json({ success: false, error: 'Subject name is required' });
    }

    const selectedDivs = divisions && divisions.length > 0 ? divisions : [division || 'SY-A'];
    const duration = Number(durationMinutes) || 3;
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    const sessions = db.get('sessions');
    sessions.forEach(s => {
      if (s.teacherId === teacherId && s.status === 'active') {
        s.status = 'closed';
      }
    });

    const newSession = {
      id: `SESS_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      subjectId: `SUB_${Date.now()}`,
      subjectName: subjectName.trim(),
      teacherId: teacherId || 'T_DEFAULT',
      teacherName: teacherName || 'Faculty Member',
      department: department || 'entc',
      division: selectedDivs.join(', '),
      divisions: selectedDivs,
      batch,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMinutes: duration,
      status: 'active',
      date: startTime.toISOString().split('T')[0]
    };

    sessions.push(newSession);
    db.set('sessions', sessions);

    db.addLog({
      type: 'FACULTY_LECTURE_START',
      teacherId: newSession.teacherId,
      teacherName: newSession.teacherName,
      department: newSession.department,
      subjectName: newSession.subjectName,
      division: newSession.division,
      batch: newSession.batch,
      sessionId: newSession.id,
      status: 'ATTENDANCE_ACTIVE'
    });

    const pinInfo = generateRotatingPin(newSession.id);
    const registeredCount = db.get('students').filter(
      s => (!department || s.department === department) && selectedDivs.includes(s.division)
    ).length;
    const totalStudents = Math.max(registeredCount, 80 * selectedDivs.length);

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
      return res.json({ success: true, message: 'Session extended' });
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
    const sessions = db.get('sessions') || [];
    let session = sessions.find(s => s.id === sessionId);

    if (session) {
      session.status = 'closed';
      session.endTime = new Date().toISOString();
      db.set('sessions', sessions);
    } else {
      session = { id: sessionId, status: 'closed', endTime: new Date().toISOString() };
    }

    const attendance = (db.get('attendance') || []).filter(a => a.sessionId === sessionId);
    db.addLog({
      type: 'FACULTY_LECTURE_END',
      teacherId: session?.teacherId || 'T_FACULTY',
      teacherName: session?.teacherName || 'Faculty Member',
      department: session?.department || 'entc',
      subjectName: session?.subjectName || 'Lecture',
      division: session?.division || 'SY-A',
      totalPresent: attendance.length,
      status: 'LECTURE_CLOSED',
      details: `Lecture concluded with ${attendance.length} verified present students`
    });

    return res.json({
      success: true,
      message: 'Session locked and attendance concluded',
      session
    });
  }

  static manualMark(req, res) {
    const { sessionId, rollNo, studentId } = req.body;
    const sessions = db.get('sessions');
    const session = sessions.find(s => s.id === sessionId && s.status === 'active');

    const students = db.get('students') || [];
    const student = students.find(s => s.id === studentId || s.rollNo === Number(rollNo)) || {
      id: studentId || `S_MANUAL_${rollNo}`,
      name: `Student #${rollNo}`,
      rollNo: Number(rollNo),
      division: session?.division || 'SY-A'
    };

    const attendance = db.get('attendance') || [];
    const existing = attendance.find(a => a.sessionId === sessionId && (a.studentId === student.id || a.rollNo === student.rollNo));
    if (existing) {
      return res.json({ success: true, message: 'Student already marked present', record: existing });
    }

    const record = {
      id: `ATT_${sessionId}_${student.id}`,
      sessionId: sessionId,
      studentId: student.id,
      rollNo: student.rollNo,
      studentName: student.name,
      department: student.department || session?.department || 'entc',
      division: student.division,
      batch: student.batch || 'All',
      subjectId: session?.subjectId || 'SUB',
      subjectName: session?.subjectName || 'Lecture',
      timestamp: new Date().toISOString(),
      status: 'Present',
      verifiedVia: 'Teacher Manual Override'
    };

    attendance.push(record);
    db.set('attendance', attendance);

    if (session) {
      session.totalPresent = (session.totalPresent || 0) + 1;
      db.set('sessions', sessions);
    }

    res.json({
      success: true,
      message: `Marked Roll No ${student.rollNo} as Present`,
      record
    });
  }

  static exportSessionExcel(req, res) {
    try {
      const { sessionId } = req.params;
      const sessions = db.get('sessions') || [];
      const session = sessions.find(s => s.id === sessionId) || {
        id: sessionId,
        subjectName: 'Lecture',
        division: 'SY-A',
        batch: 'All',
        date: new Date().toISOString().split('T')[0]
      };

      const attendance = db.get('attendance') || [];
      const records = attendance.filter(a => a.sessionId === sessionId);
      const buffer = ExcelService.generateSessionExcel(session, records);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Lecture_Attendance_${sessionId}.xlsx`);
      res.send(buffer);
    } catch (err) {
      console.error('Export session error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
