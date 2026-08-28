import { db } from '../config/db.js';

const sessionDeviceSubmissions = new Map();

export class DeviceService {
  static verifyOrBindDevice(studentId, rollNo, deviceId, fingerprint, studentName = 'Student') {
    if (!deviceId || !fingerprint) {
      return { success: false, error: 'Hardware device fingerprint required for secure binding' };
    }

    const students = db.get('students');
    const student = students.find(s => s.id === studentId || s.rollNo === Number(rollNo));

    if (!student) {
      return { success: false, error: 'Student record not found in department roster' };
    }

    const deviceBoundToOther = students.find(
      s => s.id !== student.id && (s.boundDeviceId === deviceId || s.boundFingerprint === fingerprint)
    );

    if (deviceBoundToOther) {
      return {
        success: false,
        error: `🛑 Security Lock: This mobile phone is already locked to Roll No. ${deviceBoundToOther.rollNo} (${deviceBoundToOther.name}). Multiple student logins from one smartphone are strictly prohibited.`
      };
    }

    if (student.boundDeviceId && (student.boundDeviceId !== deviceId || student.boundFingerprint !== fingerprint)) {
      return {
        success: false,
        error: `🔒 1-Device Binding Active: Your account is already bound to another phone. To switch devices, please request your HOD to reset your device binding.`
      };
    }

    if (!student.boundDeviceId) {
      student.boundDeviceId = deviceId;
      student.boundFingerprint = fingerprint;
      student.boundAt = new Date().toISOString();
      db.set('students', students);
    }

    return {
      success: true,
      student: {
        id: student.id,
        rollNo: student.rollNo,
        name: student.name || studentName,
        department: student.department,
        division: student.division,
        batch: student.batch,
        boundDeviceId: student.boundDeviceId,
        boundAt: student.boundAt
      }
    };
  }

  static checkInSessionLock(sessionId, deviceId, studentRollNo) {
    const key = `${sessionId}:${deviceId}`;
    if (sessionDeviceSubmissions.has(key)) {
      const priorRollNo = sessionDeviceSubmissions.get(key);
      if (Number(priorRollNo) !== Number(studentRollNo)) {
        return {
          allowed: false,
          error: `🛑 Proxy Attendance Blocked: This smartphone has already submitted attendance for Roll No. ${priorRollNo} in this lecture.`
        };
      }
    }
    return { allowed: true };
  }

  static recordSessionSubmission(sessionId, deviceId, studentRollNo) {
    const key = `${sessionId}:${deviceId}`;
    sessionDeviceSubmissions.set(key, studentRollNo);
  }

  static resetStudentDevice(studentId) {
    const students = db.get('students');
    const student = students.find(s => s.id === studentId || s.rollNo === Number(studentId));
    if (!student) return { success: false, error: 'Student not found in roster' };

    student.boundDeviceId = null;
    student.boundFingerprint = null;
    student.boundAt = null;
    db.set('students', students);

    return { success: true, message: `✅ Device lock successfully cleared for Roll No. ${student.rollNo} (${student.name}). Student can now bind a new phone.` };
  }
}
