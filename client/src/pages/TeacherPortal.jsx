import React, { useState, useEffect } from 'react';
import { Play, Plus, Square, Download, Users, Clock, CheckCircle, RefreshCw, UserPlus, Building2, CheckSquare, Square as SquareIcon, CheckCircle2, FileSpreadsheet, X } from 'lucide-react';
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

function exportSessionReportLocally(sessionData) {
  if (!sessionData) return;
  const attendees = sessionData.attendees || [];
  const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  const filename = `Attendance_${(sessionData.subjectName || 'Lecture').replace(/[^a-zA-Z0-9]/g, '_')}_${(sessionData.division || 'SY').replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.csv`;

  let csvContent = `\uFEFF` +
    `ATTENDANCE REPORT - ${(sessionData.subjectName || 'Lecture').toUpperCase()}\n` +
    `Teacher: ${sessionData.teacherName || 'Faculty'}, Department: ${(sessionData.department || 'ENTC').toUpperCase()}, Class/Division: ${sessionData.division || 'SY-A'}, Batch: ${sessionData.batch || 'All'}\n` +
    `Session Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n` +
    `Total Verified Present: ${attendees.length} / ${sessionData.totalStudents || 80}\n\n` +
    `Sr No,Roll No,PRN,Student Name,Division,Timestamp,Status\n`;

  attendees.forEach((att, idx) => {
    const time = att.timestamp ? new Date(att.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    csvContent += `${idx + 1},${att.rollNo || ''},"${att.prn || ''}","${att.studentName || ''}",${att.division || ''},${time},PRESENT\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

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
  
  // Completed Session Summary Modal State
  const [completedSummary, setCompletedSummary] = useState(null);

  const loadActiveSession = async () => {
    try {
      const sessRes = await api.getTeacherActiveSession(teacher.id);
      if (sessRes.success && sessRes.active) {
        setActiveSession(sessRes.session);
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.warn('Teacher active session check:', err.message);
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

  // 2. Fast Polling (Every 2s) for instant PIN rotation & attendee list updates
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
        console.warn('Session sync poll:', err.message);
      }
    };

    const pollInterval = setInterval(poll, 2000);
    return () => clearInterval(pollInterval);
  }, [activeSession?.id, teacher.id]);

  // 3. WebSocket Listener
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
      const sessionToSave = { ...activeSession };
      const res = await api.endSession(activeSession.id);
      
      // Auto-trigger direct CSV download for teacher
      exportSessionReportLocally(sessionToSave);

      // Show clean summary dialog
      setCompletedSummary({
        subjectName: sessionToSave.subjectName,
        division: sessionToSave.division,
        batch: sessionToSave.batch,
        totalPresent: sessionToSave.totalPresent || (sessionToSave.attendees?.length || 0),
        totalStudents: sessionToSave.totalStudents || (80 * (sessionToSave.divisions?.length || 1)),
        attendees: sessionToSave.attendees || [],
        sessionData: sessionToSave
      });

      setActiveSession(null);
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5 sm:space-y-6">
      
      {/* Teacher Profile Bar (Clean Institutional White Card) */}
      <div className="bg-white border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <span className="text-xs font-bold uppercase tracking-wider text-sky-600">Faculty In-Charge</span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{teacherName}</h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium flex items-center space-x-1.5 truncate">
            <Building2 className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
            <span className="truncate">{deptObj?.name || department.toUpperCase()} • Lecture Portal</span>
          </p>
        </div>

        {activeSession && (
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={() => exportSessionReportLocally(activeSession)}
              className="w-full sm:w-auto flex items-center justify-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider transition active:scale-95 touch-target"
            >
              <Download className="w-4 h-4 flex-shrink-0" />
              <span>Export Attendance Sheet</span>
            </button>
          </div>
        )}
      </div>

      {/* ACTIVE SESSION PROJECTOR SCREEN */}
      {activeSession ? (
        <div className="bg-slate-950 text-white p-5 sm:p-10 border border-slate-800 shadow-xl">
          
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 sm:gap-8">
            
            {/* Left: PIN Display */}
            <div className="flex-1 text-center lg:text-left w-full">
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/10 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3 border border-white/15">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Classroom Attendance Active</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight break-words">
                {activeSession.subjectName}
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm mt-1 font-medium">
                Class / Divisions: <span className="text-white font-bold px-2 py-0.5 bg-white/10 border border-white/20">{activeSession.division}</span>
                {activeSession.batch !== 'All' ? ` • Batch: ${activeSession.batch}` : ''}
              </p>

              {/* GIANT PIN BOX */}
              <div className="my-5 sm:my-6 inline-flex flex-col items-center p-5 sm:p-8 bg-black/60 border border-white/20 max-w-full">
                <span className="text-xs uppercase font-bold tracking-widest text-slate-400 mb-3 text-center">
                  CLASSROOM ACTIVE PIN (ROTATES IN 10s)
                </span>
                
                <div className="flex items-center space-x-2 sm:space-x-4 max-w-full justify-center">
                  {String(activeSession?.pinInfo?.pin || '8492').split('').map((digit, idx) => (
                    <div
                      key={idx}
                      className="w-12 h-16 sm:w-20 sm:h-24 bg-white text-slate-950 border border-white flex items-center justify-center text-3xl sm:text-6xl font-black shadow-inner"
                    >
                      {digit}
                    </div>
                  ))}
                </div>

                {/* 10-Second Timer Ring */}
                <div className="flex items-center space-x-2.5 mt-4">
                  <TimerRing
                    secondsRemaining={activeSession?.pinInfo?.secondsRemaining || 10}
                    totalSeconds={10}
                    size={36}
                    stroke={3.5}
                  />
                  <span className="text-xs text-slate-300 font-medium">
                    New PIN in <span className="text-sky-400 font-bold">{activeSession?.pinInfo?.secondsRemaining || 10}s</span>...
                  </span>
                </div>
              </div>

              {/* Timer Controls */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 mt-2">
                <div className="flex items-center space-x-2 px-3.5 py-2 bg-white/10 border border-white/20 text-white font-bold text-xs sm:text-sm">
                  <Clock className="w-4 h-4 text-sky-400 flex-shrink-0" />
                  <span>Session: <span className="font-mono text-sky-300">{formatTime(activeSession.remainingSessionSec || 0)}</span></span>
                </div>

                <button
                  onClick={() => handleExtend(1)}
                  className="flex items-center space-x-1 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase border border-white/20 transition touch-target"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+1 Min</span>
                </button>

                <button
                  onClick={() => handleExtend(2)}
                  className="flex items-center space-x-1 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase border border-white/20 transition touch-target"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+2 Mins</span>
                </button>

                <button
                  onClick={handleEndSession}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider transition touch-target"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>End Session</span>
                </button>
              </div>
            </div>

            {/* Right: Live Attendee Stats */}
            <div className="w-full lg:w-80 bg-white/5 border border-white/15 p-5 sm:p-6 flex flex-col justify-between">
              <div className="text-center pb-4 border-b border-white/15">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Verified Present</span>
                <div className="text-4xl sm:text-5xl font-black text-white mt-1">
                  {activeSession.totalPresent || 0}
                  <span className="text-base sm:text-lg text-slate-400 font-normal"> / {activeSession.totalStudents || (80 * (activeSession.divisions?.length || 1))}</span>
                </div>
                <div className="text-xs text-slate-400 mt-1 font-medium">
                  Divisions: <span className="text-sky-300 font-bold">{activeSession.division}</span>
                </div>
              </div>

              {/* Manual Mark Input */}
              <form onSubmit={handleManualMark} className="mt-4">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Manual Override (Dead Battery)
                </label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={manualRollNo}
                    onChange={(e) => setManualRollNo(e.target.value)}
                    placeholder="Roll No"
                    className="w-full bg-white/10 border border-white/30 px-3 py-2 text-base sm:text-xs text-white font-bold outline-none focus:border-white min-h-[40px]"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold uppercase flex items-center space-x-1 touch-target flex-shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </form>
            </div>

          </div>

          {/* LIVE ATTENDEE ROSTER GRID */}
          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-white/15">
            <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center space-x-2">
              <Users className="w-4 h-4 text-sky-400 flex-shrink-0" />
              <span>Live Attendance Feed (Updating in Real-Time)</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-56 overflow-y-auto pr-1">
              {activeSession.attendees?.map((att) => (
                <div
                  key={att.id}
                  className="p-2 bg-white/10 border border-white/15 flex items-center space-x-2 min-w-0"
                >
                  <div className="w-6 h-6 bg-white text-slate-900 font-bold text-xs flex items-center justify-center flex-shrink-0">
                    {att.rollNo}
                  </div>
                  <div className="overflow-hidden min-w-0 flex-1">
                    <p className="font-semibold text-white text-xs truncate">{att.studentName}</p>
                    <p className="text-[10px] text-slate-400 truncate">{att.division} • {new Date(att.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      ) : (
        /* LAUNCH NEW SESSION FORM (Clean Institutional Form) */
        <div className="bg-white border border-slate-200 p-6 sm:p-8 shadow-sm max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <Play className="w-8 h-8 text-slate-800 mx-auto mb-2 stroke-[1.5]" />
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">Start Lecture Attendance</h3>
            <p className="text-slate-500 text-xs mt-0.5">Launches the 10-second rotating PIN on screen for students.</p>
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
                className="w-full bg-white border border-slate-300 px-3.5 py-2.5 text-base sm:text-sm text-slate-900 font-semibold focus:border-slate-800 outline-none min-h-[44px]"
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
                <span className="text-xs text-sky-700 font-semibold">
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
                      className={`py-2.5 px-3 text-xs sm:text-sm font-bold border transition flex items-center justify-center space-x-1.5 touch-target ${
                        isChecked
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-white flex-shrink-0" />
                      ) : (
                        <SquareIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
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
                className="w-full bg-white border border-slate-300 px-3.5 py-2.5 text-base sm:text-sm text-slate-900 font-semibold focus:border-slate-800 outline-none min-h-[44px]"
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
                className="w-full bg-white border border-slate-300 px-3.5 py-2.5 text-base sm:text-sm text-slate-900 font-semibold focus:border-slate-800 outline-none min-h-[44px]"
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
                    className={`py-2 text-xs font-bold border transition touch-target flex items-center justify-center ${
                      durationMinutes === mins
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm tracking-wider uppercase flex items-center justify-center space-x-2 transition active:scale-[0.98] min-h-[48px] touch-target"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Launch Attendance Session</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LECTURE CONCLUDED SUMMARY MODAL */}
      {completedSummary && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 p-6 sm:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">Attendance Session Concluded</h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">Lecture attendance has been locked and archived.</p>

            <div className="p-4 bg-slate-50 border border-slate-200 text-left space-y-2 mb-5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Subject:</span>
                <span className="font-bold text-slate-900">{completedSummary.subjectName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Divisions:</span>
                <span className="font-bold text-slate-900">{completedSummary.division}</span>
              </div>
              <div className="flex justify-between text-xs border-t border-slate-200 pt-2">
                <span className="text-slate-600 font-semibold">Total Verified Present:</span>
                <span className="font-extrabold text-emerald-700">{completedSummary.totalPresent} / {completedSummary.totalStudents}</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => exportSessionReportLocally(completedSummary.sessionData)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition touch-target"
              >
                <Download className="w-4 h-4" />
                <span>Download Report (.csv / Excel)</span>
              </button>

              <button
                onClick={() => setCompletedSummary(null)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 transition touch-target"
              >
                Start Next Lecture
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
