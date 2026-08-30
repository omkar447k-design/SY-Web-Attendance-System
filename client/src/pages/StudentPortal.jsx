import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, Clock, ShieldCheck, RefreshCw, Building2, User, Smartphone, Shield, Lock, ExternalLink, Hash, Check } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('attendance');
  const [activeSession, setActiveSession] = useState(null);
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showIdModal, setShowIdModal] = useState(false);

  const refreshData = async () => {
    try {
      const sessRes = await api.getStudentActiveSession(student.division, student.id, student.department);
      if (sessRes.success && sessRes.hasActiveSession) {
        setActiveSession(sessRes.session);
        if (sessRes.session.alreadyMarked) {
          setSubmitSuccess('You are marked Present for this lecture session.');
        }
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.warn('Student session check:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 3000);
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
            particleCount: 60,
            spread: 60,
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

  const departmentName = DEPT_NAMES[student.department] || 'Electronics & Telecommunication';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5 sm:space-y-6">
      
      {/* Student Welcome Header Card */}
      <div className="bg-white border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5 min-w-0 w-full sm:w-auto">
          <div className="relative flex-shrink-0">
            {student.idCardPhoto ? (
              <img
                src={student.idCardPhoto}
                alt="ID Badge"
                onClick={() => setShowIdModal(true)}
                className="w-12 h-12 sm:w-14 sm:h-14 object-cover border border-slate-300 cursor-pointer hover:opacity-90 transition"
                title="Click to view verified ID Card"
              />
            ) : (
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-800 text-base sm:text-lg font-bold">
                #{student.rollNo}
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-600 text-white flex items-center justify-center text-[9px] font-bold border border-white" title="Verified ID">
              ✓
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">{student.name}</h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 flex-shrink-0">
                {student.division} • {student.batch}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center space-x-1.5 font-medium truncate">
              <Building2 className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
              <span className="truncate">{departmentName}</span>
              <span className="flex-shrink-0">• Roll #{student.rollNo}</span>
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
          <div className="flex bg-slate-100 p-0.5 border border-slate-200 flex-1 sm:flex-none">
            <button
              onClick={() => setActiveTab('attendance')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 text-xs font-bold transition touch-target flex items-center justify-center ${
                activeTab === 'attendance'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mark Attendance
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 text-xs font-bold transition touch-target flex items-center justify-center ${
                activeTab === 'profile'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My Profile 🔒
            </button>
          </div>

          <button
            onClick={refreshData}
            className="p-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition touch-target flex items-center justify-center flex-shrink-0"
            title="Refresh Attendance Status"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* VIEW 1: ATTENDANCE MARKING PLATFORM ONLY */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          
          {activeSession ? (
            /* ACTIVE CLASS ATTENDANCE CARD */
            <div className="bg-slate-900 text-white p-5 sm:p-8 border border-slate-800 text-center relative shadow-md">
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/10 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3 border border-white/15">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Active Attendance Session</span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight px-2">
                {activeSession.subjectName}
              </h3>
              
              <div className="flex flex-wrap items-center justify-center gap-2 text-slate-300 text-xs sm:text-sm mt-2 font-medium">
                {activeSession.teacherName && (
                  <span className="flex items-center space-x-1 bg-white/5 px-2.5 py-1 border border-white/10">
                    <User className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                    <span className="truncate">{activeSession.teacherName}</span>
                  </span>
                )}
                <span className="bg-white/5 px-2.5 py-1 border border-white/10">
                  Divisions: <span className="text-white font-bold">{activeSession.division}</span>
                </span>
                {activeSession.batch !== 'All' && (
                  <span className="bg-white/5 px-2.5 py-1 border border-white/10">
                    Batch: {activeSession.batch}
                  </span>
                )}
              </div>

              {submitSuccess || activeSession.alreadyMarked ? (
                <div className="my-5 p-5 bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 max-w-sm mx-auto">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
                  <p className="font-bold text-base text-white">Attendance Confirmed</p>
                  <p className="text-xs text-emerald-300 mt-1">You are marked Present for this lecture session.</p>
                </div>
              ) : (
                <div className="my-5 max-w-sm mx-auto bg-white/5 p-5 border border-white/15">
                  <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Enter the 4-digit PIN on Projector:
                  </p>

                  <PinInput
                    length={4}
                    onComplete={handlePinSubmit}
                    disabled={submitting}
                  />

                  {submitError && (
                    <p className="text-xs text-rose-300 font-semibold mt-2 bg-rose-950/80 py-2 px-3 border border-rose-600/50">
                      ⚠️ {submitError}
                    </p>
                  )}

                  <p className="text-[11px] text-slate-400 mt-2.5 font-medium">
                    ⏱️ PIN rotates every 10 seconds. Enter active PIN displayed on screen.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* NO ACTIVE SESSION WAITING STATE (CLEAN STANDALONE CLOCK, NO BLACK BOX) */
            <div className="bg-white border border-slate-200 p-8 sm:p-12 text-center text-slate-500 shadow-sm">
              <Clock className="w-10 h-10 text-slate-400 mx-auto mb-3 stroke-[1.5]" />
              <h4 className="font-bold text-slate-900 text-base sm:text-lg">No Active Attendance Session</h4>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
                When your professor starts attendance for <span className="font-semibold text-slate-800">{student.division} ({departmentName})</span>, the PIN entry platform will open here automatically.
              </p>
              <div className="mt-4 inline-flex items-center space-x-1.5 px-3 py-1 bg-slate-50 text-slate-600 text-xs font-medium border border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Auto-monitoring live session status</span>
              </div>
            </div>
          )}

        </div>
      )}

      {/* VIEW 2: DEDICATED STUDENT PROFILE ONLY */}
      {activeTab === 'profile' && (
        <div className="bg-white border border-slate-200 p-5 sm:p-8 shadow-sm space-y-5 sm:space-y-6">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-200">
            <div className="min-w-0 pr-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-600">Student Identity</span>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">Academic Profile</h3>
              <p className="text-xs text-slate-500 mt-0.5">Verified via Physical College ID Card</p>
            </div>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center space-x-1 flex-shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            
            {/* ID Card Photo Preview */}
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 text-center">
              {student.idCardPhoto ? (
                <div>
                  <img
                    src={student.idCardPhoto}
                    alt="Physical ID Card"
                    onClick={() => setShowIdModal(true)}
                    className="w-36 h-24 sm:w-40 sm:h-28 object-cover border border-slate-300 shadow-sm cursor-pointer hover:opacity-90 transition mx-auto mb-2"
                  />
                  <button
                    onClick={() => setShowIdModal(true)}
                    className="text-xs font-bold text-sky-600 hover:text-sky-800 flex items-center justify-center space-x-1 mx-auto touch-target"
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
            <div className="md:col-span-2 grid grid-cols-1 xs:grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className="p-3 bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[11px] font-medium block">Full Student Name</span>
                <span className="font-bold text-slate-900 text-sm break-words">{student.name}</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[11px] font-medium block">Roll Number</span>
                <span className="font-bold text-slate-900 text-sm">#{student.rollNo}</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[11px] font-medium block">Permanent PRN / ID</span>
                <span className="font-mono font-semibold text-slate-800 break-all">{student.prn}</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[11px] font-medium block">Class & Division</span>
                <span className="font-semibold text-slate-800">{student.division} (Batch {student.batch})</span>
              </div>

              <div className="col-span-1 xs:col-span-2 p-3 bg-slate-50 border border-slate-200">
                <span className="text-slate-400 text-[11px] font-medium block">Department</span>
                <span className="font-semibold text-slate-900 break-words">{departmentName}</span>
              </div>
            </div>

          </div>

          {/* HARDWARE DEVICE BINDING SECURITY BADGE */}
          <div className="p-4 bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs sm:text-sm">
              <Smartphone className="w-4 h-4 text-sky-600 flex-shrink-0" />
              <span>Hardware Device Lock Active</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              This student account is permanently bound to this physical mobile phone. Proxy attendance from other devices is blocked.
            </p>
            <div className="pt-1 text-[11px] text-slate-500 font-mono flex items-center space-x-2 flex-wrap gap-1">
              <span>Device ID:</span>
              <span className="bg-white px-2 py-0.5 border border-slate-200 text-slate-700 font-semibold break-all">
                {device?.deviceId ? `${device.deviceId.substring(0, 16)}...` : 'PHONE-BOUND'}
              </span>
              <span className="text-emerald-600 font-bold">● Active</span>
            </div>
          </div>
        </div>
      )}

      {/* ID CARD FULL PHOTO MODAL */}
      {showIdModal && student.idCardPhoto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 p-5 max-w-sm w-full max-h-[90vh] overflow-y-auto text-center shadow-xl">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Verified College ID Card</h3>
            <img src={student.idCardPhoto} alt="Student ID" className="w-full max-h-[60vh] object-contain border border-slate-200 mb-3" />
            <button
              onClick={() => setShowIdModal(false)}
              className="w-full py-2 bg-slate-900 text-white font-bold text-xs transition hover:bg-slate-800"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
