import React, { useState, useEffect } from 'react';
import { Shield, Users, Settings, AlertTriangle, Download, RefreshCw, UserPlus, Unlock, Search, BookOpen, Key, Building2, ImageIcon, Bell, CheckCircle2, Smartphone, ShieldCheck, KeyRound, Clock, UserCheck, Trash2, Play, PlusCircle } from 'lucide-react';
import { api } from '../services/api';

const DEPARTMENTS = [
  { id: 'comp', name: 'Computer Science & Engineering', code: 'CSE' },
  { id: 'it', name: 'Information Technology', code: 'IT' },
  { id: 'aids', name: 'Artificial Intelligence & Data Science', code: 'AI&DS' },
  { id: 'entc', name: 'Electronics & Telecommunication', code: 'ENTC' },
  { id: 'elec', name: 'Electrical Engineering', code: 'ELEC' },
  { id: 'instru', name: 'Instrumentation Engineering', code: 'INSTRU' }
];

const DIVISIONS = ['SY-A', 'SY-B', 'SY-C'];

export function AdminPortal({ hodProfile, onLaunchLectureAsHod }) {
  const [activeTab, setActiveTab] = useState('roster');
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [settings, setSettings] = useState({});
  const [loginLogs, setLoginLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const currentDept = hodProfile?.department || 'entc';
  const currentHodName = hodProfile?.name || 'Department Head';
  const [divisionFilter, setDivisionFilter] = useState('SY-A');
  const [loading, setLoading] = useState(true);

  // Selected ID Photo Modal
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedStudentName, setSelectedStudentName] = useState('');

  // HOD Quick Lecture Launcher state
  const [showHodLectureModal, setShowHodLectureModal] = useState(false);
  const [hodSubject, setHodSubject] = useState('');
  const [hodDivisions, setHodDivisions] = useState(['SY-A']);
  const [hodBatch, setHodBatch] = useState('All');

  // Add Student state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRollNo, setNewRollNo] = useState('');
  const [newPrn, setNewPrn] = useState('');
  const [newName, setNewName] = useState('');
  const [newDivision, setNewDivision] = useState('SY-A');
  const [newBatch, setNewBatch] = useState('B1');

  // Password Change state
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [passError, setPassError] = useState('');

  const loadData = async () => {
    try {
      const [statsRes, studRes, teachRes, setRes, logsRes] = await Promise.all([
        api.getAdminStats(currentDept),
        api.getStudents({ division: divisionFilter, department: currentDept }),
        api.getTeachers(),
        api.getSettings(),
        api.getLoginLogs(currentDept)
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (studRes.success) setStudents(studRes.data || []);
      if (teachRes.success) {
        setTeachers(teachRes.data.filter(t => t.department === currentDept));
      }
      if (setRes.success) setSettings(setRes.data);
      if (logsRes.success) setLoginLogs(logsRes.data || []);
    } catch (err) {
      console.warn('Admin portal data refresh:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, [divisionFilter, currentDept]);

  const handleDeleteStudent = async (studentId, studentName, rollNo) => {
    if (!window.confirm(`⚠️ EXPEL STUDENT: Are you sure you want to permanently remove Roll No. ${rollNo} (${studentName}) from the database?`)) {
      return;
    }

    try {
      const res = await api.deleteStudent(studentId);
      if (res.success) {
        setStudents(prev => prev.filter(s => s.id !== studentId && s.rollNo !== Number(rollNo)));
        setLoginLogs(prev => prev.filter(l => l.studentId !== studentId && l.rollNo !== Number(rollNo)));
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete student');
    }
  };

  const handleResetDevice = async (studentId, name) => {
    if (!window.confirm(`Reset device binding for ${name}? The student will be allowed to bind a new phone.`)) return;
    try {
      const res = await api.resetStudentDevice(studentId);
      if (res.success) {
        alert(res.message || 'Device lock reset successfully.');
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to reset device');
    }
  };

  const handleResetTeacherPassword = async (teacherId, teacherName) => {
    if (!window.confirm(`Reset password for professor ${teacherName}? They will be prompted to create a new password on their next login.`)) return;
    try {
      const res = await api.resetTeacherPassword(teacherId);
      if (res.success) {
        alert(res.message);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to reset teacher password');
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    try {
      const res = await api.addStudent({
        rollNo: Number(newRollNo),
        prn: newPrn,
        name: newName,
        department: currentDept,
        division: newDivision,
        batch: newBatch
      });

      if (res.success) {
        setShowAddModal(false);
        setNewRollNo('');
        setNewPrn('');
        setNewName('');
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to add student');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassMsg('');
    setPassError('');
    try {
      const res = await api.changeHodPassword({
        department: currentDept,
        currentPassword: currentPass,
        newPassword: newPass
      });
      if (res.success) {
        setPassMsg(res.message || '✅ HOD password updated successfully!');
        setCurrentPass('');
        setNewPass('');
      }
    } catch (err) {
      setPassError(err.message || 'Failed to change password');
    }
  };

  const toggleHodDivision = (div) => {
    if (hodDivisions.includes(div)) {
      if (hodDivisions.length > 1) setHodDivisions(hodDivisions.filter(d => d !== div));
    } else {
      setHodDivisions([...hodDivisions, div]);
    }
  };

  const handleLaunchHodLectureSubmit = (e) => {
    e.preventDefault();
    if (!hodSubject.trim()) return alert('Please enter the Subject Name');
    if (hodDivisions.length === 0) return alert('Please select at least one division');

    const teacherProfile = {
      id: `T_HOD_${currentDept}`,
      name: currentHodName,
      department: currentDept,
      divisions: hodDivisions,
      division: hodDivisions.join(', '),
      subjectName: hodSubject.trim(),
      batch: hodBatch,
      role: 'teacher'
    };

    if (onLaunchLectureAsHod) {
      onLaunchLectureAsHod(teacherProfile);
    } else {
      window.location.reload();
    }
  };

  const filteredStudents = students.filter(s => {
    const q = searchQuery.toLowerCase();
    return (s.name?.toLowerCase().includes(q) || String(s.rollNo).includes(q) || s.prn?.toLowerCase().includes(q));
  });

  const defaulters = students.filter(s => s.isDefaulter);

  // Deduplicate strictly 1 permanent entry per student
  const studentLogsMap = new Map();
  loginLogs.forEach(l => {
    if (l.type === 'NEW_STUDENT_REGISTRATION' || l.type === 'STUDENT_LOGIN') {
      const key = `${l.department || currentDept}_${l.division || 'SY-A'}_${l.rollNo || l.studentId}`;
      if (!studentLogsMap.has(key)) {
        studentLogsMap.set(key, l);
      }
    }
  });
  const studentLogs = Array.from(studentLogsMap.values());
  const facultyLogs = loginLogs.filter(l => l.type === 'FACULTY_LECTURE_START' || l.type === 'FACULTY_LECTURE_END');
  const currentDeptObj = DEPARTMENTS.find(d => d.id === currentDept);

  return (
    <div className="max-w-7xl mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-4 xs:py-6 sm:py-8 space-y-4 sm:space-y-6">
      
      {/* Header Bar (Sharp Black & White Architecture) */}
      <div className="bg-white border-2 border-slate-300 p-4 xs:p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 sm:gap-4">
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 bg-black flex-shrink-0"></span>
            <span className="text-[10px] xs:text-xs font-black uppercase tracking-wider text-sky-600 truncate">
              Department Portal • {currentDeptObj?.code || currentDept.toUpperCase()}
            </span>
          </div>
          <h1 className="text-lg xs:text-xl sm:text-2xl font-black text-black uppercase truncate">
            {currentDeptObj?.name || 'Engineering Department'}
          </h1>
          <p className="text-xs text-slate-600 mt-0.5 font-bold truncate">
            HOD: <span className="text-black">{currentHodName}</span> • Academic Year 2025-2026
          </p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap gap-2">
          <button
            onClick={() => setShowHodLectureModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-black hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider transition active:scale-95 touch-target"
          >
            <Play className="w-4 h-4 flex-shrink-0" />
            <span className="whitespace-nowrap">Conduct Lecture</span>
          </button>

          <a
            href={api.getMasterExcelUrl(divisionFilter)}
            download
            className="flex items-center justify-center space-x-1.5 px-3.5 py-2 sm:py-2.5 bg-white hover:bg-slate-100 text-black text-xs font-black uppercase tracking-wider border-2 border-slate-300 transition touch-target"
          >
            <Download className="w-4 h-4 flex-shrink-0" />
            <span className="hidden xs:inline">Export Excel</span>
          </a>

          <button
            onClick={loadData}
            className="p-2 sm:p-2.5 bg-white hover:bg-slate-100 text-black border-2 border-slate-300 transition touch-target flex items-center justify-center flex-shrink-0"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs (Sharp Rectangular Tabs) */}
      <div className="border-b-2 border-slate-300 pb-2 overflow-x-auto scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
        <div className="flex space-x-1.5 min-w-max">
          {[
            { id: 'roster', label: `👥 Student Roster (${filteredStudents.length})`, icon: Users },
            { id: 'audit', label: `🔔 Live Logins (${studentLogs.length})`, icon: Bell },
            { id: 'faculty', label: `👨‍🏫 Faculty (${teachers.length})`, icon: UserCheck },
            { id: 'overview', label: '📊 Department Overview', icon: Shield },
            { id: 'defaulters', label: `⚠️ Defaulters (${defaulters.length})`, icon: AlertTriangle },
            { id: 'settings', label: '⚙️ Security', icon: Settings }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-black uppercase transition flex items-center space-x-1.5 whitespace-nowrap touch-target border-2 ${
                activeTab === tab.id
                  ? 'bg-black text-white border-black'
                  : 'text-slate-700 hover:text-black hover:bg-slate-100 bg-white border-slate-300'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: VERIFIED STUDENT ROSTER (Sharp Rectangular) */}
      {activeTab === 'roster' && (
        <div className="bg-white border-2 border-slate-300 p-4 xs:p-5 sm:p-6 shadow-sm space-y-3.5 sm:space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 pb-3 border-b border-slate-200">
            <div className="flex items-center space-x-2 sm:space-x-3 flex-1">
              <select
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="bg-white border-2 border-slate-300 px-2.5 sm:px-3 py-2 text-xs font-black text-black outline-none focus:border-black min-h-[40px]"
              >
                <option value="SY-A">SY-A</option>
                <option value="SY-B">SY-B</option>
                <option value="SY-C">SY-C</option>
              </select>

              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search student name, roll number, or PRN..."
                  className="w-full bg-white border-2 border-slate-300 pl-8 pr-3 py-2 text-base sm:text-xs text-black font-bold placeholder-slate-400 outline-none focus:border-black min-h-[40px]"
                />
              </div>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center space-x-1.5 px-3.5 py-2 sm:py-2.5 bg-black hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider transition touch-target"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Student</span>
            </button>
          </div>

          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 max-h-[520px] overflow-y-auto">
            {filteredStudents.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs font-bold space-y-1">
                <p className="font-black text-black text-sm uppercase">No student records found in {divisionFilter}.</p>
                <p>When students verify with their physical ID card on the login page, their profile appears here permanently.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs sm:text-sm min-w-[580px]">
                <thead className="text-slate-600 uppercase bg-slate-100 sticky top-0 border-b-2 border-slate-300 text-[10px] xs:text-xs font-black">
                  <tr>
                    <th className="py-2.5 px-2.5">Roll</th>
                    <th className="py-2.5 px-2.5">PRN</th>
                    <th className="py-2.5 px-2.5">Student Name</th>
                    <th className="py-2.5 px-2.5">ID Card</th>
                    <th className="py-2.5 px-2.5">Attendance</th>
                    <th className="py-2.5 px-2.5">1-Phone Lock</th>
                    <th className="py-2.5 px-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {filteredStudents.map(student => (
                    <tr key={student.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-2.5 font-black text-black">#{student.rollNo}</td>
                      <td className="py-2.5 px-2.5 text-slate-600 font-mono text-xs font-bold">{student.prn}</td>
                      <td className="py-2.5 px-2.5 font-black text-black">{student.name}</td>
                      <td className="py-2.5 px-2.5">
                        {student.idCardPhoto ? (
                          <button
                            onClick={() => {
                              setSelectedPhoto(student.idCardPhoto);
                              setSelectedStudentName(student.name);
                            }}
                            className="flex items-center space-x-1 text-xs text-black hover:text-sky-600 font-black uppercase touch-target"
                            title="View ID Card"
                          >
                            <img src={student.idCardPhoto} alt="ID" className="w-6 h-6 object-cover border border-black shadow-none" />
                            <span>View</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs font-bold">Pending</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2.5 font-black">
                        <span className={student.isDefaulter ? 'text-rose-600' : 'text-black'}>
                          {student.attendancePercentage || 100}%
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5">
                        {student.boundDeviceId ? (
                          <span className="px-2 py-0.5 bg-slate-100 text-black font-black text-[10px] border border-slate-300 uppercase">
                            🔒 Bound
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 font-bold text-[10px] uppercase">
                            Unbound
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2.5 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {student.boundDeviceId && (
                            <button
                              onClick={() => handleResetDevice(student.id, student.name)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-black text-[10px] xs:text-[11px] font-black uppercase border border-slate-300 transition touch-target"
                              title="Reset Phone Lock"
                            >
                              <Unlock className="w-3 h-3 inline mr-0.5" />
                              Reset
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteStudent(student.id, student.name, student.rollNo)}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 text-[10px] xs:text-[11px] font-black uppercase border border-rose-300 transition flex items-center space-x-0.5 touch-target"
                            title="Expel / Permanently Delete Student"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LIVE STUDENT LOGINS & ID AUDIT */}
      {activeTab === 'audit' && (
        <div className="bg-white border-2 border-slate-300 p-4 xs:p-5 sm:p-6 shadow-sm space-y-3.5 sm:space-y-4">
          <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <div className="min-w-0">
              <h3 className="text-sm xs:text-base font-black text-black uppercase flex items-center space-x-2 truncate">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600 flex-shrink-0" />
                <span className="truncate">Live Registration & ID Audit Feed</span>
              </h3>
              <p className="text-[11px] xs:text-xs text-slate-500 font-semibold mt-0.5 truncate">Real-time log of verified ID cards in {currentDeptObj?.name}</p>
            </div>
            <span className="px-2.5 py-1 bg-slate-100 text-black text-[10px] xs:text-xs font-black border border-slate-300 flex items-center space-x-1.5 flex-shrink-0 uppercase">
              <span className="w-2 h-2 bg-emerald-500"></span>
              <span>● Permanent Feed</span>
            </span>
          </div>

          <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
            {studentLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-bold uppercase">
                No student logins recorded yet for this department.
              </div>
            ) : (
              studentLogs.map(log => (
                <div
                  key={log.id || log.studentId}
                  className="p-3 sm:p-3.5 bg-white border-2 border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 hover:border-black transition"
                >
                  <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0 w-full sm:w-auto">
                    {log.idCardPhoto ? (
                      <img
                        src={log.idCardPhoto}
                        alt="ID Card"
                        onClick={() => {
                          setSelectedPhoto(log.idCardPhoto);
                          setSelectedStudentName(log.studentName);
                        }}
                        className="w-11 h-11 sm:w-12 sm:h-12 object-cover border border-black cursor-pointer hover:scale-105 transition flex-shrink-0"
                        title="Click to view full ID Card"
                      />
                    ) : (
                      <div className="w-11 h-11 sm:w-12 sm:h-12 bg-black text-white font-black text-xs flex items-center justify-center flex-shrink-0">
                        #{log.rollNo}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <span className="font-black text-black text-xs sm:text-sm uppercase truncate">{log.studentName}</span>
                        <span className="text-[9px] xs:text-[10px] font-black px-1.5 py-0.5 bg-slate-100 text-black border border-slate-300 flex-shrink-0">
                          #{log.rollNo} • {log.division}
                        </span>
                      </div>
                      <p className="text-[10px] xs:text-[11px] text-slate-600 mt-0.5 flex items-center space-x-1 font-mono font-bold truncate">
                        <Smartphone className="w-3 h-3 text-slate-500 flex-shrink-0" />
                        <span className="truncate">PRN: {log.prn} • Dev: {log.deviceId ? log.deviceId.substring(0, 8) : 'LOCKED'}...</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end space-x-2 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                    <div className="text-left sm:text-right">
                      <span className="text-[9px] xs:text-[10px] font-black px-2 py-0.5 bg-slate-100 text-black border border-slate-300 uppercase">
                        ✓ ID Verified
                      </span>
                      <p className="text-[9px] xs:text-[10px] text-slate-500 mt-0.5 font-bold">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteStudent(log.studentId, log.studentName, log.rollNo)}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-[11px] xs:text-xs font-black uppercase transition flex items-center space-x-1 touch-target flex-shrink-0"
                      title="Expel / Permanently Delete Student"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Expel</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: FACULTY ROSTER */}
      {activeTab === 'faculty' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white border-2 border-slate-300 p-4 xs:p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-slate-200">
              <div className="min-w-0">
                <h3 className="text-sm xs:text-base font-black text-black uppercase flex items-center space-x-2 truncate">
                  <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600 flex-shrink-0" />
                  <span className="truncate">{currentDeptObj?.code} Faculty Roster</span>
                </h3>
                <p className="text-[11px] xs:text-xs text-slate-500 font-semibold truncate">Teachers registered under this department</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
              {teachers.length === 0 ? (
                <div className="col-span-1 sm:col-span-2 lg:col-span-3 p-6 text-center text-slate-500 text-xs font-bold uppercase">
                  No professors have logged in through this department yet.
                </div>
              ) : (
                teachers.map(t => (
                  <div key={t.id} className="p-3.5 sm:p-4 bg-white border-2 border-slate-300 flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] xs:text-[10px] uppercase font-black text-sky-600">{t.role || 'Teacher'}</span>
                      <h4 className="font-black text-black text-xs sm:text-sm mt-0.5 truncate uppercase">{t.name}</h4>
                      {t.subjectName && (
                        <p className="text-xs text-slate-800 font-bold mt-1 truncate">📚 {t.subjectName}</p>
                      )}
                      <p className="text-[11px] text-slate-500 font-semibold truncate">{t.email}</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-[10px] xs:text-[11px] font-black text-emerald-700 uppercase">● Active</span>
                      <button
                        onClick={() => handleResetTeacherPassword(t.id, t.name)}
                        className="text-[10px] xs:text-[11px] font-black px-2 py-1 bg-slate-100 hover:bg-rose-100 hover:text-rose-800 text-black border border-slate-300 uppercase transition touch-target"
                      >
                        Reset Password
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Lecture Logs */}
          <div className="bg-white border-2 border-slate-300 p-4 xs:p-5 sm:p-6 shadow-sm space-y-3.5">
            <h3 className="text-sm xs:text-base font-black text-black uppercase">Lecture Session History</h3>
            <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
              {facultyLogs.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs font-bold uppercase">No lectures recorded yet.</div>
              ) : (
                facultyLogs.map(log => (
                  <div key={log.id} className="p-3 sm:p-4 bg-white border-2 border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <span className="font-black text-black text-xs sm:text-sm uppercase truncate">👨‍🏫 {log.teacherName}</span>
                        <span className="text-[9px] xs:text-[10px] font-black px-2 py-0.5 bg-slate-100 text-black border border-slate-300 flex-shrink-0">
                          {log.subjectName}
                        </span>
                      </div>
                      <p className="text-[11px] xs:text-xs text-slate-700 font-semibold mt-1">
                        Divisions: <span className="font-black text-black">{log.division}</span>
                        {log.batch !== 'All' ? ` • Batch: ${log.batch}` : ''}
                        {log.totalPresent !== undefined ? ` • Present: ${log.totalPresent}` : ''}
                      </p>
                    </div>

                    <div className="text-left sm:text-right border-t sm:border-t-0 pt-1.5 sm:pt-0 border-slate-200 w-full sm:w-auto">
                      <span className={`text-[9px] xs:text-[10px] font-black px-2 py-0.5 uppercase border ${
                        log.type === 'FACULTY_LECTURE_START' ? 'bg-slate-100 text-black border-slate-300' : 'bg-slate-200 text-slate-700 border-slate-300'
                      }`}>
                        {log.type === 'FACULTY_LECTURE_START' ? '● Active' : 'Concluded'}
                      </span>
                      <p className="text-[9px] xs:text-[10px] text-slate-500 font-bold mt-0.5">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(log.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: OVERVIEW STATS */}
      {activeTab === 'overview' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="bg-white border-2 border-slate-300 p-4 sm:p-5 shadow-sm">
              <span className="text-[10px] xs:text-xs font-black text-slate-500 uppercase truncate block">{currentDeptObj?.code} Total Students</span>
              <div className="text-2xl sm:text-3xl font-black text-black mt-1">{stats?.totalStudents || students.length || 0}</div>
              <p className="text-[10px] xs:text-[11px] text-slate-500 mt-0.5 sm:mt-1 font-bold truncate">Permanent roster</p>
            </div>

            <div className="bg-white border-2 border-slate-300 p-4 sm:p-5 shadow-sm">
              <span className="text-[10px] xs:text-xs font-black text-slate-500 uppercase truncate block">Faculty Count</span>
              <div className="text-2xl sm:text-3xl font-black text-black mt-1">{teachers.length}</div>
              <p className="text-[10px] xs:text-[11px] text-slate-500 mt-0.5 sm:mt-1 font-bold truncate">Password protected</p>
            </div>

            <div className="bg-white border-2 border-slate-300 p-4 sm:p-5 shadow-sm">
              <span className="text-[10px] xs:text-xs font-black text-black uppercase truncate block">Lectures Conducted</span>
              <div className="text-2xl sm:text-3xl font-black text-black mt-1">{facultyLogs.length}</div>
              <p className="text-[10px] xs:text-[11px] text-slate-500 mt-0.5 sm:mt-1 font-bold truncate">Sessions logged</p>
            </div>

            <div className="bg-white border-2 border-slate-300 p-4 sm:p-5 shadow-sm">
              <span className="text-[10px] xs:text-xs font-black text-rose-700 uppercase truncate block">Defaulter Students</span>
              <div className="text-2xl sm:text-3xl font-black text-rose-700 mt-1">{defaulters.length}</div>
              <p className="text-[10px] xs:text-[11px] text-slate-500 mt-0.5 sm:mt-1 font-bold truncate">&lt; 75% threshold</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DEFAULTERS */}
      {activeTab === 'defaulters' && (
        <div className="bg-white border-2 border-slate-300 p-4 xs:p-5 sm:p-6 shadow-sm space-y-3.5 sm:space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm xs:text-base font-black text-black uppercase flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 flex-shrink-0" />
                <span>Monthly Defaulters (&lt; 75%)</span>
              </h3>
              <p className="text-[11px] xs:text-xs text-slate-500 font-semibold mt-0.5">Students below 75% attendance in {currentDeptObj?.name}</p>
            </div>
          </div>

          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-left text-xs sm:text-sm min-w-[500px]">
              <thead className="text-slate-600 uppercase bg-slate-100 border-b-2 border-slate-300 text-[10px] xs:text-xs font-black">
                <tr>
                  <th className="py-2.5 px-2.5">Roll No</th>
                  <th className="py-2.5 px-2.5">PRN</th>
                  <th className="py-2.5 px-2.5">Student Name</th>
                  <th className="py-2.5 px-2.5">Div</th>
                  <th className="py-2.5 px-2.5">Attended</th>
                  <th className="py-2.5 px-2.5">Attendance %</th>
                  <th className="py-2.5 px-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {defaulters.map(student => (
                  <tr key={student.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-2.5 font-black text-black">#{student.rollNo}</td>
                    <td className="py-2.5 px-2.5 text-slate-600 font-bold text-xs">{student.prn}</td>
                    <td className="py-2.5 px-2.5 font-black text-black">{student.name}</td>
                    <td className="py-2.5 px-2.5 font-bold">{student.division}</td>
                    <td className="py-2.5 px-2.5 font-bold">{student.attendedLectures} / {student.totalLectures}</td>
                    <td className="py-2.5 px-2.5 font-black text-rose-700">{student.attendancePercentage}%</td>
                    <td className="py-2.5 px-2.5">
                      <span className="px-2 py-0.5 bg-rose-50 text-rose-800 font-black text-[10px] border border-rose-300 uppercase">
                        ⚠️ Defaulter
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: SECURITY & PASSWORD */}
      {activeTab === 'settings' && (
        <div className="bg-white border-2 border-slate-300 p-4 xs:p-6 shadow-sm max-w-lg">
          <h3 className="text-base font-black text-black uppercase mb-1 flex items-center space-x-2">
            <Key className="w-4 h-4 text-sky-600" />
            <span>Change HOD Private Password</span>
          </h3>
          <p className="text-xs text-slate-500 mb-4 font-bold">
            Update master password for {currentHodName} ({currentDeptObj?.name}).
          </p>

          {passMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-black uppercase">
              {passMsg}
            </div>
          )}

          {passError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-300 text-rose-800 text-xs font-black uppercase">
              ⚠️ {passError}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3.5 sm:space-y-4">
            <div>
              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)}
                placeholder="Enter current password"
                className="w-full bg-white border-2 border-slate-300 px-3.5 py-2.5 text-base sm:text-sm text-black font-bold focus:border-black outline-none min-h-[44px]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
                New Secret Password
              </label>
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Min. 6 characters"
                className="w-full bg-white border-2 border-slate-300 px-3.5 py-2.5 text-base sm:text-sm text-black font-bold focus:border-black outline-none min-h-[44px]"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-black hover:bg-slate-800 text-white font-black text-xs sm:text-sm uppercase tracking-wider transition active:scale-[0.98] min-h-[44px] touch-target"
            >
              Update HOD Password
            </button>
          </form>
        </div>
      )}

      {/* HOD CONDUCT LECTURE MODAL (Sharp Rectangular) */}
      {showHodLectureModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3 xs:p-4">
          <div className="bg-white border-2 border-black p-5 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-black text-black uppercase mb-1 flex items-center space-x-2">
              <Play className="w-5 h-5 text-sky-600" />
              <span>Launch Lecture as HOD</span>
            </h3>
            <p className="text-xs text-slate-500 font-semibold mb-4">Conduct class session as {currentHodName} ({currentDeptObj?.code})</p>

            <form onSubmit={handleLaunchHodLectureSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-black text-black uppercase mb-1">Subject / Lecture Name</label>
                <input
                  type="text"
                  value={hodSubject}
                  onChange={(e) => setHodSubject(e.target.value)}
                  placeholder="e.g. Digital Signal Processing"
                  className="w-full bg-white border-2 border-slate-300 px-3 py-2 text-base sm:text-xs text-black font-bold outline-none focus:border-black min-h-[44px]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-black uppercase mb-1">Select Division(s)</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {DIVISIONS.map(div => {
                    const isChecked = hodDivisions.includes(div);
                    return (
                      <button
                        key={div}
                        type="button"
                        onClick={() => toggleHodDivision(div)}
                        className={`py-2 text-xs font-black uppercase border-2 transition touch-target flex items-center justify-center ${
                          isChecked ? 'bg-black text-white border-black' : 'bg-white border-slate-300 text-black'
                        }`}
                      >
                        {div}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-black uppercase mb-1">Lecture Type / Batch</label>
                <select
                  value={hodBatch}
                  onChange={(e) => setHodBatch(e.target.value)}
                  className="w-full bg-white border-2 border-slate-300 px-3 py-2 text-base sm:text-xs text-black font-bold outline-none focus:border-black min-h-[44px]"
                >
                  <option value="All">All Batches (Theory Lecture)</option>
                  <option value="B1">Batch B1 (Practical Lab)</option>
                  <option value="B2">Batch B2 (Practical Lab)</option>
                  <option value="B3">Batch B3 (Practical Lab)</option>
                </select>
              </div>

              <div className="flex space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowHodLectureModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-black font-black text-xs uppercase border border-slate-300 touch-target flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-black hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider touch-target flex items-center justify-center"
                >
                  Launch Screen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ID CARD FULL PHOTO INSPECTOR MODAL */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-3 xs:p-4">
          <div className="bg-white border-2 border-black p-4 xs:p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto text-center">
            <h3 className="text-sm xs:text-base font-black text-black uppercase mb-1">{selectedStudentName || 'Student'}</h3>
            <p className="text-xs text-slate-500 font-semibold mb-3">Physical College ID Card Verification</p>
            <img src={selectedPhoto} alt="Student ID" className="w-full max-h-[60vh] object-contain border border-black mb-3" />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="w-full py-2.5 bg-black text-white font-black text-xs uppercase tracking-wider touch-target flex items-center justify-center"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}

      {/* ADD STUDENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3 xs:p-4">
          <div className="bg-white border-2 border-black p-5 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-base sm:text-lg font-black text-black uppercase mb-3.5">Add Student to {currentDeptObj?.code} Roster</h3>
            <form onSubmit={handleAddStudent} className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-[11px] font-black text-black uppercase mb-1">Roll No</label>
                  <input
                    type="number"
                    value={newRollNo}
                    onChange={(e) => setNewRollNo(e.target.value)}
                    placeholder="e.g. 24"
                    className="w-full bg-white border-2 border-slate-300 px-3 py-2 text-base sm:text-sm text-black font-bold outline-none focus:border-black min-h-[44px]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-black uppercase mb-1">PRN</label>
                  <input
                    type="text"
                    value={newPrn}
                    onChange={(e) => setNewPrn(e.target.value)}
                    placeholder="e.g. 12251ET049"
                    className="w-full bg-white border-2 border-slate-300 px-3 py-2 text-base sm:text-sm text-black font-bold outline-none focus:border-black min-h-[44px]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-black uppercase mb-1">Student Full Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter Full Name"
                  className="w-full bg-white border-2 border-slate-300 px-3 py-2 text-base sm:text-sm text-black font-bold outline-none focus:border-black min-h-[44px]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-[11px] font-black text-black uppercase mb-1">Division</label>
                  <select
                    value={newDivision}
                    onChange={(e) => setNewDivision(e.target.value)}
                    className="w-full bg-white border-2 border-slate-300 px-3 py-2 text-base sm:text-sm text-black font-bold outline-none focus:border-black min-h-[44px]"
                  >
                    <option value="SY-A">SY-A</option>
                    <option value="SY-B">SY-B</option>
                    <option value="SY-C">SY-C</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-black uppercase mb-1">Batch</label>
                  <select
                    value={newBatch}
                    onChange={(e) => setNewBatch(e.target.value)}
                    className="w-full bg-white border-2 border-slate-300 px-3 py-2 text-base sm:text-sm text-black font-bold outline-none focus:border-black min-h-[44px]"
                  >
                    <option value="B1">B1</option>
                    <option value="B2">B2</option>
                    <option value="B3">B3</option>
                  </select>
                </div>
              </div>

              <div className="flex space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-black font-black text-xs uppercase border border-slate-300 touch-target flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-black hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider touch-target flex items-center justify-center"
                >
                  Add Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
