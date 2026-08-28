import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, AlertTriangle, Clock, BookOpen, ShieldCheck, RefreshCw, Building2, User, Smartphone, Shield, Lock, ExternalLink, Calendar, Hash } from 'lucide-react';
import { api } from '../services/api';
import { PinInput } from '../components/PinInput';

const DEPT_NAMES = {
  comp: 'Computer Science & Engineering',
  it: 'Information Technology',
  aids: 'Artificial Intelligence & Data Science',
  entc: 'Electronics & Telecommunication',
  elec: 'Electrical Engineering',
  instru: 'Instrumentation Engineering'
};

export function StudentPortal({ student, device }) {
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' | 'profile'
  const [activeSession, setActiveSession] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showIdModal, setShowIdModal] = useState(false);

  const refreshData = async () => {
    try {
      const [dashRes, sessRes] = await Promise.all([
        api.getStudentDashboard(student.id || student.rollNo),
        api.getStudentActiveSession(student.division, student.id, student.department)
      ]);

      if (dashRes.success) {
        setDashboardData(dashRes.data);
      }

      if (sessRes.success && sessRes.hasActiveSession) {
        setActiveSession(sessRes.session);
        if (sessRes.session.alreadyMarked) {
          setSubmitSuccess('You are marked Present for this lecture session.');
        }
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.error('Error refreshing student data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 3500);
    return () => clearInterval(interval);
  }, [student.id, student.division, student.department]);

  const handlePinSubmit = async (submittedPin) => {
    const pinToSubmit = submittedPin || pin;
    if (!pinToSubmit || pinToSubmit.length !== 4) {
      setSubmitError('Please enter the full 4-digit PIN');
      return;
    }

    if (!activeSession) {
      setSubmitError('No active attendance session currently.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await api.submitPin({
        studentId: student.id,
        rollNo: student.rollNo,
        sessionId: activeSession.id,
        pin: pinToSubmit,
        deviceId: device.deviceId,
        fingerprint: device.fingerprint
      });

      if (res.success) {
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }

        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        } catch (e) {}

        setSubmitSuccess(res.message || '✅ Attendance Recorded Successfully!');
        refreshData();
      }
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit PIN. Please check the screen.');
    } finally {
      setSubmitting(false);
    }
  };

  const stats = dashboardData?.stats;
  const overallPct = stats?.overallPercentage ?? 100;
  const isSafe = overallPct >= 75.0;
  const departmentName = DEPT_NAMES[student.department] || 'Computer Science & Engineering';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      
      {/* Student Welcome Header Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="relative">
            {student.idCardPhoto ? (
              <img
                src={student.idCardPhoto}
                alt="ID Badge"
                onClick={() => setShowIdModal(true)}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-indigo-600 shadow-md cursor-pointer hover:opacity-90 transition"
                title="Click to view verified ID Card"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-xl font-extrabold shadow-md shadow-indigo-100">
                {student.rollNo}
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold border-2 border-white" title="Verified ID">
              ✓
            </span>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-extrabold text-slate-900">{student.name}</h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                {student.division} • Batch {student.batch}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center space-x-1.5 font-medium">
              <Building2 className="w-3.5 h-3.5 text-indigo-500" />
              <span>{departmentName}</span>
              <span>• Roll #{student.rollNo} • PRN: {student.prn}</span>
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center space-x-2 self-end sm:self-center">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'attendance'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mark Attendance
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'profile'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My Profile 🔒
            </button>
          </div>

          <button
            onClick={refreshData}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* VIEW 1: ATTENDANCE SCANNER & DASHBOARD */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          
          {/* ACTIVE CLASS ATTENDANCE CARD */}
          {activeSession ? (
            <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold uppercase tracking-wider mb-4 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                <span>Live Class Attendance Open</span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {activeSession.subjectName}
              </h3>
              
              <div className="flex flex-wrap items-center justify-center gap-2 text-slate-300 text-sm mt-2 font-medium">
                {activeSession.teacherName && (
                  <span className="flex items-center space-x-1 bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/10">
                    <User className="w-3.5 h-3.5 text-indigo-300" />
                    <span>{activeSession.teacherName}</span>
                  </span>
                )}
                <span className="bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/10">
                  Target Divisions: <span className="text-indigo-300 font-bold">{activeSession.division}</span>
                </span>
                {activeSession.batch !== 'All' && (
                  <span className="bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/10">
                    Batch: {activeSession.batch}
                  </span>
                )}
              </div>

              {submitSuccess || activeSession.alreadyMarked ? (
                <div className="my-6 p-6 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 max-w-sm mx-auto">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-emerald-400" />
                  <p className="font-extrabold text-lg text-white">Present Recorded!</p>
                  <p className="text-xs text-emerald-200 mt-1">Your attendance is confirmed for this lecture.</p>
                </div>
              ) : (
                <div className="my-6 max-w-sm mx-auto bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20">
                  <p className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">
                    Enter the 4-digit PIN on the Projector Screen:
                  </p>

                  <PinInput
                    length={4}
                    onComplete={handlePinSubmit}
                    disabled={submitting}
                  />

                  {submitError && (
                    <p className="text-xs text-rose-300 font-semibold mt-2 bg-rose-500/20 py-2 px-3 rounded-lg border border-rose-500/30">
                      ⚠️ {submitError}
                    </p>
                  )}

                  <p className="text-[11px] text-slate-300 mt-3 font-medium">
                    ⏱️ PIN rotates every 10 seconds. Enter the current active PIN on screen.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 text-center text-slate-500 text-sm shadow-sm">
              <Clock className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              <p className="font-bold text-slate-800">No Active Attendance Session Right Now</p>
              <p className="text-xs text-slate-500 mt-0.5">
                When your professor starts attendance for {student.division} ({departmentName}), the PIN entry box will appear here instantly.
              </p>
            </div>
          )}

          {/* ATTENDANCE ANALYTICS GAUGE & 75% TARGET CALCULATOR */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col items-center justify-center text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Overall Department Attendance
              </span>
              <div className="relative flex items-center justify-center my-2">
                <div className={`text-4xl sm:text-5xl font-black ${isSafe ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {overallPct}%
                </div>
              </div>
              <div className={`text-xs font-bold px-3 py-1 rounded-full mt-2 ${
                isSafe
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {isSafe ? '✅ Safe (> 75%)' : '⚠️ Defaulter (< 75%)'}
              </div>
              <p className="text-[11px] text-slate-500 mt-2 font-medium">
                {stats?.attendedLectures ?? 0} attended out of {stats?.totalLectures ?? 0} lectures
              </p>
            </div>

            <div className="md:col-span-2 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm mb-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>HOD 75% Mandatory Attendance Rule</span>
                </div>
                
                {isSafe ? (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm leading-relaxed">
                    🎉 <strong>Great job!</strong> Your attendance is above 75%. Keep attending regularly to remain in the safe zone for term work submission.
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm leading-relaxed">
                    ⚠️ <strong>Attendance Warning:</strong> You are currently on the Defaulter List. You need to attend the next <span className="font-extrabold text-slate-900 underline">{stats?.lecturesNeededFor75 || 2} lectures consecutively</span> to cross 75%!
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
                <div>
                  <span className="block text-slate-400">Min. Target Required</span>
                  <span className="font-bold text-slate-900 text-sm">75.0%</span>
                </div>
                <div>
                  <span className="block text-slate-400">Term Work Eligibility</span>
                  <span className={`font-bold text-sm ${isSafe ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {isSafe ? 'Eligible' : 'At Risk'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SUBJECT-WISE ATTENDANCE BREAKDOWN */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h4 className="text-base font-extrabold text-slate-900 mb-4 flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>Subject-Wise Attendance Breakdown</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dashboardData?.subjectStats?.map((sub) => (
                <div key={sub.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-extrabold text-indigo-600 tracking-wider">
                        {sub.code || 'SUB'} • {sub.type || 'Theory'}
                      </span>
                      <h5 className="font-bold text-slate-900 text-sm mt-0.5">{sub.name}</h5>
                    </div>
                    <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                      sub.isSafe ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {sub.percentage}%
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          sub.isSafe ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, sub.percentage)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-medium">
                      <span>{sub.attended} / {sub.total} classes attended</span>
                      <span>{sub.isSafe ? 'Safe' : 'Low (<75%)'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* VIEW 2: DEDICATED STUDENT PROFILE & 1-PHONE HARDWARE LOCK */}
      {activeTab === 'profile' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Student Identity & Security</span>
              <h3 className="text-xl font-extrabold text-slate-900">Personal Academic Profile</h3>
              <p className="text-xs text-slate-500 mt-0.5">Verified via Physical College ID Card</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Identity Verified</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* ID Card Photo Preview */}
            <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              {student.idCardPhoto ? (
                <div>
                  <img
                    src={student.idCardPhoto}
                    alt="Physical ID Card"
                    onClick={() => setShowIdModal(true)}
                    className="w-40 h-28 object-cover rounded-xl border border-slate-300 shadow-md cursor-pointer hover:opacity-90 transition mx-auto mb-2"
                  />
                  <button
                    onClick={() => setShowIdModal(true)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center justify-center space-x-1 mx-auto"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>View Full ID Card</span>
                  </button>
                </div>
              ) : (
                <div className="text-slate-400 text-xs">No ID Card Attached</div>
              )}
            </div>

            {/* Academic Details Matrix */}
            <div className="md:col-span-2 grid grid-cols-2 gap-4 text-xs sm:text-sm">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-xs block">Full Student Name</span>
                <span className="font-extrabold text-slate-900 text-base">{student.name}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-xs block">Roll Number</span>
                <span className="font-extrabold text-slate-900 text-base">#{student.rollNo}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-xs block">Permanent PRN / ID</span>
                <span className="font-bold text-slate-800">{student.prn}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-xs block">Class & Division</span>
                <span className="font-bold text-slate-800">{student.division} (Batch {student.batch})</span>
              </div>

              <div className="col-span-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-xs block">Department</span>
                <span className="font-bold text-slate-900">{departmentName}</span>
              </div>
            </div>

          </div>

          {/* HARDWARE DEVICE BINDING SECURITY BADGE */}
          <div className="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-2">
            <div className="flex items-center space-x-2 text-indigo-950 font-extrabold text-sm">
              <Smartphone className="w-4 h-4 text-indigo-600" />
              <span>1-Student = 1-Mobile Phone Hardware Security Lock</span>
            </div>
            <p className="text-xs text-indigo-900/80 leading-relaxed font-medium">
              🔒 Your student profile is permanently bound to this physical smartphone. Logging into other phones or allowing friends to use this phone for attendance is blocked to prevent proxy marking.
            </p>
            <div className="pt-2 text-[11px] text-slate-500 font-mono flex items-center space-x-2">
              <span>Device Hash:</span>
              <span className="bg-white px-2 py-0.5 rounded border border-indigo-200 text-slate-700">
                {device?.deviceId ? `${device.deviceId.substring(0, 16)}...` : 'LOCKED-TO-PHONE'}
              </span>
              <span className="text-emerald-600 font-bold">● Active Hardware Lock</span>
            </div>
          </div>
        </div>
      )}

      {/* ID CARD FULL PHOTO MODAL */}
      {showIdModal && student.idCardPhoto && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center">
            <h3 className="text-base font-extrabold text-slate-900 mb-3">Verified College ID Card</h3>
            <img src={student.idCardPhoto} alt="Student ID" className="w-full rounded-2xl border border-slate-200 shadow-md mb-4" />
            <button
              onClick={() => setShowIdModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 text-white font-bold text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
