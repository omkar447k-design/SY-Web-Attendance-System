import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { StudentPortal } from './pages/StudentPortal';
import { TeacherPortal } from './pages/TeacherPortal';
import { AdminPortal } from './pages/AdminPortal';
import { getDeviceIdentity } from './services/fingerprint';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Runtime Error Caught:', error, errorInfo);
  }

  handleReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 p-6 sm:p-8 max-w-md w-full text-center shadow-lg">
            <div className="w-12 h-12 bg-rose-100 text-rose-700 mx-auto flex items-center justify-center rounded-full mb-4 text-2xl font-bold">
              ⚠️
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Portal Session Restored</h2>
            <p className="text-xs text-slate-600 mb-6">
              A temporary display glitch was prevented. Click below to refresh your portal cleanly.
            </p>
            <button
              onClick={this.handleReset}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider transition"
            >
              Reset Session & Reload Portal
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  const [role, setRole] = useState(null);
  const [user, setUser] = useState(null);
  const [device, setDevice] = useState(null);
  const [previousAdminUser, setPreviousAdminUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    async function initSession() {
      try {
        const savedRole = localStorage.getItem('sy_auth_role');
        const savedUser = localStorage.getItem('sy_auth_user');

        try {
          const devInfo = await getDeviceIdentity();
          setDevice(devInfo);
        } catch (devErr) {
          console.warn('Device identity init note:', devErr.message);
        }

        if (savedRole && savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser);
            if (parsedUser && typeof parsedUser === 'object') {
              setRole(savedRole);
              setUser(parsedUser);
            } else {
              handleLogout();
            }
          } catch (parseErr) {
            handleLogout();
          }
        } else {
          setRole(null);
          setUser(null);
        }
      } catch (err) {
        console.warn('Session init warning:', err);
      } finally {
        setIsInitializing(false);
      }
    }

    initSession();
  }, []);

  const handleLoginSuccess = (userRole, userData, devInfo) => {
    setRole(userRole);
    setUser(userData);
    if (devInfo) setDevice(devInfo);

    try {
      localStorage.setItem('sy_auth_role', userRole);
      localStorage.setItem('sy_auth_user', JSON.stringify(userData));
    } catch (e) {}
  };

  const handleLogout = () => {
    setRole(null);
    setUser(null);
    setPreviousAdminUser(null);
    try {
      localStorage.removeItem('sy_auth_role');
      localStorage.removeItem('sy_auth_user');
    } catch (e) {}
  };

  const handleLaunchLectureAsHod = (teacherProfile) => {
    setPreviousAdminUser(user);
    setRole('teacher');
    setUser(teacherProfile);
    try {
      localStorage.setItem('sy_auth_role', 'teacher');
      localStorage.setItem('sy_auth_user', JSON.stringify(teacherProfile));
    } catch (e) {}
  };

  const handleBackFromTeacher = () => {
    if (previousAdminUser) {
      setRole('admin');
      setUser(previousAdminUser);
      try {
        localStorage.setItem('sy_auth_role', 'admin');
        localStorage.setItem('sy_auth_user', JSON.stringify(previousAdminUser));
      } catch (e) {}
      return;
    }

    const isHodTeacher = user?.id?.startsWith('T_HOD_');
    if (isHodTeacher) {
      const hodUser = {
        name: user.name,
        department: user.department,
        role: 'admin'
      };
      setRole('admin');
      setUser(hodUser);
      try {
        localStorage.setItem('sy_auth_role', 'admin');
        localStorage.setItem('sy_auth_user', JSON.stringify(hodUser));
      } catch (e) {}
    } else {
      handleLogout();
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
        <Navbar role={role} user={user} onLogout={handleLogout} />

        <main className="flex-1">
          {(!role || !user) && <Login onLoginSuccess={handleLoginSuccess} />}

          {role === 'student' && user && (
            <StudentPortal student={user} device={device} />
          )}

          {role === 'teacher' && user && (
            <TeacherPortal teacher={user} onBack={handleBackFromTeacher} />
          )}

          {role === 'admin' && user && (
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
    </ErrorBoundary>
  );
}

export default App;
