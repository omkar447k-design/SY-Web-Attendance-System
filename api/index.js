import express from 'express';
import cors from 'cors';
import { db } from '../server/src/config/db.js';
import { AdminController } from '../server/src/controllers/adminController.js';
import { TeacherController } from '../server/src/controllers/teacherController.js';
import { StudentController } from '../server/src/controllers/studentController.js';

const app = express();
app.use(cors());
app.use(express.json());

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Admin Routes
app.post('/api/admin/login', AdminController.login);
app.post('/api/admin/change-password', AdminController.changePassword);
app.get('/api/admin/stats', AdminController.getStats);
app.get('/api/admin/students', AdminController.getStudents);
app.post('/api/admin/students', AdminController.addStudent);
app.post('/api/admin/students/bulk', AdminController.bulkImportStudents);
app.post('/api/admin/students/:studentId/reset-device', AdminController.resetDevice);
app.get('/api/admin/settings', AdminController.getSettings);
app.post('/api/admin/settings', AdminController.updateSettings);
app.get('/api/admin/teachers', AdminController.getTeachers);
app.get('/api/admin/subjects', AdminController.getSubjects);
app.get('/api/admin/export/master', AdminController.exportMasterExcel);

// Teacher Routes
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
