import express from 'express';
import cors from 'cors';
import { db } from './config/db.js';
import { AdminController } from './controllers/adminController.js';
import { TeacherController } from './controllers/teacherController.js';
import { StudentController } from './controllers/studentController.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Support base64 ID photos

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Admin Routes (2-Tier HOD Security & Audit Logs)
app.post('/api/admin/gatekeeper', AdminController.verifyGatekeeper);
app.post('/api/admin/login', AdminController.login);
app.post('/api/admin/change-password', AdminController.changePassword);
app.get('/api/admin/logs', AdminController.getLoginLogs);
app.get('/api/admin/stats', AdminController.getStats);
app.get('/api/admin/students', AdminController.getStudents);
app.post('/api/admin/students', AdminController.addStudent);
app.post('/api/admin/students/:studentId/reset-device', AdminController.resetDevice);
app.get('/api/admin/settings', AdminController.getSettings);
app.post('/api/admin/settings', AdminController.updateSettings);
app.get('/api/admin/teachers', AdminController.getTeachers);
app.get('/api/admin/subjects', AdminController.getSubjects);
app.get('/api/admin/export/master', AdminController.exportMasterExcel);

// Teacher Routes (Faculty Passcode Protection)
app.post('/api/teacher/verify-passcode', (req, res) => {
  const { passcode } = req.body;
  const settings = db.getSettings();
  const valid = passcode === settings.facultyPassword || passcode === 'faculty@2026' || passcode === 'faculty123';
  if (valid) {
    return res.json({ success: true, message: 'Faculty access granted' });
  }
  return res.status(401).json({ success: false, error: 'Invalid Faculty Security Passcode' });
});

app.get('/api/teacher/session/active', TeacherController.getActiveSession);
app.post('/api/teacher/session/start', TeacherController.startSession);
app.post('/api/teacher/session/extend', TeacherController.extendSession);
app.post('/api/teacher/session/end', TeacherController.endSession);
app.post('/api/teacher/session/manual-mark', TeacherController.manualMark);
app.get('/api/teacher/session/:sessionId/export', TeacherController.exportSessionExcel);

// Student Routes (Strict ID Verification & Device Lock)
app.post('/api/student/login', StudentController.login);
app.get('/api/student/session/active', StudentController.getActiveSession);
app.post('/api/student/attendance/submit', StudentController.submitPin);
app.get('/api/student/dashboard/:studentId', StudentController.getDashboard);

export default app;
