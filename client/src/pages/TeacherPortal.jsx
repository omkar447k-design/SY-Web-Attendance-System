import React, { useState, useEffect } from 'react';
import { Play, Plus, Square, Download, Users, Clock, CheckCircle, RefreshCw, UserPlus, Building2, CheckSquare, Square as SquareIcon } from 'lucide-react';
import { api, getSocket } from '../services/api';
import { TimerRing } from '../components/TimerRing';

const DEPARTMENTS = [
  { id: 'comp', name: 'Computer Science & Engineering', code: 'CSE' },
  { id: 'it', name: 'Information Technology', code: 'IT' },
  { id: 'aids', name: 'Artificial Intelligence & Data Science', code: 'AI&DS' },
  { id: 'entc', name: 'Electronics & Telecommunication', code: 'ENTC' },
  { id: 'elec', name: 'Electrical Engineering', code: 'ELEC' },
  { id: 'instru', name: 'Instrumentation Engineering', code: 'INSTRU' }
];

const DIVISIONS = ['SY-A', 'SY-B', 'SY-C'];

export function TeacherPortal({ teacher }) {
  const [activeSession, setActiveSession] = useState(null);
  const [teacherName, setTeacherName] = useState(teacher.name || 'Faculty Member');
  const [department, setDepartment] = useState(teacher.department || 'entc');
  const [selectedDivisions, setSelectedDivisions] = useState(teacher.divisions || ['SY-A']);
  const [subjectName, setSubjectName] = useState(teacher.subjectName || '');
  const [batch, setBatch] = useState(teacher.batch || 'All');
  const [durationMinutes, setDurationMinutes] = useState(3);
  const [loading, setLoading] = useState(false);
  const [manualRollNo, setManualRollNo] = useState('');

  const loadActiveSession = async () => {
    try {
      const sessRes = await api.getTeacherActiveSession(teacher.id);
      if (sessRes.success && sessRes.active) {
        setActiveSession(sessRes.session);
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.error('Error loading teacher portal session:', err);
    }
  };

  useEffect(() => {
    loadActiveSession();
  }, [teacher.id]);

  // 1. High-Precision 1-Second Timer Engine (Handles Countdown + 10s PIN Ring smoothly)
  useEffect(() => {
    if (!activeSession?.id || !activeSession?.endTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const endTimeMs = new Date(activeSession.endTime).getTime();
      const remainingSec = Math.max(0, Math.ceil((endTimeMs - now) / 1000));

      // Calculate 10s rotating countdown locally (10, 9, 8, ... 1)
      const msIntoSlot = now % 10000;
      const secondsRemainingInSlot = Math.max(1, 10 - Math.floor(msIntoSlot / 1000));

      if (remainingSec <= 0) {
        setActiveSession(prev => prev ? { ...prev, remainingSessionSec: 0, status: 'closed' } : null);
        return;
      }

      setActiveSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          remainingSessionSec: remainingSec,
          pinInfo: {
            ...(prev.pinInfo || {}),
            secondsRemaining: secondsRemainingInSlot
          }
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession?.id, activeSession?.endTime]);

  // 2. High-Frequency Fast Polling (Every 2s) for instant PIN rotation & attendee list updates
  useEffect(() => {
    if (!activeSession?.id) return;

    const poll = async () => {
      try {
        const sessRes = await api.getTeacherActiveSession(teacher.id);
        if (sessRes.success && sessRes.active) {
          setActiveSession(prev => {
            if (!prev) return sessRes.session;
            return {
              ...prev,
              ...sessRes.session,
              pinInfo: {
                ...sessRes.session.pinInfo,
                // Keep local precision seconds remaining
                secondsRemaining: prev.pinInfo?.secondsRemaining || sessRes.session.pinInfo.secondsRemaining
              },
              totalPresent: sessRes.session.totalPresent,
              totalStudents: sessRes.session.totalStudents,
              attendees: sessRes.session.attendees
            };
          });
        } else if (sessRes.success && !sessRes.active) {
          setActiveSession(null);
        }
      } catch (err) {
        console.error('Session poll error:', err);
      }
    };

    const pollInterval = setInterval(poll, 2000);
    return () => clearInterval(pollInterval);
  }, [activeSession?.id, teacher.id]);

  // 3. WebSocket Listener (Works on servers with persistent sockets)
  useEffect(() => {
    const socket = getSocket();
    if (activeSession?.id) {
      socket.emit('join_session', activeSession.id);
    }

    const handlePinTick = (data) => {
      if (activeSession && data.sessionId === activeSession.id) {
        setActiveSession(prev => ({
          ...prev,
          pinInfo: data.pinInfo,
          remainingSessionSec: data.remainingSessionSec,
          totalPresent: data.totalPresent,
          totalStudents: data.totalStudents,
          attendees: data.attendees
        }));
      }
    };

    const handleSessionClosed = () => {
      setActiveSession(null);
    };

    socket.on('pin_tick', handlePinTick);
    socket.on('session_closed', handleSessionClosed);

    return () => {
      if (activeSession?.id) socket.emit('leave_session', activeSession.id);
      socket.off('pin_tick', handlePinTick);
      socket.off('session_closed', handleSessionClosed);
    };
  }, [activeSession?.id]);

  const toggleDivision = (div) => {
    if (selectedDivisions.includes(div)) {
      if (selectedDivisions.length > 1) {
        setSelectedDivisions(selectedDivisions.filter(d => d !== div));
      }
    } else {
      setSelectedDivisions([...selectedDivisions, div]);
    }
  };

  const handleStartSession = async (e) => {
    e.preventDefault();
    if (!subjectName.trim()) return alert('Please enter the Subject Name');
    setLoading(true);

    try {
      const res = await api.startSession({
        teacherId: teacher.id,
        teacherName: teacherName.trim(),
        subjectName: subjectName.trim(),
        department,
        divisions: selectedDivisions,
        batch,
        durationMinutes: Number(durationMinutes)
      });

      if (res.success) {
        setActiveSession(res.session);
      }
    } catch (err) {
      alert(err.message || 'Failed to start session');
    } finally {
      setLoading(false);
    }
  };

  const handleExtend = async (mins) => {
    if (!activeSession) return;
    try {
      const res = await api.extendSession(activeSession.id, mins);
      if (res.success) {
        setActiveSession(prev => ({
          ...prev,
          endTime: res.session.endTime,
          remainingSessionSec: res.remainingSessionSec,
          durationMinutes: res.session.durationMinutes
        }));
      }
    } catch (err) {
      alert(err.message || 'Failed to extend session');
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    if (!window.confirm('Are you sure you want to conclude this attendance session?')) return;

    try {
      const res = await api.endSession(activeSession.id);
      if (res.success) {
        window.open(api.getSessionExcelUrl(activeSession.id), '_blank');
        setActiveSession(null);
      }
    } catch (err) {
      alert(err.message || 'Failed to end session');
    }
  };

  const handleManualMark = async (e) => {
    e.preventDefault();
    if (!manualRollNo || !activeSession) return;

    try {
      const res = await api.manualMarkAttendance(activeSession.id, manualRollNo);
      if (res.success) {
        setManualRollNo('');
        loadActiveSession();
      }
    } catch (err) {
      alert(err.message || 'Could not mark student');
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const deptObj = DEPARTMENTS.find(d => d.id === department);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      
      {/* Teacher Profile Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Faculty In-Charge</span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">{teacherName}</h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium flex items-center space-x-1.5">
            <Building2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>{deptObj?.name || department.toUpperCase()} • SY Lecture Portal</span>
          </p>
        </div>

        {activeSession && (
          <div className="flex items-center space-x-2">
            <a
              href={api.getSessionExcelUrl(activeSession.id)}
              download
              className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-100 transition active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Export Lecture Sheet (.xlsx)</span>
            </a>
          </div>
        )}
      </div>

      {/* ACTIVE SESSION PROJECTOR SCREEN */}
      {activeSession ? (
        <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-10 shadow-2xl border border-slate-800">
          
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            
            {/* Left: Glowing PIN Display */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-3 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Classroom Attendance Active</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                {activeSession.subjectName}
              </h1>
              <p className="text-slate-300 text-sm mt-1">
                Class / Divisions: <span className="text-indigo-300 font-extrabold text-base bg-indigo-950/80 px-2.5 py-0.5 rounded-lg border border-indigo-500/40">{activeSession.division}</span>
                {activeSession.batch !== 'All' ? ` • Batch: ${activeSession.batch}` : ''}
              </p>

              {/* GIANT PIN BOX */}
              <div className="my-6 inline-flex flex-col items-center p-6 sm:p-8 rounded-3xl bg-slate-950 border-2 border-indigo-500/80 shadow-2xl shadow-indigo-500/20">
                <span className="text-xs uppercase font-extrabold tracking-widest text-slate-400 mb-2">
                  CLASSROOM ACTIVE PIN (ROTATES IN 10s)
                </span>
                
                <div className="flex items-center space-x-3 sm:space-x-5">
                  {String(activeSession?.pinInfo?.pin || '8492').split('').map((digit, idx) => (
                    <div
                      key={idx}
                      className="w-16 h-20 sm:w-20 sm:h-24 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-indigo-400/80 flex items-center justify-center text-4xl sm:text-6xl font-black text-white shadow-xl shadow-indigo-500/30 transition-all transform hover:scale-105"
                    >
                      {digit}
                    </div>
                  ))}
                </div>

                {/* 10-Second Timer Ring */}
                <div className="flex items-center space-x-3 mt-4">
                  <TimerRing
                    secondsRemaining={activeSession?.pinInfo?.secondsRemaining || 10}
                    totalSeconds={10}
                    size={46}
                    stroke={4}
                  />
                  <span className="text-xs text-slate-400 font-semibold">
                    New PIN in <span className="text-indigo-400 font-bold">{activeSession?.pinInfo?.secondsRemaining || 10}s</span>...
                  </span>
                </div>
              </div>

              {/* Timer Controls */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mt-2">
                <div className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-extrabold text-sm">
                  <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span>Session Window: <span className="font-mono text-amber-300">{formatTime(activeSession.remainingSessionSec || 0)}</span></span>
                </div>

                <button
                  onClick={() => handleExtend(1)}
                  className="flex items-center space-x-1 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-bold border border-slate-700 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+1 Min</span>
                </button>

                <button
                  onClick={() => handleExtend(2)}
                  className="flex items-center space-x-1 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-bold border border-slate-700 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+2 Mins</span>
                </button>

                <button
                  onClick={handleEndSession}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Lock & End Session</span>
                </button>
              </div>
            </div>

            {/* Right: Live Attendee Stats */}
            <div className="w-full lg:w-80 bg-slate-950/80 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between">
              <div className="text-center pb-4 border-b border-slate-800">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Total Verified Present</span>
                <div className="text-5xl font-black text-emerald-400 mt-1">
                  {activeSession.totalPresent || 0}
                  <span className="text-lg text-slate-500 font-bold"> / {activeSession.totalStudents || 60}</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Target: Divisions <span className="text-indigo-300 font-bold">{activeSession.division}</span>
                </div>
              </div>

              {/* Manual Mark Input */}
              <form onSubmit={handleManualMark} className="mt-4">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Manual Override (Dead Battery)
                </label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={manualRollNo}
                    onChange={(e) => setManualRollNo(e.target.value)}
                    placeholder="Roll No"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </form>
            </div>

          </div>

          {/* LIVE ATTENDEE ROSTER GRID */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center space-x-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Live Attendance Feed (Updating in Real-Time)</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-60 overflow-y-auto pr-1">
              {activeSession.attendees?.map((att) => (
                <div
                  key={att.id}
                  className="p-2.5 rounded-xl bg-slate-800/90 border border-emerald-500/40 flex items-center space-x-2 shadow-sm"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 font-extrabold text-xs flex items-center justify-center">
                    {att.rollNo}
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-bold text-white text-xs truncate">{att.studentName}</p>
                    <p className="text-[10px] text-indigo-300">{att.division} • {new Date(att.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      ) : (
        /* LAUNCH NEW SESSION FORM WITH MULTI-DIVISION CHECKBOXES */
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3 border border-indigo-100">
              <Play className="w-6 h-6 fill-indigo-600" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900">Start Lecture Attendance</h3>
            <p className="text-slate-500 text-xs mt-0.5 font-medium">Launches the 10-second rotating PIN on screen for students.</p>
          </div>

          <form onSubmit={handleStartSession} className="space-y-4">
            
            {/* Department Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-semibold focus:border-indigo-600 outline-none"
              >
                {DEPARTMENTS.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* MULTI-DIVISION CHECKBOXES */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Target Class / Division(s)
                </label>
                <span className="text-[11px] text-indigo-600 font-bold">
                  {selectedDivisions.length > 1 ? `Combined (${selectedDivisions.join(' + ')})` : 'Single Division'}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                {DIVISIONS.map(div => {
                  const isChecked = selectedDivisions.includes(div);
                  return (
                    <button
                      key={div}
                      type="button"
                      onClick={() => toggleDivision(div)}
                      className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold border transition-all flex items-center justify-center space-x-1.5 ${
                        isChecked
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-white" />
                      ) : (
                        <SquareIcon className="w-4 h-4 text-slate-400" />
                      )}
                      <span>{div}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Subject Name Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Subject / Lecture Name
              </label>
              <input
                type="text"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                placeholder="Enter Subject Name (e.g. Digital Signal Processing)"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-bold focus:border-indigo-600 outline-none"
                required
              />
            </div>

            {/* Batch Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Batch
              </label>
              <select
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-semibold focus:border-indigo-600 outline-none"
              >
                <option value="All">All Batches (Theory Lecture)</option>
                <option value="B1">Batch B1 (Practical Lab)</option>
                <option value="B2">Batch B2 (Practical Lab)</option>
                <option value="B3">Batch B3 (Practical Lab)</option>
              </select>
            </div>

            {/* Attendance Duration */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Attendance Window Duration
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[2, 3, 5, 10].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationMinutes(mins)}
                    className={`py-2.5 rounded-xl text-xs font-extrabold border transition ${
                      durationMinutes === mins
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {mins} Mins
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm shadow-lg shadow-indigo-200 flex items-center justify-center space-x-2 transition active:scale-[0.98]"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Launch Attendance Session</span>
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
