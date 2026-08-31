import React, { useState, useEffect } from 'react';
import { Clock, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, User, Smartphone, Building2, BookOpen } from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import { PinInput } from '../components/PinInput';

export function StudentPortal({ student, device }) {
  const [activeSession, setActiveSession] = useState(null);
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('attendance');

  const refreshData = async () => {
    try {
      if (student && student.id && student.activeSessionToken) {
        const verifyRes = await api.verifyStudentSession(student.id, student.activeSessionToken);
        if (verifyRes && !verifyRes.valid) {
          alert('🛑 Session Expired: This account was logged in from another device or reset by your HOD. Logging out.');
          window.location.reload();
          return;
        }
      }

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
    const interval = setInterval(refreshData, 4000);
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
        studentName: student.name,
        prn: student.prn,
        department: student.department,
        division: student.division,
        batch: student.batch || 'All',
        sessionId: activeSession.id,
        enteredPin: pinToSubmit,
        pin: pinToSubmit,
        deviceId: device?.deviceId,
        fingerprint: device?.fingerprint
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
      } else {
        setSubmitError(res.error || 'Failed to submit attendance');
      }
    } catch (err) {
      setSubmitError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
      setPin('');
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4 sm:space-y-5">
      
      {/* Student Profile Card (Clean Institutional White Card) */}
      <div className="bg-white border border-slate-200 p-5 sm:p-6 shadow-sm">
        <div className="flex items-center space-x-3.5 sm:space-x-4">
          {student.idCardPhoto ? (
            <div className="relative flex-shrink-0">
              <img
                src={student.idCardPhoto}
                alt="ID"
                className="w-14 h-14 sm:w-16 sm:h-16 object-cover border border-slate-300 shadow-sm"
              />
              <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white p-0.5 border-2 border-white">
                <CheckCircle2 className="w-3 h-3" />
              </div>
            </div>
          ) : (
            <div className="w-14 h-14 bg-slate-900 text-white flex items-center justify-center font-bold text-lg flex-shrink-0">
              #{student.rollNo}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">{student.name}</h2>
              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 flex-shrink-0">
                {student.division}
              </span>
            </div>
            
            <p className="text-xs text-slate-500 mt-0.5 font-medium flex items-center space-x-1 truncate">
              <Building2 className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
              <span className="truncate">{(student.department || 'ENTC').toUpperCase()} • Roll #{student.rollNo}</span>
            </p>
          </div>
        </div>

        {/* Navigation / Tabs */}
        <div className="mt-4 pt-3.5 border-t border-slate-200 flex items-center justify-between gap-2">
          <div className="flex space-x-1.5">
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-3.5 py-1.5 text-xs font-bold transition touch-target ${
                activeTab === 'attendance'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Mark Attendance
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`px-3.5 py-1.5 text-xs font-bold transition touch-target ${
                activeTab === 'profile'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              My Profile 🔒
            </button>
          </div>

          <button
            onClick={refreshData}
            className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition touch-target"
            title="Refresh Status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TAB 1: ATTENDANCE PLATFORM */}
      {activeTab === 'attendance' && (
        <>
          {activeSession ? (
            /* ACTIVE ATTENDANCE LIVE CARD */
            <div className="bg-white border border-slate-200 p-5 sm:p-7 shadow-sm text-center space-y-4">
              
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active Classroom Session</span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900">{activeSession.subjectName}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Faculty: <span className="font-semibold text-slate-700">{activeSession.teacherName}</span></p>
              </div>

              {submitSuccess ? (
                <div className="p-5 bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <h4 className="font-bold text-sm">Attendance Verified!</h4>
                  <p className="text-xs text-emerald-700">You are marked Present for this lecture session.</p>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 text-left">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 text-center">
                      Enter 4-Digit Rotating PIN from Projector Screen
                    </label>
                    
                    <PinInput
                      value={pin}
                      onChange={setPin}
                      onComplete={handlePinSubmit}
                      disabled={submitting}
                      length={4}
                    />
                  </div>

                  {submitError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center space-x-1.5 text-left">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <button
                    onClick={() => handlePinSubmit(pin)}
                    disabled={submitting || pin.length !== 4}
                    className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition active:scale-[0.98] min-h-[46px] touch-target"
                  >
                    {submitting ? 'Verifying...' : 'Submit Attendance PIN'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* NO ACTIVE SESSION STATE */
            <div className="bg-white border border-slate-200 p-8 sm:p-10 shadow-sm text-center space-y-3">
              <Clock className="w-10 h-10 text-slate-400 mx-auto stroke-[1.5]" />
              <h3 className="text-base sm:text-lg font-bold text-slate-800">No Active Attendance Session</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                When your professor starts attendance for {student.division} ({student.department?.toUpperCase() || 'ENTC'}), the PIN entry platform will open here automatically.
              </p>
              
              <div className="pt-2 inline-flex items-center space-x-1.5 text-xs text-slate-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Auto-monitoring live session status</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: VERIFIED ID PROFILE */}
      {activeTab === 'profile' && (
        <div className="bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-3.5">
          <div className="pb-2.5 border-b border-slate-200">
            <h3 className="text-sm sm:text-base font-bold text-slate-900">Verified Student Profile</h3>
            <p className="text-xs text-slate-500">Hardware-bound college identity</p>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Full Name:</span>
              <span className="font-bold text-slate-900">{student.name}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-medium">PRN / Enrollment:</span>
              <span className="font-mono font-bold text-slate-900">{student.prn}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Roll Number:</span>
              <span className="font-bold text-slate-900">#{student.rollNo}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Class / Division:</span>
              <span className="font-bold text-slate-900">{student.division}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500 font-medium">Phone Security:</span>
              <span className="font-bold text-emerald-700">🔒 1-Device Hardware Lock Active</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
