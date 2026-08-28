import React, { useState, useEffect } from 'react';
import { GraduationCap, Users, Shield, ArrowRight, Smartphone, Lock, X } from 'lucide-react';
import { api } from '../services/api';
import { getDeviceIdentity } from '../services/fingerprint';

export function Login({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('student'); // 'student' | 'teacher'

  // Student form state
  const [division, setDivision] = useState('SY-A');
  const [rollNo, setRollNo] = useState('24');
  const [prn, setPrn] = useState('');
  
  // Teacher form state
  const [teacherId, setTeacherId] = useState('T101');

  // Secret Admin modal state
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adminError, setAdminError] = useState('');

  // Detect URL hash / query e.g. #admin
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
        division,
        deviceId,
        fingerprint
      });

      if (res.success) {
        onLoginSuccess('student', res.student, { deviceId, fingerprint });
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your roll number or contact Admin.');
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
      const teacher = teachers.data.find(t => t.id === teacherId) || { id: teacherId, name: 'Faculty Member' };
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
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md">
        
        {/* Welcome Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-brand-600 to-indigo-500 shadow-xl shadow-brand-500/30 mb-4 ring-4 ring-brand-500/20">
            <GraduationCap className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            SY Attendance Portal
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Department of Computer Engineering • 2025-2026
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/40">
          
          {/* Public Tab Switcher: Student vs Faculty ONLY */}
          <div className="flex bg-slate-900/90 p-1.5 rounded-2xl mb-6 border border-slate-800">
            <button
              onClick={() => { setActiveTab('student'); setError(''); }}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center space-x-1.5 ${
                activeTab === 'student'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Student Portal</span>
            </button>

            <button
              onClick={() => { setActiveTab('teacher'); setError(''); }}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center space-x-1.5 ${
                activeTab === 'teacher'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Faculty Launcher</span>
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs sm:text-sm leading-relaxed">
              ⚠️ {error}
            </div>
          )}

          {/* Student Tab */}
          {activeTab === 'student' && (
            <form onSubmit={handleStudentLogin} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Division
                  </label>
                  <select
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-brand-500 outline-none"
                  >
                    <option value="SY-A">SY-A</option>
                    <option value="SY-B">SY-B</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Roll Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={rollNo}
                    onChange={(e) => setRollNo(e.target.value)}
                    placeholder="e.g. 24"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-brand-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  PRN / Student ID <span className="text-slate-500 normal-case font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={prn}
                  onChange={(e) => setPrn(e.target.value)}
                  placeholder="e.g. 20240124"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-brand-500 outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-brand-500/30 flex items-center justify-center space-x-2 transition-all duration-200 disabled:opacity-50 active:scale-[0.98]"
                >
                  <span>{loading ? 'Binding Phone Device...' : 'Enter Student Portal'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="text-center pt-2">
                <p className="text-[11px] text-slate-400">
                  🔒 1-Device Binding active. Your phone will be locked to this Roll Number.
                </p>
              </div>
            </form>
          )}

          {/* Teacher Tab */}
          {activeTab === 'teacher' && (
            <form onSubmit={handleTeacherLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Select Faculty Profile
                </label>
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-brand-500 outline-none"
                >
                  <option value="T101">Dr. A. K. Sharma (Operating Systems)</option>
                  <option value="T102">Prof. S. R. Patil (DBMS)</option>
                  <option value="T103">Prof. N. V. Deshmukh (Computer Networks)</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-brand-500/30 flex items-center justify-center space-x-2 transition-all duration-200 active:scale-[0.98]"
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
            className="text-xs text-slate-500 hover:text-slate-300 transition flex items-center justify-center space-x-1 mx-auto"
          >
            <Lock className="w-3 h-3" />
            <span>Department Admin Access</span>
          </button>
        </div>

      </div>

      {/* SECURE ADMIN PASSWORD MODAL */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl relative">
            <button
              onClick={() => setShowAdminModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-700/50 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/20 text-brand-400 flex items-center justify-center mx-auto mb-2">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-white">HOD Admin Authentication</h3>
              <p className="text-xs text-slate-400 mt-0.5">Protected with anti-brute force lockout</p>
            </div>

            {adminError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                ⚠️ {adminError}
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Enter Admin Master Password
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter secret master password"
                  autoFocus
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-brand-500 outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-brand-500/30 transition active:scale-95"
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
