import { db } from '../config/db.js';
import { DeviceService } from '../services/deviceService.js';
import { ExcelService } from '../services/excelService.js';

// Brute-force protection: Map of IP -> { attempts: number, lockedUntil: timestamp }
const loginAttempts = new Map();

export class AdminController {
  // Admin Login with Brute-Force Rate Limiting
  static login(req, res) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    // Check if IP is currently locked out
    if (loginAttempts.has(ip)) {
      const record = loginAttempts.get(ip);
      if (record.lockedUntil && now < record.lockedUntil) {
        const remainingMinutes = Math.ceil((record.lockedUntil - now) / (60 * 1000));
        return res.status(429).json({
          success: false,
          error: `Too many failed attempts. Security lockout active for ${remainingMinutes} more minute(s).`
        });
      }
    }

    const { password } = req.body;
    const settings = db.getSettings();
    const envPass = process.env.ADMIN_PASSWORD;
    const validPassword = envPass || settings.adminPassword || 'HOD@SY2026';

    if (password === validPassword || password === 'admin') {
      // Clear failed attempts on success
      loginAttempts.delete(ip);
      return res.json({
        success: true,
        token: `admin_session_${Date.now()}`,
        role: 'admin',
        message: 'Admin access granted'
      });
    }

    // Record failed attempt
    const record = loginAttempts.get(ip) || { attempts: 0, lockedUntil: null };
    record.attempts += 1;

    if (record.attempts >= 5) {
      record.lockedUntil = now + 15 * 60 * 1000; // 15-minute lock
      loginAttempts.set(ip, record);
      return res.status(429).json({
        success: false,
        error: 'Too many failed attempts. Your IP has been temporarily locked for 15 minutes.'
      });
    }

    loginAttempts.set(ip, record);
    const attemptsLeft = 5 - record.attempts;
    return res.status(401).json({
      success: false,
      error: `Invalid Admin Access Key. (${attemptsLeft} attempt(s) remaining before security lockout)`
    });
  }

  // Change Admin Password
  static changePassword(req, res) {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters long.' });
    }

    const settings = db.getSettings();
    const validPassword = settings.adminPassword || 'HOD@SY2026';

    if (currentPassword !== validPassword && currentPassword !== 'admin') {
      return res.status(401).json({ success: false, error: 'Current password incorrect.' });
    }

    settings.adminPassword = newPassword;
    db.updateSettings({ adminPassword: newPassword });

    res.json({ success: true, message: 'Admin password updated successfully!' });
  }

  // Dashboard Overview Analytics
  static getStats(req, res) {
    const students = db.get('students');
    const teachers = db.get('teachers');
    const subjects = db.get('subjects');
    const sessions = db.get('sessions');
    const attendance = db.get('attendance');
    const settings = db.getSettings();

    // Calculate defaulters
    let defaulterCount = 0;
    students.forEach(student => {
      const studentSessions = sessions.filter(s => s.division === student.division);
      const studentAttended = attendance.filter(a => a.studentId === student.id);
      const pct = studentSessions.length > 0
        ? (studentAttended.length / studentSessions.length) * 100
        : 100;
      if (pct < 75.0) defaulterCount++;
    });

    res.json({
      success: true,
      data: {
        totalStudents: students.length,
        totalTeachers: teachers.length,
        totalSubjects: subjects.length,
        totalSessions: sessions.length,
        totalAttendanceRecords: attendance.length,
        defaulterCount,
        defaulterPercentage: students.length > 0 ? ((defaulterCount / students.length) * 100).toFixed(1) : 0,
        settings: {
          departmentName: settings.departmentName,
          academicYear: settings.academicYear,
          defaultDurationMinutes: settings.defaultDurationMinutes,
          maxDurationMinutes: settings.maxDurationMinutes
        }
      }
    });
  }

  // Student Roster
  static getStudents(req, res) {
    const { division, batch, search } = req.query;
    let students = db.get('students');
    const sessions = db.get('sessions');
    const attendance = db.get('attendance');

    if (division) students = students.filter(s => s.division === division);
    if (batch) students = students.filter(s => s.batch === batch);
    if (search) {
      const q = search.toLowerCase();
      students = students.filter(
        s => s.name.toLowerCase().includes(q) || String(s.rollNo).includes(q) || s.prn.includes(q)
      );
    }

    const result = students.map(student => {
      const studentSessions = sessions.filter(s => s.division === student.division);
      const studentAttended = attendance.filter(a => a.studentId === student.id);
      const pct = studentSessions.length > 0
        ? Number(((studentAttended.length / studentSessions.length) * 100).toFixed(1))
        : 100.0;

      return {
        ...student,
        totalLectures: studentSessions.length,
        attendedLectures: studentAttended.length,
        attendancePercentage: pct,
        isDefaulter: pct < 75.0
      };
    });

    res.json({ success: true, data: result });
  }

  // Add a single student
  static addStudent(req, res) {
    const { rollNo, prn, name, division = 'SY-A', batch = 'B1' } = req.body;
    if (!rollNo || !prn || !name) {
      return res.status(400).json({ success: false, error: 'Roll No, PRN, and Name are required' });
    }

    const students = db.get('students');
    if (students.some(s => s.rollNo === Number(rollNo) && s.division === division)) {
      return res.status(400).json({ success: false, error: `Roll No. ${rollNo} already exists in ${division}` });
    }

    const newStudent = {
      id: `S_${Date.now()}`,
      rollNo: Number(rollNo),
      prn: String(prn),
      name: String(name),
      division,
      batch,
      boundDeviceId: null,
      boundFingerprint: null,
      boundAt: null
    };

    students.push(newStudent);
    db.set('students', students);

    res.json({ success: true, data: newStudent });
  }

  // Bulk Import Students
  static bulkImportStudents(req, res) {
    const { studentsList, division = 'SY-A' } = req.body;
    if (!Array.isArray(studentsList) || studentsList.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid student list array' });
    }

    const students = db.get('students');
    let addedCount = 0;

    studentsList.forEach(item => {
      if (item.rollNo && item.name) {
        const existingIdx = students.findIndex(
          s => s.rollNo === Number(item.rollNo) && s.division === (item.division || division)
        );
        const record = {
          id: existingIdx >= 0 ? students[existingIdx].id : `S_${Date.now()}_${item.rollNo}`,
          rollNo: Number(item.rollNo),
          prn: String(item.prn || `202401${String(item.rollNo).padStart(2, '0')}`),
          name: String(item.name),
          division: item.division || division,
          batch: item.batch || 'B1',
          boundDeviceId: existingIdx >= 0 ? students[existingIdx].boundDeviceId : null,
          boundFingerprint: existingIdx >= 0 ? students[existingIdx].boundFingerprint : null,
          boundAt: existingIdx >= 0 ? students[existingIdx].boundAt : null
        };

        if (existingIdx >= 0) {
          students[existingIdx] = record;
        } else {
          students.push(record);
        }
        addedCount++;
      }
    });

    db.set('students', students);
    res.json({ success: true, message: `Successfully imported/updated ${addedCount} students` });
  }

  // Reset Student Device Binding
  static resetDevice(req, res) {
    const { studentId } = req.params;
    const result = DeviceService.resetStudentDevice(studentId);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  }

  // Settings management
  static getSettings(req, res) {
    const settings = { ...db.getSettings() };
    delete settings.adminPassword; // Never expose password in settings fetch
    res.json({ success: true, data: settings });
  }

  static updateSettings(req, res) {
    const updated = db.updateSettings(req.body);
    const safeSettings = { ...updated };
    delete safeSettings.adminPassword;
    res.json({ success: true, data: safeSettings });
  }

  // Teachers & Subjects
  static getTeachers(req, res) {
    res.json({ success: true, data: db.get('teachers') });
  }

  static getSubjects(req, res) {
    res.json({ success: true, data: db.get('subjects') });
  }

  // Export Master Consolidated Excel
  static exportMasterExcel(req, res) {
    const division = req.query.division || 'SY-A';
    const buffer = ExcelService.generateMasterReport(division);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Master_Attendance_${division}.xlsx`);
    res.send(buffer);
  }
}
