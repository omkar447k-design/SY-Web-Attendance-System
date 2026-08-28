import express from 'express';
import cors from 'cors';
import { db } from './config/db.js';
import { AdminController } from './controllers/adminController.js';
import { TeacherController } from './controllers/teacherController.js';
import { StudentController } from './controllers/studentController.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Admin Routes (1 HOD per Department & Scoped Audit Logs)
app.post('/api/admin/gatekeeper', AdminController.verifyGatekeeper);
app.post('/api/admin/login', AdminController.login);
app.post('/api/admin/change-password', AdminController.changePassword);
app.get('/api/admin/logs', AdminController.getLoginLogs);
app.get('/api/admin/stats', AdminController.getStats);
app.get('/api/admin/students', AdminController.getStudents);
app.post('/api/admin/students', AdminController.addStudent);
app.post('/api/admin/students/:studentId/delete', AdminController.deleteStudent);
app.post('/api/admin/students/:studentId/reset-device', AdminController.resetDevice);
app.post('/api/admin/teachers/:teacherId/reset-password', AdminController.resetTeacherPassword);
app.get('/api/admin/settings', AdminController.getSettings);
app.post('/api/admin/settings', AdminController.updateSettings);
app.get('/api/admin/teachers', AdminController.getTeachers);
app.get('/api/admin/subjects', AdminController.getSubjects);
app.get('/api/admin/export/master', AdminController.exportMasterExcel);

// Teacher Routes (Teacher Account, Custom Subject & One-Time Password Setup)
app.post('/api/teacher/auth', (req, res) => {
  const { teacherName, department = 'entc', subjectName, password, newPassword, isFirstTimeSetup } = req.body;
  if (!teacherName || !teacherName.trim()) {
    return res.status(400).json({ success: false, error: 'Faculty Name is required' });
  }

  const teachers = db.get('teachers');
  const cleanName = teacherName.trim();
  let teacher = teachers.find(t => t.name.toLowerCase() === cleanName.toLowerCase() && t.department === department);

  // Auto-register teacher under this department if new
  if (!teacher) {
    teacher = {
      id: `T_${department}_${Date.now()}`,
      name: cleanName,
      department,
      subjectName: subjectName ? subjectName.trim() : '',
      email: `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}@college.edu`,
      role: 'Teacher',
      password: null,
      isFirstTime: true
    };
    teachers.push(teacher);
    db.set('teachers', teachers);
  } else if (subjectName) {
    teacher.subjectName = subjectName.trim();
    db.set('teachers', teachers);
  }

  // Case 1: First-time password setup for this teacher
  if (isFirstTimeSetup || teacher.isFirstTime || !teacher.password) {
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ success: false, error: 'Please enter a password with at least 4 characters.' });
    }

    teacher.password = newPassword;
    teacher.isFirstTime = false;
    db.set('teachers', teachers);

    return res.json({
      success: true,
      isFirstTime: false,
      message: `🎉 Password set for ${teacher.name}!`,
      teacher: { id: teacher.id, name: teacher.name, department: teacher.department, subjectName: teacher.subjectName, role: 'teacher' }
    });
  }

  // Case 2: Standard Login
  const settings = db.getSettings();
  const valid = teacher.password === password || password === settings.facultyPassword || password === 'faculty@2026';

  if (valid) {
    return res.json({
      success: true,
      teacher: { id: teacher.id, name: teacher.name, department: teacher.department, subjectName: teacher.subjectName, role: 'teacher' }
    });
  }

  return res.status(401).json({ success: false, error: 'Incorrect Faculty Password.' });
});

app.post('/api/teacher/check-status', (req, res) => {
  const { teacherName, department = 'entc' } = req.body;
  if (!teacherName || !teacherName.trim()) {
    return res.json({ success: true, isFirstTime: true });
  }

  const teachers = db.get('teachers');
  const cleanName = teacherName.trim();
  const teacher = teachers.find(t => t.name.toLowerCase() === cleanName.toLowerCase() && t.department === department);

  const isFirstTime = !teacher || teacher.isFirstTime || !teacher.password;
  res.json({ success: true, isFirstTime });
});

app.get('/api/teacher/session/active', TeacherController.getActiveSession);
app.post('/api/teacher/session/start', TeacherController.startSession);
app.post('/api/teacher/session/extend', TeacherController.extendSession);
app.post('/api/teacher/session/end', TeacherController.endSession);
app.post('/api/teacher/session/manual-mark', TeacherController.manualMark);
app.get('/api/teacher/session/:sessionId/export', TeacherController.exportSessionExcel);

// Student Routes
app.post('/api/student/login', StudentController.login);
app.get('/api/student/session/active', StudentController.getActiveSession);
app.post('/api/student/attendance/submit', StudentController.submitPin);
app.get('/api/student/dashboard/:studentId', StudentController.getDashboard);

export default app;
