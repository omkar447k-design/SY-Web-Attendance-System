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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 sm:space-y-6">
      
      {/* Header Bar */}
      <div className="bg-white border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-sky-600 truncate">
              Department Portal • {currentDeptObj?.code || currentDept.toUpperCase()}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
            {currentDeptObj?.name || 'Engineering Department'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium truncate">
            HOD: <span className="text-slate-800 font-semibold">{currentHodName}</span> • Academic Year 2025-2026
          </p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap gap-2">
          <button
            onClick={() => setShowHodLectureModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider transition active:scale-95 touch-target"
          >
            <Play className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="whitespace-nowrap">Conduct Lecture</span>
          </button>

          <a
            href={api.getMasterExcelUrl(divisionFilter)}
            download
            className="flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-300 transition touch-target"
          >
            <Download className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden xs:inline">Export Excel</span>
          </a>

          <button
            onClick={loadData}
            className="p-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition touch-target flex items-center justify-center flex-shrink-0"
            title="Refresh Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 pb-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex space-x-2 min-w-max">
          {[
            { id: 'roster', label: `Student Roster (${filteredStudents.length})`, icon: Users },
            { id: 'audit', label: `Live Logins (${studentLogs.length})`, icon: Bell },
            { id: 'faculty', label: `Faculty (${teachers.length})`, icon: UserCheck },
            { id: 'overview', label: 'Department Overview', icon: Shield },
            { id: 'defaulters', label: `Defaulters (${defaulters.length})`, icon: AlertTriangle },
            { id: 'settings', label: 'Security & Password', icon: Settings }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs sm:text-sm font-semibold transition flex items-center space-x-1.5 whitespace-nowrap touch-target border ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white border-slate-200'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: VERIFIED STUDENT ROSTER */}
      {activeTab === 'roster' && (
        <div className="bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div className="flex items-center space-x-3 flex-1">
              <select
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="bg-white border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-slate-800 min-h-[40px]"
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
                  className="w-full bg-white border border-slate-300 pl-8 pr-3 py-2 text-base sm:text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-slate-800 min-h-[40px]"
                />
              </div>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider transition touch-target"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Student</span>
            </button>
          </div>

          <div className="overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0 max-h-[520px] overflow-y-auto">
            {filteredStudents.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-medium space-y-1">
                <p className="font-bold text-slate-700 text-sm">No student records found in {divisionFilter}.</p>
                <p>When students verify with their physical ID card on the login page, their profile appears here permanently.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs sm:text-sm min-w-[580px]">
                <thead className="text-slate-600 uppercase bg-slate-50 sticky top-0 border-b border-slate-200 text-xs font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Roll</th>
                    <th className="py-2.5 px-3">PRN</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">ID Card</th>
                    <th className="py-2.5 px-3">Attendance</th>
                    <th className="py-2.5 px-3">1-Phone Lock</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredStudents.map(student => (
                    <tr key={student.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-bold text-slate-900">#{student.rollNo}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-xs">{student.prn}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{student.name}</td>
                      <td className="py-2.5 px-3">
                        {student.idCardPhoto ? (
                          <button
                            onClick={() => {
                              setSelectedPhoto(student.idCardPhoto);
                              setSelectedStudentName(student.name);
                            }}
                            className="flex items-center space-x-1 text-xs text-sky-600 hover:text-sky-800 font-semibold touch-target"
                            title="View ID Card"
                          >
                            <img src={student.idCardPhoto} alt="ID" className="w-6 h-6 object-cover border border-slate-300 shadow-sm" />
                            <span>View</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs font-medium">Pending</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-bold">
                        <span className={student.isDefaulter ? 'text-rose-600' : 'text-emerald-700'}>
                          {student.attendancePercentage || 100}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {student.boundDeviceId ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200 uppercase">
                            🔒 Bound
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 font-medium text-[10px] uppercase">
                            Unbound
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {student.boundDeviceId && (
                            <button
                              onClick={() => handleResetDevice(student.id, student.name)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition touch-target"
                              title="Reset Phone Lock"
                            >
                              <Unlock className="w-3 h-3 inline mr-0.5" />
                              Reset
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteStudent(student.id, student.name, student.rollNo)}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition flex items-center space-x-0.5 touch-target"
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
        <div className="bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center space-x-2 truncate">
                <Bell className="w-4 h-4 text-sky-600 flex-shrink-0" />
                <span className="truncate">Live Registration & ID Audit Feed</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 truncate">Real-time log of verified ID cards in {currentDeptObj?.name}</p>
            </div>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200 flex items-center space-x-1.5 flex-shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>● Permanent Feed</span>
            </span>
          </div>

          <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
            {studentLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-medium">
                No student logins recorded yet for this department.
              </div>
            ) : (
              studentLogs.map(log => (
                <div
                  key={log.id || log.studentId}
                  className="p-3 sm:p-3.5 bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-100 transition"
                >
                  <div className="flex items-center space-x-3 min-w-0 w-full sm:w-auto">
                    {log.idCardPhoto ? (
                      <img
                        src={log.idCardPhoto}
                        alt="ID Card"
                        onClick={() => {
                          setSelectedPhoto(log.idCardPhoto);
                          setSelectedStudentName(log.studentName);
                        }}
                        className="w-11 h-11 sm:w-12 sm:h-12 object-cover border border-slate-300 cursor-pointer hover:scale-105 transition flex-shrink-0 shadow-sm"
                        title="Click to view full ID Card"
                      />
                    ) : (
                      <div className="w-11 h-11 sm:w-12 sm:h-12 bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center flex-shrink-0">
                        #{log.rollNo}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">{log.studentName}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 bg-white text-slate-700 border border-slate-200 flex-shrink-0">
                          #{log.rollNo} • {log.division}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center space-x-1 font-mono truncate">
                        <Smartphone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="truncate">PRN: {log.prn} • Dev: {log.deviceId ? log.deviceId.substring(0, 8) : 'LOCKED'}...</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end space-x-2 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ✓ ID Verified
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteStudent(log.studentId, log.studentName, log.rollNo)}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition flex items-center space-x-1 touch-target flex-shrink-0"
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
        <div className="space-y-5 sm:space-y-6">
          <div className="bg-white border border-slate-200 p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-slate-200">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center space-x-2 truncate">
                  <UserCheck className="w-4 h-4 text-sky-600 flex-shrink-0" />
                  <span className="truncate">{currentDeptObj?.code} Faculty Roster</span>
                </h3>
                <p className="text-xs text-slate-500 font-normal truncate">Teachers registered under this department</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {teachers.length === 0 ? (
                <div className="col-span-1 sm:col-span-2 lg:col-span-3 p-6 text-center text-slate-400 text-xs font-medium">
                  No professors have logged in through this department yet.
                </div>
              ) : (
                teachers.map(t => (
                  <div key={t.id} className="p-4 bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-sky-600">{t.role || 'Teacher'}</span>
                      <h4 className="font-bold text-slate-900 text-sm mt-0.5 truncate">{t.name}</h4>
                      {t.subjectName && (
                        <p className="text-xs text-slate-700 font-medium mt-1 truncate">📚 {t.subjectName}</p>
                      )}
                      <p className="text-xs text-slate-500 truncate">{t.email}</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700">● Active</span>
                      <button
                        onClick={() => handleResetTeacherPassword(t.id, t.name)}
                        className="text-xs font-semibold px-2 py-1 bg-white hover:bg-rose-50 hover:text-rose-700 text-slate-700 border border-slate-200 transition touch-target"
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
          <div className="bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-3.5">
            <h3 className="text-sm sm:text-base font-bold text-slate-900">Lecture Session History</h3>
            <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
              {facultyLogs.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs font-medium">No lectures recorded yet.</div>
              ) : (
                facultyLogs.map(log => (
                  <div key={log.id} className="p-3.5 bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">👨‍🏫 {log.teacherName}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 bg-white text-slate-700 border border-slate-200 flex-shrink-0">
                          {log.subjectName}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Divisions: <span className="font-bold text-slate-800">{log.division}</span>
                        {log.batch !== 'All' ? ` • Batch: ${log.batch}` : ''}
                        {log.totalPresent !== undefined ? ` • Present: ${log.totalPresent}` : ''}
                      </p>
                    </div>

                    <div className="text-left sm:text-right border-t sm:border-t-0 pt-1.5 sm:pt-0 border-slate-200 w-full sm:w-auto">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 uppercase border ${
                        log.type === 'FACULTY_LECTURE_START' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-200 text-slate-700 border-slate-300'
                      }`}>
                        {log.type === 'FACULTY_LECTURE_START' ? '● Active' : 'Concluded'}
                      </span>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white border border-slate-200 p-4 sm:p-5 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase truncate block">{currentDeptObj?.code} Total Students</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">{stats?.totalStudents || students.length || 0}</div>
              <p className="text-xs text-slate-400 mt-0.5 font-medium truncate">Permanent roster</p>
            </div>

            <div className="bg-white border border-slate-200 p-4 sm:p-5 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase truncate block">Faculty Count</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">{teachers.length}</div>
              <p className="text-xs text-slate-400 mt-0.5 font-medium truncate">Password protected</p>
            </div>

            <div className="bg-white border border-slate-200 p-4 sm:p-5 shadow-sm">
              <span className="text-xs font-semibold text-sky-600 uppercase truncate block">Lectures Conducted</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-sky-600 mt-1">{facultyLogs.length}</div>
              <p className="text-xs text-slate-400 mt-0.5 font-medium truncate">Sessions logged</p>
            </div>

            <div className="bg-white border border-slate-200 p-4 sm:p-5 shadow-sm">
              <span className="text-xs font-semibold text-amber-600 uppercase truncate block">Defaulter Students</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-1">{defaulters.length}</div>
              <p className="text-xs text-slate-400 mt-0.5 font-medium truncate">&lt; 75% threshold</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DEFAULTERS */}
      {activeTab === 'defaulters' && (
        <div className="bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Monthly Defaulters (&lt; 75%)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Students below 75% attendance in {currentDeptObj?.name}</p>
            </div>
          </div>

          <div className="overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
            <table className="w-full text-left text-xs sm:text-sm min-w-[500px]">
              <thead className="text-slate-600 uppercase bg-slate-50 border-b border-slate-200 text-xs font-bold">
                <tr>
                  <th className="py-2.5 px-3">Roll No</th>
                  <th className="py-2.5 px-3">PRN</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Div</th>
                  <th className="py-2.5 px-3">Attended</th>
                  <th className="py-2.5 px-3">Attendance %</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {defaulters.map(student => (
                  <tr key={student.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-bold text-slate-900">#{student.rollNo}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-xs">{student.prn}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{student.name}</td>
                    <td className="py-2.5 px-3">{student.division}</td>
                    <td className="py-2.5 px-3">{student.attendedLectures} / {student.totalLectures}</td>
                    <td className="py-2.5 px-3 font-bold text-rose-600">{student.attendancePercentage}%</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 bg-rose-50 text-rose-700 font-semibold text-[10px] border border-rose-200 uppercase">
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
        <div className="bg-white border border-slate-200 p-5 sm:p-6 shadow-sm max-w-lg">
          <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center space-x-2">
            <Key className="w-4 h-4 text-sky-600" />
            <span>Change HOD Private Password</span>
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Update master password for {currentHodName} ({currentDeptObj?.name}).
          </p>

          {passMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              {passMsg}
            </div>
          )}

          {passError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              ⚠️ {passError}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)}
                placeholder="Enter current password"
                className="w-full bg-white border border-slate-300 px-3.5 py-2.5 text-base sm:text-sm text-slate-900 font-semibold focus:border-slate-800 outline-none min-h-[44px]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                New Secret Password
              </label>
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Min. 6 characters"
                className="w-full bg-white border border-slate-300 px-3.5 py-2.5 text-base sm:text-sm text-slate-900 font-semibold focus:border-slate-800 outline-none min-h-[44px]"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm uppercase tracking-wider transition active:scale-[0.98] min-h-[44px] touch-target"
            >
              Update HOD Password
            </button>
          </form>
        </div>
      )}

      {/* HOD CONDUCT LECTURE MODAL */}
      {showHodLectureModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center space-x-2">
              <Play className="w-5 h-5 text-sky-600" />
              <span>Launch Lecture as HOD</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">Conduct class session as {currentHodName} ({currentDeptObj?.code})</p>

            <form onSubmit={handleLaunchHodLectureSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Subject / Lecture Name</label>
                <input
                  type="text"
                  value={hodSubject}
                  onChange={(e) => setHodSubject(e.target.value)}
                  placeholder="e.g. Digital Signal Processing"
                  className="w-full bg-white border border-slate-300 px-3 py-2 text-base sm:text-xs text-slate-900 font-semibold outline-none focus:border-slate-800 min-h-[44px]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Select Division(s)</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {DIVISIONS.map(div => {
                    const isChecked = hodDivisions.includes(div);
                    return (
                      <button
                        key={div}
                        type="button"
                        onClick={() => toggleHodDivision(div)}
                        className={`py-2 text-xs font-bold border transition touch-target flex items-center justify-center ${
                          isChecked ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-300 text-slate-700'
                        }`}
                      >
                        {div}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Lecture Type / Batch</label>
                <select
                  value={hodBatch}
                  onChange={(e) => setHodBatch(e.target.value)}
                  className="w-full bg-white border border-slate-300 px-3 py-2 text-base sm:text-xs text-slate-900 font-semibold outline-none focus:border-slate-800 min-h-[44px]"
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
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 touch-target flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider touch-target flex items-center justify-center"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 p-5 max-w-sm w-full max-h-[90vh] overflow-y-auto text-center shadow-xl">
            <h3 className="text-sm font-bold text-slate-900 mb-1">{selectedStudentName || 'Student'}</h3>
            <p className="text-xs text-slate-500 mb-3">Physical College ID Card Verification</p>
            <img src={selectedPhoto} alt="Student ID" className="w-full max-h-[60vh] object-contain border border-slate-200 mb-3" />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="w-full py-2 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider touch-target flex items-center justify-center"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}

      {/* ADD STUDENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-3.5">Add Student to {currentDeptObj?.code} Roster</h3>
            <form onSubmit={handleAddStudent} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Roll No</label>
                  <input
                    type="number"
                    value={newRollNo}
                    onChange={(e) => setNewRollNo(e.target.value)}
                    placeholder="e.g. 24"
                    className="w-full bg-white border border-slate-300 px-3 py-2 text-base sm:text-sm text-slate-900 font-semibold outline-none focus:border-slate-800 min-h-[44px]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">PRN</label>
                  <input
                    type="text"
                    value={newPrn}
                    onChange={(e) => setNewPrn(e.target.value)}
                    placeholder="e.g. 12251ET049"
                    className="w-full bg-white border border-slate-300 px-3 py-2 text-base sm:text-sm text-slate-900 font-semibold outline-none focus:border-slate-800 min-h-[44px]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Student Full Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter Full Name"
                  className="w-full bg-white border border-slate-300 px-3 py-2 text-base sm:text-sm text-slate-900 font-semibold outline-none focus:border-slate-800 min-h-[44px]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Division</label>
                  <select
                    value={newDivision}
                    onChange={(e) => setNewDivision(e.target.value)}
                    className="w-full bg-white border border-slate-300 px-3 py-2 text-base sm:text-sm text-slate-900 font-semibold outline-none focus:border-slate-800 min-h-[44px]"
                  >
                    <option value="SY-A">SY-A</option>
                    <option value="SY-B">SY-B</option>
                    <option value="SY-C">SY-C</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Batch</label>
                  <select
                    value={newBatch}
                    onChange={(e) => setNewBatch(e.target.value)}
                    className="w-full bg-white border border-slate-300 px-3 py-2 text-base sm:text-sm text-slate-900 font-semibold outline-none focus:border-slate-800 min-h-[44px]"
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
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 touch-target flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider touch-target flex items-center justify-center"
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
