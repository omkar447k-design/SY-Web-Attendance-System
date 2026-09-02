import React, { useState, useEffect } from 'react';
import { Play, Plus, Square, Download, Users, Clock, CheckCircle, RefreshCw, UserPlus, Building2, CheckSquare, Square as SquareIcon, CheckCircle2, FileSpreadsheet, X, ArrowLeft, BookOpen, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { api, getRotatingPinForSession } from '../services/api';
import { TimerRing } from '../components/TimerRing';
import { exportLectureExcelFile } from '../services/excelExport';

const DEPARTMENTS = [
  { id: 'comp', name: 'Computer Science & Engineering', code: 'CSE' },
  { id: 'it', name: 'Information Technology', code: 'IT' },
  { id: 'aids', name: 'Artificial Intelligence & Data Science', code: 'AI&DS' },
  { id: 'entc', name: 'Electronics & Telecommunication', code: 'ENTC' },
  { id: 'elec', name: 'Electrical Engineering', code: 'ELEC' },
  { id: 'instru', name: 'Instrumentation Engineering', code: 'INSTRU' }
];

const DIVISIONS = ['SY-A', 'SY-B', 'SY-C'];

export function TeacherPortal({ teacher, onBack }) {
  const [activeSession, setActiveSession] = useState(null);
  const [teacherName, setTeacherName] = useState(teacher.name || 'Faculty Member');
  const [department, setDepartment] = useState(teacher.department || 'entc');
  const [selectedDivisions, setSelectedDivisions] = useState(teacher.divisions || ['SY-A']);
  const [subjectName, setSubjectName] = useState(teacher.subjectName || '');
  const [batch, setBatch] = useState(teacher.batch || 'All');
  const [durationMinutes, setDurationMinutes] = useState(3);
  const [loading, setLoading] = useState(false);
  const [manualRollNo, setManualRollNo] = useState('');
  
  // Tab State: 'launch' | 'history'
  const [activeTab, setActiveTab] = useState('launch');
  const [conductedLectures, setConductedLectures] = useState([]);
  const [expandedLectureId, setExpandedLectureId] = useState(null);

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

  const loadConductedLectures = async () => {
    try {
      const res = await api.getConductedLectures(department);
      if (res.success && Array.isArray(res.data)) {
        const myNameClean = (teacherName || teacher.name || '').trim().toLowerCase();
        const myId = teacher.id;

        // Strictly filter to lectures conducted ONLY by this faculty member
        const myLecturesOnly = res.data.filter(l => {
          if (!l) return false;
          const lectTeacher = (l.teacherName || '').trim().toLowerCase();
          const matchesId = l.teacherId && myId && l.teacherId === myId;
          const matchesName = lectTeacher && myNameClean && (
            lectTeacher === myNameClean ||
            lectTeacher.includes(myNameClean) ||
            myNameClean.includes(lectTeacher)
          );
          return matchesId || matchesName;
        });

        setConductedLectures(myLecturesOnly);
      }
    } catch (err) {
      console.warn('Teacher conducted lectures check:', err.message);
    }
  };

  useEffect(() => {
    loadActiveSession();
    loadConductedLectures();
  }, [teacher.id, department]);

  // 1. High-Precision 1-Second Timer Engine with dynamic PIN calculation
  useEffect(() => {
    if (!activeSession?.id || !activeSession?.endTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const endTimeMs = new Date(activeSession.endTime).getTime();
      const remainingSec = Math.max(0, Math.ceil((endTimeMs - now) / 1000));

      if (remainingSec <= 0) {
        setActiveSession(prev => prev ? { ...prev, remainingSessionSec: 0, status: 'closed' } : null);
        loadConductedLectures();
        return;
      }

      const { pin, secondsRemaining } = getRotatingPinForSession(activeSession, now);

      setActiveSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          remainingSessionSec: remainingSec,
          pinInfo: {
            pin,
            secondsRemaining
          }
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession?.id, activeSession?.endTime]);

  // 2. Fast Polling (Every 3s) for attendee list updates
  useEffect(() => {
    if (!activeSession?.id) return;

    const poll = async () => {
      try {
        const sessRes = await api.getTeacherActiveSession(teacher.id);
        if (sessRes.success && sessRes.active) {
          setActiveSession(prev => {
            if (!prev) return sessRes.session;
            const { pin, secondsRemaining } = getRotatingPinForSession(sessRes.session, Date.now());
            return {
              ...prev,
              ...sessRes.session,
              pinInfo: {
                pin,
                secondsRemaining: prev.pinInfo?.secondsRemaining || secondsRemaining
              },
              totalPresent: sessRes.session.totalPresent,
              totalStudents: sessRes.session.totalStudents,
              attendees: sessRes.session.attendees
            };
          });
        }
      } catch (err) {
        console.warn('Session sync poll:', err.message);
      }
    };

    const pollInterval = setInterval(poll, 3000);
    return () => clearInterval(pollInterval);
  }, [activeSession?.id, teacher.id]);

  const toggleDivision = (div) => {
    setSelectedDivisions(prev => {
      if (prev.includes(div)) {
        if (prev.length === 1) return prev;
        return prev.filter(d => d !== div);
      } else {
        return [...prev, div];
      }
    });
  };

  const handleStartSession = async (e) => {
    e.preventDefault();
    if (!subjectName.trim()) {
      alert('Please enter Subject / Lecture Name');
      return;
    }
    if (selectedDivisions.length === 0) {
      alert('Please select at least 1 Division');
      return;
    }

    setLoading(true);
    try {
      const res = await api.startSession({
        teacherId: teacher.id,
        teacherName,
        department,
        subjectName: subjectName.trim(),
        divisions: selectedDivisions,
        division: selectedDivisions.join(', '),
        batch,
        durationMinutes
      });

      if (res.success) {
        setActiveSession(res.session);
      } else {
        alert(res.error || 'Failed to start session');
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

    const sessionToSave = { ...activeSession };
    const sessionIdToEnd = activeSession.id;

    exportLectureExcelFile(sessionToSave);

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

    try {
      await api.endSession(sessionIdToEnd, sessionToSave);
      loadConductedLectures();
    } catch (err) {
      console.warn('Background end session status:', err.message);
    }
  };

  const handleDeleteLecture = async (sessionId, subName) => {
    if (!window.confirm(`Delete lecture record for ${subName}? This will remove it from the conducted list.`)) return;
    try {
      await api.deleteConductedLecture(sessionId);
      setConductedLectures(prev => prev.filter(l => l.id !== sessionId));
    } catch (err) {
      alert(err.message || 'Failed to delete lecture');
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
      
      {/* Teacher Profile Bar (Clean Institutional White Card with Back Option) */}
      <div className="bg-white border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 transition touch-target flex items-center justify-center flex-shrink-0"
              title="Back to Previous Page / Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-600">Faculty In-Charge</span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{teacherName}</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium flex items-center space-x-1.5 truncate">
              <Building2 className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
              <span className="truncate">{deptObj?.name || department.toUpperCase()} • Faculty Portal</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-between sm:justify-end flex-wrap gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-300 transition touch-target"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          )}
          {activeSession && (
            <button
              onClick={() => exportLectureExcelFile(activeSession)}
              className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider transition active:scale-95 touch-target"
            >
              <Download className="w-4 h-4 flex-shrink-0" />
              <span>Export Excel</span>
            </button>
          )}
          <button
            onClick={() => { loadActiveSession(); loadConductedLectures(); }}
            className="p-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition touch-target flex items-center justify-center flex-shrink-0"
            title="Refresh Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
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
              </p>

              {/* GIANT PIN BOX */}
              <div className="my-5 sm:my-6 inline-flex flex-col items-center p-5 sm:p-8 bg-black/60 border border-white/20 max-w-full">
                <span className="text-xs uppercase font-bold tracking-widest text-slate-400 mb-3 text-center">
                  CLASSROOM ACTIVE PIN (ROTATES IN 15s)
                </span>
                
                <div className="flex items-center space-x-2 sm:space-x-4 max-w-full justify-center">
                  {String(activeSession.pinInfo?.pin || '----').split('').map((digit, i) => (
                    <div
                      key={i}
                      className="w-12 h-16 sm:w-16 sm:h-24 bg-white text-slate-950 flex items-center justify-center font-mono font-black text-3xl sm:text-6xl border border-slate-400 shadow-lg"
                    >
                      {digit}
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center space-x-2 text-xs text-sky-400 font-semibold">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Rotating new PIN in {activeSession.pinInfo?.secondsRemaining || 15}s</span>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 pt-2">
                <button
                  onClick={() => handleExtend(1)}
                  className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider border border-white/20 transition touch-target"
                >
                  +1 Min Extra
                </button>
                <button
                  onClick={() => handleExtend(3)}
                  className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider border border-white/20 transition touch-target"
                >
                  +3 Mins Extra
                </button>
                <button
                  onClick={handleEndSession}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider transition active:scale-95 touch-target shadow-md"
                >
                  End Session & Download Excel
                </button>
              </div>
            </div>

            {/* Right: Clock & Present Count */}
            <div className="w-full lg:w-72 flex flex-col items-center justify-center p-6 bg-white/5 border border-white/15 text-center space-y-4">
              <TimerRing
                remainingSec={activeSession.remainingSessionSec}
                totalSec={(activeSession.durationMinutes || 3) * 60}
                pinSeconds={activeSession.pinInfo?.secondsRemaining || 15}
              />

              <div className="w-full pt-3 border-t border-white/15">
                <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Attendance Marked</span>
                <div className="text-3xl font-extrabold text-emerald-400 mt-0.5">
                  {activeSession.totalPresent || 0}
                  <span className="text-xs text-slate-400 font-normal ml-1.5">/ {activeSession.totalStudents || 80} Students</span>
                </div>
              </div>

              {/* Manual Fallback Mark Form */}
              <form onSubmit={handleManualMark} className="w-full pt-2">
                <div className="flex space-x-1.5">
                  <input
                    type="number"
                    placeholder="Roll #"
                    value={manualRollNo}
                    onChange={(e) => setManualRollNo(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-black/50 border border-white/20 text-white text-xs placeholder-slate-500 outline-none focus:border-white"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-white text-black font-bold text-xs uppercase hover:bg-slate-200 transition"
                  >
                    Mark
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
        /* NO ACTIVE SESSION: SHOW TABS (LAUNCH NEW LECTURE vs MY CONDUCTED LECTURES) */
        <div className="space-y-5">
          
          {/* Navigation Tabs */}
          <div className="border-b border-slate-200 pb-2 flex space-x-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('launch')}
              className={`px-4 py-2 text-xs sm:text-sm font-semibold transition flex items-center space-x-1.5 whitespace-nowrap touch-target border ${
                activeTab === 'launch'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white border-slate-200'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Start Lecture Attendance</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 text-xs sm:text-sm font-semibold transition flex items-center space-x-1.5 whitespace-nowrap touch-target border ${
                activeTab === 'history'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white border-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>My Conducted Lectures ({conductedLectures.length})</span>
            </button>
          </div>

          {/* TAB 1: LAUNCH NEW SESSION FORM */}
          {activeTab === 'launch' && (
            <div className="bg-white border border-slate-200 p-6 sm:p-8 shadow-sm max-w-2xl mx-auto">
              <div className="text-center mb-6">
                <Play className="w-8 h-8 text-slate-800 mx-auto mb-2 stroke-[1.5]" />
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">Start Lecture Attendance</h3>
                <p className="text-slate-500 text-xs mt-0.5">Launches the 15-second rotating PIN on screen for students.</p>
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
                    required
                    placeholder="e.g. Digital Systems, AEC, Signal Processing"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    className="w-full bg-white border border-slate-300 px-3.5 py-2.5 text-base sm:text-sm text-slate-900 focus:border-slate-800 outline-none min-h-[44px]"
                  />
                </div>

                {/* Duration Picker */}
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
                        className={`py-2.5 px-3 text-xs font-bold border transition touch-target ${
                          durationMinutes === mins
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {mins} Mins
                      </button>
                    ))}
                  </div>
                </div>

                {/* Start Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition active:scale-[0.98] touch-target min-h-[48px] shadow-sm flex items-center justify-center space-x-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{loading ? 'Starting Attendance...' : 'Launch Attendance Session'}</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: MY CONDUCTED LECTURES & INDIVIDUAL EXCEL DOWNLOADS */}
          {activeTab === 'history' && (
            <div className="bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center space-x-2">
                    <BookOpen className="w-4 h-4 text-sky-600 flex-shrink-0" />
                    <span>My Conducted Lectures & Attendance Reports</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Download individual Excel (.xlsx) reports for completed lectures in {deptObj?.name || 'Department'}.
                  </p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-800 border border-slate-200">
                  Total Lectures: {conductedLectures.length}
                </span>
              </div>

              <div className="space-y-3">
                {conductedLectures.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 text-xs font-medium space-y-2 border border-dashed border-slate-300">
                    <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto stroke-[1.5]" />
                    <p className="font-bold text-slate-700 text-sm">No lecture sessions conducted yet.</p>
                    <p>When you start and conclude attendance sessions, each completed lecture will appear here with an individual Excel download button.</p>
                  </div>
                ) : (
                  conductedLectures.map((lect, idx) => {
                    const isExpanded = expandedLectureId === (lect.id || idx);
                    const conductedDate = lect.date || (lect.startTime ? new Date(lect.startTime).toLocaleDateString() : 'Today');
                    const conductedTime = lect.startTime ? new Date(lect.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                    const attendees = lect.attendees || [];
                    const presentCount = lect.totalPresent !== undefined ? lect.totalPresent : attendees.length;

                    return (
                      <div
                        key={lect.id || idx}
                        className="p-4 sm:p-5 bg-slate-50 border border-slate-200 hover:border-slate-300 transition space-y-3"
                      >
                        {/* Top Row: Details & Actions */}
                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center space-x-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-sm sm:text-base">{lect.subjectName}</span>
                              <span className="text-xs font-semibold px-2 py-0.5 bg-white text-slate-700 border border-slate-200">
                                {lect.division}
                              </span>
                            </div>

                            <div className="flex items-center space-x-4 text-xs text-slate-600 flex-wrap gap-y-1">
                              <span className="flex items-center space-x-1">
                                <span className="text-slate-400 font-medium">Faculty:</span>
                                <span className="font-semibold text-slate-800">{lect.teacherName || teacherName}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-medium text-slate-700">{conductedDate} {conductedTime ? `at ${conductedTime}` : ''}</span>
                              </span>
                              <span className="flex items-center space-x-1 font-bold text-emerald-700">
                                <span>Present:</span>
                                <span>{presentCount} Students</span>
                              </span>
                            </div>
                          </div>

                          {/* Download & Toggle Buttons */}
                          <div className="flex items-center space-x-2 w-full lg:w-auto justify-between lg:justify-end pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200">
                            <button
                              onClick={() => exportLectureExcelFile(lect)}
                              className="flex-1 lg:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold tracking-wide uppercase transition active:scale-95 touch-target shadow-sm"
                              title="Download Formatted Excel Sheet (.xlsx)"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download Excel (.xlsx)</span>
                            </button>

                            <button
                              onClick={() => setExpandedLectureId(isExpanded ? null : (lect.id || idx))}
                              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-300 transition touch-target flex items-center space-x-1"
                              title="Preview Verified Student Attendees"
                            >
                              <span>{isExpanded ? 'Hide' : 'Preview'}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>

                            <button
                              onClick={() => handleDeleteLecture(lect.id, `${lect.subjectName} (${lect.division})`)}
                              className="p-2 bg-white hover:bg-rose-50 text-rose-600 border border-slate-300 hover:border-rose-300 transition touch-target"
                              title="Delete / Remove Lecture Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Expandable Attendee Preview Table */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-slate-200 bg-white p-3 border">
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                              Verified Present Students ({attendees.length}):
                            </h4>
                            {attendees.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">No present students recorded for this session.</p>
                            ) : (
                              <div className="max-h-48 overflow-y-auto">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0">
                                    <tr>
                                      <th className="py-1.5 px-2">Roll</th>
                                      <th className="py-1.5 px-2">Name</th>
                                      <th className="py-1.5 px-2">PRN</th>
                                      <th className="py-1.5 px-2">Time</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {attendees.map(att => (
                                      <tr key={att.id} className="hover:bg-slate-50">
                                        <td className="py-1.5 px-2 font-bold">#{att.rollNo}</td>
                                        <td className="py-1.5 px-2 font-semibold text-slate-900">{att.studentName}</td>
                                        <td className="py-1.5 px-2 font-mono text-slate-500">{att.prn || '-'}</td>
                                        <td className="py-1.5 px-2 text-slate-600">
                                          {att.timestamp ? new Date(att.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* SESSION CONCLUSION SUMMARY MODAL */}
      {completedSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 text-center">
            
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-700">Attendance Completed</span>
              <h3 className="text-xl font-bold text-slate-900 mt-1">{completedSummary.subjectName}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Division: <span className="font-semibold text-slate-800">{completedSummary.division}</span></p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 space-y-2 text-left">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Verified Present:</span>
                <span className="font-bold text-emerald-700">{completedSummary.totalPresent} Students</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Total Class Strength:</span>
                <span className="font-semibold text-slate-700">{completedSummary.totalStudents} Students</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Attendance Rate:</span>
                <span className="font-bold text-slate-900">
                  {((completedSummary.totalPresent / completedSummary.totalStudents) * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => exportLectureExcelFile(completedSummary.sessionData)}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider transition flex items-center justify-center space-x-1.5 touch-target shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Excel (.xlsx)</span>
              </button>

              <button
                onClick={() => setCompletedSummary(null)}
                className="px-5 py-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold uppercase tracking-wider transition touch-target"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
