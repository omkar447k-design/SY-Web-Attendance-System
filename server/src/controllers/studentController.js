import { db } from '../config/db.js';
import { PinService } from '../services/pinService.js';
import { DeviceService } from '../services/deviceService.js';

export class StudentController {
  static login(req, res) {
    const { rollNo, prn, name, idCardPhoto, department = 'comp', division = 'SY-A', deviceId, fingerprint } = req.body;
    
    if (!idCardPhoto || typeof idCardPhoto !== 'string' || idCardPhoto.length < 100) {
      return res.status(400).json({
        success: false,
        error: '🛑 Mandatory ID Card: Please upload a clear photo of your physical college ID card.'
      });
    }

    if (!rollNo || Number(rollNo) <= 0) {
      return res.status(400).json({ success: false, error: '🛑 Mandatory Field: Valid Roll Number is required.' });
    }

    if (!prn || !String(prn).trim() || String(prn).trim().length < 4) {
      return res.status(400).json({ success: false, error: '🛑 Mandatory Field: Valid PRN / Student ID is required.' });
    }

    if (!name || !name.trim() || name.trim().length < 3) {
      return res.status(400).json({ success: false, error: '🛑 Mandatory Field: Verified Student Name is required from ID card.' });
    }

    if (!department) {
      return res.status(400).json({ success: false, error: '🛑 Mandatory Field: Engineering Department is required.' });
    }

    if (!division) {
      return res.status(400).json({ success: false, error: '🛑 Mandatory Field: Division (SY-A/B/C) is required.' });
    }

    const students = db.get('students');
    const numericRoll = Number(rollNo);
    const cleanPrn = String(prn).trim().toUpperCase();
    const resolvedName = name.trim();

    const duplicatePrn = students.find(
      s => s.prn === cleanPrn && !(s.rollNo === numericRoll && s.division === division && (s.department === department || !s.department))
    );
    if (duplicatePrn) {
      return res.status(403).json({
        success: false,
        error: `🛑 Duplicate PRN Blocked: PRN ${cleanPrn} is already registered to Roll No. ${duplicatePrn.rollNo} (${duplicatePrn.name}) in ${duplicatePrn.department?.toUpperCase()} - ${duplicatePrn.division}.`
      });
    }

    let student = students.find(
      s => s.rollNo === numericRoll && s.division === division && (s.department === department || !s.department)
    );

    if (student && student.boundDeviceId) {
      if (student.boundDeviceId !== deviceId || student.boundFingerprint !== fingerprint) {
        return res.status(403).json({
          success: false,
          error: `🛑 Account Already Bound: Roll No. ${student.rollNo} (${student.name}) is already registered and locked to another smartphone. To switch phones, contact your HOD.`
        });
      }

      db.addLog({
        type: 'STUDENT_LOGIN',
        studentId: student.id,
        studentName: student.name,
        rollNo: student.rollNo,
        prn: student.prn,
        department: student.department || department,
        division: student.division,
        batch: student.batch,
        idCardPhoto: student.idCardPhoto,
        deviceId: deviceId,
        status: 'AUTHORIZED_RETURNING_STUDENT',
        details: 'Returning student verified on locked phone'
      });

      return res.json({
        success: true,
        student: {
          id: student.id,
          rollNo: student.rollNo,
          name: student.name,
          department: student.department || department,
          division: student.division,
          batch: student.batch,
          prn: student.prn,
          idCardPhoto: student.idCardPhoto,
          boundDeviceId: student.boundDeviceId,
          boundAt: student.boundAt
        },
        token: `std_tok_${student.id}_${Date.now()}`
      });
    }

    if (!student) {
      student = {
        id: `S_${department}_${division}_${numericRoll}`,
        rollNo: numericRoll,
        prn: cleanPrn,
        name: resolvedName,
        idCardPhoto: idCardPhoto,
        department,
        division,
        batch: numericRoll <= 20 ? 'B1' : numericRoll <= 40 ? 'B2' : 'B3',
        boundDeviceId: null,
        boundFingerprint: null,
        boundAt: null,
        registeredAt: new Date().toISOString()
      };
      students.push(student);
      db.set('students', students);
    } else {
      student.name = resolvedName;
      student.prn = cleanPrn;
      student.idCardPhoto = idCardPhoto;
      db.set('students', students);
    }

    const bindResult = DeviceService.verifyOrBindDevice(student.id, student.rollNo, deviceId, fingerprint, student.name);
    if (!bindResult.success) {
      return res.status(403).json(bindResult);
    }

    db.addLog({
      type: 'NEW_STUDENT_REGISTRATION',
      studentId: student.id,
      studentName: student.name,
      rollNo: student.rollNo,
      prn: student.prn,
      department: student.department || department,
      division: student.division,
      batch: student.batch,
      idCardPhoto: student.idCardPhoto,
      deviceId: deviceId,
      status: 'VERIFIED_PHYSICAL_ID_OCR',
      details: 'New student bound phone via verified ID Card'
    });

    res.json({
      success: true,
      student: {
        ...bindResult.student,
        name: student.name,
        department: student.department || department,
        prn: student.prn,
        idCardPhoto: student.idCardPhoto,
        batch: student.batch,
        boundAt: student.boundAt
      },
      token: `std_tok_${student.id}_${Date.now()}`
    });
  }

  static getActiveSession(req, res) {
    const { division = 'SY-A', department = 'comp', studentId } = req.query;
    const sessions = db.get('sessions');
    
    const active = sessions.find(s => {
      if (s.status !== 'active') return false;
      if (s.department && s.department !== department) return false;
      const sessionDivs = s.divisions || [s.division];
      return sessionDivs.includes(division) || s.division.includes(division);
    });

    if (!active) {
      return res.json({ success: true, hasActiveSession: false });
    }

    const now = new Date();
    const endTime = new Date(active.endTime);
    if (now > endTime) {
      active.status = 'closed';
      db.set('sessions', sessions);
      return res.json({ success: true, hasActiveSession: false });
    }

    const attendance = db.get('attendance');
    const alreadyMarked = studentId
      ? attendance.some(a => a.sessionId === active.id && a.studentId === studentId)
      : false;

    const remainingSec = Math.max(0, Math.ceil((endTime.getTime() - now.getTime()) / 1000));

    res.json({
      success: true,
      hasActiveSession: true,
      session: {
        id: active.id,
        subjectName: active.subjectName,
        teacherName: active.teacherName,
        department: active.department,
        division: active.division,
        divisions: active.divisions || [active.division],
        batch: active.batch,
        remainingSec,
        alreadyMarked
      }
    });
  }

  static submitPin(req, res) {
    const { studentId, rollNo, sessionId, pin, deviceId, fingerprint } = req.body;

    if (!studentId || !sessionId || !pin) {
      return res.status(400).json({ success: false, error: 'Student ID, Session ID, and PIN are required' });
    }

    const sessions = db.get('sessions');
    const session = sessions.find(s => s.id === sessionId && s.status === 'active');
    if (!session) {
      return res.status(400).json({ success: false, error: 'This attendance session has ended or is not active.' });
    }

    const now = new Date();
    if (now > new Date(session.endTime)) {
      session.status = 'closed';
      db.set('sessions', sessions);
      return res.status(400).json({ success: false, error: 'Attendance window has closed for this lecture.' });
    }

    const students = db.get('students');
    const student = students.find(s => s.id === studentId || s.rollNo === Number(rollNo));
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student record not found in roster' });
    }

    const sessionDivs = session.divisions || [session.division];
    if (!sessionDivs.includes(student.division) && !session.division.includes(student.division)) {
      return res.status(403).json({
        success: false,
        error: `This lecture is only open for Division(s): ${sessionDivs.join(', ')}. Your division is ${student.division}.`
      });
    }

    const lockCheck = DeviceService.checkInSessionLock(sessionId, deviceId, student.rollNo);
    if (!lockCheck.allowed) {
      return res.status(403).json({ success: false, error: lockCheck.error });
    }

    const pinCheck = PinService.validatePin(sessionId, pin);
    if (!pinCheck.valid) {
      return res.status(400).json({ success: false, error: pinCheck.reason });
    }

    const attendance = db.get('attendance');
    const existing = attendance.find(a => a.sessionId === sessionId && a.studentId === student.id);
    if (existing) {
      return res.json({
        success: true,
        alreadyMarked: true,
        message: 'You are already marked Present for this lecture.',
        record: existing
      });
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
      timestamp: now.toISOString(),
      status: 'Present',
      verifiedVia: '4-Digit PIN'
    };

    attendance.push(record);
    db.set('attendance', attendance);

    session.totalPresent = (session.totalPresent || 0) + 1;
    db.set('sessions', sessions);

    DeviceService.recordSessionSubmission(sessionId, deviceId, student.rollNo);

    res.json({
      success: true,
      message: '✅ Attendance recorded successfully!',
      record
    });
  }

  static getDashboard(req, res) {
    const { studentId } = req.params;
    const students = db.get('students');
    const student = students.find(s => s.id === studentId || s.rollNo === Number(studentId));

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    const sessions = db.get('sessions').filter(s => {
      const sessionDivs = s.divisions || [s.division];
      return sessionDivs.includes(student.division) || s.division.includes(student.division);
    });
    const attendance = db.get('attendance').filter(a => a.studentId === student.id);
    const subjects = db.get('subjects').filter(
      s => (!s.department || s.department === student.department)
    );

    const totalLectures = sessions.length;
    const attendedLectures = attendance.length;
    const overallPercentage = totalLectures > 0
      ? Number(((attendedLectures / totalLectures) * 100).toFixed(1))
      : 100.0;

    let lecturesNeededFor75 = 0;
    if (overallPercentage < 75.0 && totalLectures > 0) {
      lecturesNeededFor75 = Math.max(0, Math.ceil((0.75 * totalLectures - attendedLectures) / 0.25));
    }

    const subjectStats = subjects.map(sub => {
      const subSessions = sessions.filter(s => s.subjectId === sub.id || s.subjectName === sub.name);
      const subAttended = attendance.filter(a => a.subjectId === sub.id || a.subjectName === sub.name);
      const pct = subSessions.length > 0
        ? Number(((subAttended.length / subSessions.length) * 100).toFixed(1))
        : 100.0;

      return {
        id: sub.id,
        name: sub.name,
        code: sub.code,
        type: sub.type,
        total: subSessions.length,
        attended: subAttended.length,
        percentage: pct,
        isSafe: pct >= 75.0
      };
    });

    const history = attendance
      .slice(-10)
      .reverse()
      .map(a => ({
        id: a.id,
        subjectName: a.subjectName,
        timestamp: a.timestamp,
        status: a.status,
        verifiedVia: a.verifiedVia
      }));

    res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          rollNo: student.rollNo,
          prn: student.prn,
          name: student.name,
          idCardPhoto: student.idCardPhoto,
          department: student.department,
          division: student.division,
          batch: student.batch,
          boundDeviceId: student.boundDeviceId,
          boundAt: student.boundAt
        },
        stats: {
          overallPercentage,
          totalLectures,
          attendedLectures,
          isDefaulter: overallPercentage < 75.0,
          lecturesNeededFor75
        },
        subjectStats,
        recentHistory: history
      }
    });
  }
}
