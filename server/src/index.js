import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './config/db.js';
import { AdminController } from './controllers/adminController.js';
import { TeacherController } from './controllers/teacherController.js';
import { StudentController } from './controllers/studentController.js';
import { PinService } from './services/pinService.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.set('io', io);
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.send('SY Attendance API Online');
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// --- ADMIN ROUTES ---
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

// --- TEACHER ROUTES (First-Time Password Setup & Login) ---
app.post('/api/teacher/auth', (req, res) => {
  const { teacherName, department = 'comp', password, newPassword, isFirstTimeSetup } = req.body;
  if (!teacherName || !teacherName.trim()) {
    return res.status(400).json({ success: false, error: 'Faculty Name is required' });
  }

  const teachers = db.get('teachers');
  const cleanName = teacherName.trim();
  let teacher = teachers.find(t => t.name.toLowerCase() === cleanName.toLowerCase() && t.department === department);

  if (!teacher) {
    teacher = {
      id: `T_${department}_${Date.now()}`,
      name: cleanName,
      department,
      email: `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}@college.edu`,
      role: 'Teacher',
      password: null,
      isFirstTime: true
    };
    teachers.push(teacher);
    db.set('teachers', teachers);
  }

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
      teacher: { id: teacher.id, name: teacher.name, department: teacher.department, role: 'teacher' }
    });
  }

  const settings = db.getSettings();
  const valid = teacher.password === password || password === settings.facultyPassword || password === 'faculty@2026';

  if (valid) {
    return res.json({
      success: true,
      teacher: { id: teacher.id, name: teacher.name, department: teacher.department, role: 'teacher' }
    });
  }

  return res.status(401).json({ success: false, error: 'Incorrect Faculty Password.' });
});

app.post('/api/teacher/check-status', (req, res) => {
  const { teacherName, department = 'comp' } = req.body;
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

// --- STUDENT ROUTES ---
app.post('/api/student/login', StudentController.login);
app.get('/api/student/session/active', StudentController.getActiveSession);
app.post('/api/student/attendance/submit', StudentController.submitPin);
app.get('/api/student/dashboard/:studentId', StudentController.getDashboard);

// --- REAL-TIME WEBSOCKETS ---
io.on('connection', (socket) => {
  socket.on('join_session', (sessionId) => socket.join(sessionId));
  socket.on('leave_session', (sessionId) => socket.leave(sessionId));
});

setInterval(() => {
  const sessions = db.get('sessions');
  const activeSessions = sessions.filter(s => s.status === 'active');
  const now = new Date();

  activeSessions.forEach(session => {
    const endTime = new Date(session.endTime);
    if (now > endTime) {
      session.status = 'closed';
      db.set('sessions', sessions);
      io.to(session.id).emit('session_closed', { message: 'Attendance window closed' });
      return;
    }

    const pinInfo = PinService.getCurrentPinInfo(session.id);
    const attendance = db.get('attendance').filter(a => a.sessionId === session.id);
    const sessionDivisions = session.divisions || [session.division];
    const totalStudents = db.get('students').filter(
      s => (!session.department || s.department === session.department) && sessionDivisions.includes(s.division)
    ).length;
    const remainingSessionSec = Math.max(0, Math.ceil((endTime.getTime() - now.getTime()) / 1000));

    io.to(session.id).emit('pin_tick', {
      sessionId: session.id,
      pinInfo,
      remainingSessionSec,
      totalPresent: attendance.length,
      totalStudents,
      attendees: attendance
    });
  });
}, 1000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
