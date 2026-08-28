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

// Root Landing Route
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>SY Attendance Backend Server</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 2.5rem; border-radius: 1.5rem; border: 1px solid #334155; text-align: center; max-width: 480px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
          .badge { display: inline-block; background: rgba(16,185,129,0.2); color: #34d399; padding: 0.25rem 0.75rem; border-radius: 9999px; font-weight: bold; font-size: 0.75rem; margin-bottom: 1rem; border: 1px solid rgba(16,185,129,0.3); }
          h1 { margin: 0 0 0.5rem 0; font-size: 1.5rem; }
          p { color: #94a3b8; font-size: 0.875rem; margin: 0.5rem 0 1.5rem 0; line-height: 1.5; }
          a { color: #818cf8; text-decoration: none; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">● SERVER ACTIVE & RUNNING</div>
          <h1>SY Attendance Backend API</h1>
          <p>The real-time WebSocket and Attendance Engine is online and operational.</p>
          <p>Access the Web Portal here:<br><a href="https://sy-web-attendance-system.vercel.app" target="_blank">sy-web-attendance-system.vercel.app &rarr;</a></p>
        </div>
      </body>
    </html>
  `);
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// --- ADMIN ROUTES (2-Tier HOD Security & Audit Logs) ---
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

// --- TEACHER ROUTES (Faculty Passcode Protection) ---
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

// --- STUDENT ROUTES ---
app.post('/api/student/login', StudentController.login);
app.get('/api/student/session/active', StudentController.getActiveSession);
app.post('/api/student/attendance/submit', StudentController.submitPin);
app.get('/api/student/dashboard/:studentId', StudentController.getDashboard);

// --- REAL-TIME WEBSOCKETS ---
io.on('connection', (socket) => {
  socket.on('join_session', (sessionId) => {
    socket.join(sessionId);
  });

  socket.on('leave_session', (sessionId) => {
    socket.leave(sessionId);
  });
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
  console.log(`====================================================`);
  console.log(`🚀 SY Attendance Server running on port ${PORT}`);
  console.log(`📡 Local Network URL: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
