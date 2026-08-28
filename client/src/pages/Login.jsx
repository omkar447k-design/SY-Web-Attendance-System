import React, { useState, useEffect } from 'react';
import { GraduationCap, Users, Shield, ArrowRight, Smartphone, Lock, X, Building2 } from 'lucide-react';
import { api } from '../services/api';
import { getDeviceIdentity } from '../services/fingerprint';

const DEPARTMENTS = [
  { id: 'comp', name: '1. Computer Science & Engineering', code: 'CSE' },
  { id: 'it', name: '2. Information Technology', code: 'IT' },
  { id: 'aids', name: '3. Artificial Intelligence & Data Science', code: 'AI&DS' },
  { id: 'entc', name: '4. Electronics & Telecommunication', code: 'ENTC' },
  { id: 'elec', name: '5. Electrical Engineering', code: 'ELEC' },
  { id: 'instru', name: '6. Instrumentation Engineering', code: 'INSTRU' }
];

const DIVISIONS = ['SY-A', 'SY-B', 'SY-C'];

export function Login({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('student'); // 'student' | 'teacher'

  // Student form state
  const [department, setDepartment] = useState('comp');
  const [division, setDivision] = useState('SY-A');
  const [rollNo, setRollNo] = useState('22');
  const [prn, setPrn] = useState('');
  
  // Teacher form state
  const [teacherDept, setTeacherDept] = useState('comp');
  const [teacherId, setTeacherId] = useState('T101');

  // Secret Admin modal state
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adminError, setAdminError] = useState('');

  useEffect(() => {
    if (window.location.hash === '#admin' || window.location.pathname === '/admin') {
      setShowAdminModal(true);
    }
  }, []);

  const handleStudentLogin = async (e) => {
    e.preventDefault();
    if (!rollNo) return setError('Please enter your Roll Number');
    setError('');
    setLoading(true);

    try {
      const { deviceId, fingerprint } = await getDeviceIdentity();
      const res = await api.studentLogin({
        rollNo: Number(rollNo),
        prn: prn ? String(prn) : undefined,
        department,
        division,
        deviceId,
        fingerprint
      });

      if (res.success) {
        onLoginSuccess('student', res.student, { deviceId, fingerprint });
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const teachers = await api.getTeachers();
      const teacher = teachers.data.find(t => t.id === teacherId) || { id: teacherId, name: 'Faculty Member', department: teacherDept };
      onLoginSuccess('teacher', teacher);
    } catch (err) {
      setError(err.message || 'Teacher login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAdminError('');
    setLoading(true);
    try {
      const res = await api.adminLogin(adminPassword);
      if (res.success) {
        setShowAdminModal(false);
        onLoginSuccess('admin', { name: 'HOD / Department Admin', role: 'admin' });
      }
    } catch (err) {
      setAdminError(err.message || 'Invalid Admin Password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-50">
      <div className="w-full max-w-lg">
        
        {/* Welcome Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 shadow-xl shadow-indigo-200 mb-3 ring-4 ring-indigo-50">
            <GraduationCap className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Engineering Attendance Portal
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            Second Year (SY) • Academic Year 2025-2026
          </p>
        </div>

        {/* Clean White Card */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/60">
          
          {/* Tab Switcher */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6 border border-slate-200/80">
            <button
              onClick={() => { setActiveTab('student'); setError(''); }}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 ${
                activeTab === 'student'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Student Portal</span>
            </button>

            <button
              onClick={() => { setActiveTab('teacher'); setError(''); }}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 ${
                activeTab === 'teacher'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Faculty Launcher</span>
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm leading-relaxed font-medium">
              ⚠️ {error}
            </div>
          )}

          {/* STUDENT LOGIN TAB */}
          {activeTab === 'student' && (
            <form onSubmit={handleStudentLogin} className="space-y-4">
              
              {/* Department Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Select Engineering Department</span>
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-semibold focus:border-indigo-600 focus:bg-white outline-none transition"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Division Selection Bar (SY-A, SY-B, SY-C) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Division
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DIVISIONS.map((div) => (
                    <button
                      key={div}
                      type="button"
                      onClick={() => setDivision(div)}
                      className={`py-2.5 rounded-xl text-xs sm:text-sm font-extrabold border transition-all ${
                        division === div
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {div}
                    </button>
                  ))}
                </div>
              </div>

              {/* Roll Number & PRN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Roll Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={rollNo}
                    onChange={(e) => setRollNo(e.target.value)}
                    placeholder="e.g. 22"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-bold focus:border-indigo-600 focus:bg-white outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    PRN / Student ID <span className="text-slate-400 font-normal normal-case">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={prn}
                    onChange={(e) => setPrn(e.target.value)}
                    placeholder="e.g. 12251ET049"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:bg-white outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-200 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <span>{loading ? 'Verifying & Binding Phone...' : 'Enter Student Portal'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="text-center pt-2">
                <p className="text-[11px] text-slate-500 font-medium">
                  🔒 1-Device Binding: Your smartphone will be locked to this Roll Number.
                </p>
              </div>
            </form>
          )}

          {/* TEACHER / FACULTY TAB */}
          {activeTab === 'teacher' && (
            <form onSubmit={handleTeacherLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Department
                </label>
                <select
                  value={teacherDept}
                  onChange={(e) => setTeacherDept(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-semibold focus:border-indigo-600 outline-none"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Faculty Profile
                </label>
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-semibold focus:border-indigo-600 outline-none"
                >
                  <option value="T101">Dr. A. K. Sharma (Computer Science)</option>
                  <option value="T102">Prof. S. R. Patil (Information Technology)</option>
                  <option value="T103">Prof. N. V. Deshmukh (AI & Data Science)</option>
                  <option value="T104">Prof. V. M. Kulkarni (ENTC)</option>
                  <option value="T105">Prof. P. R. Joshi (Electrical)</option>
                  <option value="T106">Prof. M. S. Shinde (Instrumentation)</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-200 flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
                >
                  <span>Launch Faculty Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Subtle Discrete Admin Link for HOD */}
        <div className="text-center mt-6">
          <button
            onClick={() => { setShowAdminModal(true); setAdminError(''); }}
            className="text-xs text-slate-400 hover:text-slate-700 font-medium transition flex items-center justify-center space-x-1 mx-auto"
          >
            <Lock className="w-3 h-3" />
            <span>Department Admin Access</span>
          </button>
        </div>

      </div>

      {/* SECURE ADMIN PASSWORD MODAL */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl relative">
            <button
              onClick={() => setShowAdminModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg bg-slate-100 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2 border border-indigo-100">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">HOD Admin Authentication</h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">Protected with anti-brute force lockout</p>
            </div>

            {adminError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                ⚠️ {adminError}
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Enter Admin Master Password
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter secret master password"
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:bg-white outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-100 transition active:scale-95"
              >
                {loading ? 'Authenticating...' : 'Unlock Admin Portal'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
