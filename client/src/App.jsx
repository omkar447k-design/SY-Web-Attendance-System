import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { StudentPortal } from './pages/StudentPortal';
import { TeacherPortal } from './pages/TeacherPortal';
import { AdminPortal } from './pages/AdminPortal';
import { getDeviceIdentity } from './services/fingerprint';

export function App() {
  const [role, setRole] = useState(null);
  const [user, setUser] = useState(null);
  const [device, setDevice] = useState(null);

  useEffect(() => {
    async function initSession() {
      const savedRole = localStorage.getItem('sy_auth_role');
      const savedUser = localStorage.getItem('sy_auth_user');
      const devInfo = await getDeviceIdentity();
      setDevice(devInfo);

      if (savedRole && savedUser) {
        try {
          setRole(savedRole);
          setUser(JSON.parse(savedUser));
        } catch (e) {}
      }
    }
    initSession();
  }, []);

  const handleLoginSuccess = (userRole, userData, devInfo) => {
    setRole(userRole);
    setUser(userData);
    if (devInfo) setDevice(devInfo);

    localStorage.setItem('sy_auth_role', userRole);
    localStorage.setItem('sy_auth_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setRole(null);
    setUser(null);
    localStorage.removeItem('sy_auth_role');
    localStorage.removeItem('sy_auth_user');
  };

  const handleLaunchLectureAsHod = (teacherProfile) => {
    setRole('teacher');
    setUser(teacherProfile);
    localStorage.setItem('sy_auth_role', 'teacher');
    localStorage.setItem('sy_auth_user', JSON.stringify(teacherProfile));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      <Navbar role={role} user={user} onLogout={handleLogout} />

      <main className="flex-1">
        {!role && <Login onLoginSuccess={handleLoginSuccess} />}

        {role === 'student' && user && (
          <StudentPortal student={user} device={device} />
        )}

        {role === 'teacher' && user && (
          <TeacherPortal teacher={user} />
        )}

        {role === 'admin' && (
          <AdminPortal
            hodProfile={user}
            onLaunchLectureAsHod={handleLaunchLectureAsHod}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500 bg-white">
        <p>Engineering Multi-Department Attendance System • SY 2025-2026</p>
      </footer>
    </div>
  );
}

export default App;
