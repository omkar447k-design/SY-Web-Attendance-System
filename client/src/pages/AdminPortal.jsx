import React, { useState, useEffect } from 'react';
import { Shield, Users, Settings, AlertTriangle, Download, RefreshCw, UserPlus, Unlock, Search, BookOpen, Key, Building2, ImageIcon, Bell, CheckCircle2, Smartphone, ShieldCheck, KeyRound, Clock, UserCheck, Trash2 } from 'lucide-react';
import { api } from '../services/api';

const DEPARTMENTS = [
  { id: 'comp', name: 'Computer Science & Engineering', code: 'CSE' },
  { id: 'it', name: 'Information Technology', code: 'IT' },
  { id: 'aids', name: 'Artificial Intelligence & Data Science', code: 'AI&DS' },
  { id: 'entc', name: 'Electronics & Telecommunication', code: 'ENTC' },
  { id: 'elec', name: 'Electrical Engineering', code: 'ELEC' },
  { id: 'instru', name: 'Instrumentation Engineering', code: 'INSTRU' }
];

export function AdminPortal() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [settings, setSettings] = useState({});
  const [loginLogs, setLoginLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [divisionFilter, setDivisionFilter] = useState('SY-A');
  const [loading, setLoading] = useState(true);

  // Selected ID Photo Modal
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedStudentName, setSelectedStudentName] = useState('');

  // Add Student state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRollNo, setNewRollNo] = useState('');
  const [newPrn, setNewPrn] = useState('');
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState('comp');
  const [newDivision, setNewDivision] = useState('SY-A');
  const [newBatch, setNewBatch] = useState('B1');

  // Password Change state
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [passError, setPassError] = useState('');

  // Faculty Passcode update state
  const [newFacultyPass, setNewFacultyPass] = useState('');
  const [facultyPassMsg, setFacultyPassMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, studRes, teachRes, subRes, setRes, logsRes] = await Promise.all([
        api.getAdminStats(departmentFilter !== 'all' ? departmentFilter : undefined),
        api.getStudents({ division: divisionFilter, department: departmentFilter !== 'all' ? departmentFilter : undefined }),
        api.getTeachers(),
        api.getSubjects(),
        api.getSettings(),
        api.getLoginLogs(departmentFilter !== 'all' ? departmentFilter : undefined)
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (studRes.success) setStudents(studRes.data);
      if (teachRes.success) setTeachers(teachRes.data);
      if (subRes.success) setSubjects(subRes.data);
      if (setRes.success) {
        setSettings(setRes.data);
        setNewFacultyPass(setRes.data.facultyPassword || 'faculty@2026');
      }
      if (logsRes.success) setLoginLogs(logsRes.data || []);
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [divisionFilter, departmentFilter]);

  // HOD EXPEL / DELETE SUSPICIOUS STUDENT
  const handleDeleteStudent = async (studentId, studentName, rollNo) => {
    if (!window.confirm(`⚠️ EXPEL STUDENT CONFIRMATION: Are you sure you want to permanently delete Roll No. ${rollNo} (${studentName}) from the database? All attendance records will be removed.`)) {
      return;
    }

    try {
      const res = await api.deleteStudent(studentId);
      if (res.success) {
        alert(res.message);
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
        alert(res.message);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to reset device');
    }
  };

  const handleResetTeacherPassword = async (teacherId, teacherName) => {
    if (!window.confirm(`Reset private password for professor ${teacherName}? They will be able to create a new password on their next login.`)) return;
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
        department: newDept,
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

  const handleUpdateFacultyPasscode = async (e) => {
    e.preventDefault();
    try {
      const res = await api.updateSettings({ ...settings, facultyPassword: newFacultyPass });
      if (res.success) {
        setFacultyPassMsg('✅ Faculty launcher security passcode updated!');
        setTimeout(() => setFacultyPassMsg(''), 4000);
      }
    } catch (err) {
      alert(err.message || 'Failed to update faculty passcode');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassMsg('');
    setPassError('');
    try {
      const dept = departmentFilter !== 'all' ? departmentFilter : 'comp';
      const res = await api.changeHodPassword({
        department: dept,
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

  const filteredStudents = students.filter(s => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = s.name.toLowerCase().includes(q) || String(s.rollNo).includes(q) || s.prn?.includes(q);
    const matchesDept = departmentFilter === 'all' || !s.department || s.department === departmentFilter;
    return matchesSearch && matchesDept;
  });

  const defaulters = students.filter(s => s.isDefaulter && (departmentFilter === 'all' || !s.department || s.department === departmentFilter));

  const studentLogs = loginLogs.filter(l => l.type === 'NEW_STUDENT_REGISTRATION' || l.type === 'STUDENT_LOGIN');
  const facultyLogs = loginLogs.filter(l => l.type === 'FACULTY_LECTURE_START' || l.type === 'FACULTY_LECTURE_END');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      
      {/* Header Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Department Head & Admin Portal</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            {departmentFilter === 'all' ? 'All Engineering Departments' : DEPARTMENTS.find(d => d.id === departmentFilter)?.name}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Academic Year 2025-2026 • Verified Roster & Audit Center</p>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 outline-none"
          >
            <option value="all">🏢 All 6 Departments</option>
            {DEPARTMENTS.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <a
            href={api.getMasterExcelUrl(divisionFilter)}
            download
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-100 transition"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export Excel</span>
          </a>

          <button
            onClick={loadData}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { id: 'overview', label: '📊 Overview & Stats', icon: Shield },
          { id: 'audit', label: `🔔 Live Student Logins (${studentLogs.length})`, icon: Bell },
          { id: 'faculty', label: `👨‍🏫 Faculty Lecture Logs (${facultyLogs.length})`, icon: UserCheck },
          { id: 'roster', label: `👥 Verified Student Roster (${filteredStudents.length})`, icon: Users },
          { id: 'defaulters', label: `⚠️ Defaulters (<75%) (${defaulters.length})`, icon: AlertTriangle },
          { id: 'settings', label: '⚙️ Security & Passcodes', icon: Settings }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center space-x-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <span className="text-xs font-bold text-slate-500 uppercase">Verified Students</span>
              <div className="text-3xl font-black text-slate-900 mt-1">{stats?.totalStudents || 0}</div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">1-Phone hardware bound</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <span className="text-xs font-bold text-slate-500 uppercase">Total Faculty</span>
              <div className="text-3xl font-black text-slate-900 mt-1">{stats?.totalTeachers || 0}</div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">Private Password protected</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <span className="text-xs font-bold text-indigo-600 uppercase">Lectures Conducted</span>
              <div className="text-3xl font-black text-indigo-600 mt-1">{stats?.totalSessions || 0}</div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">Multi-division sessions</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <span className="text-xs font-bold text-amber-600 uppercase">Defaulter Students</span>
              <div className="text-3xl font-black text-amber-600 mt-1">{defaulters.length}</div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">Below 75% threshold</p>
            </div>
          </div>

          {/* Faculty Management Matrix */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-base font-extrabold text-slate-900 mb-4 flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              <span>Department Faculty & Credentials Management</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {teachers.map(t => {
                const dept = DEPARTMENTS.find(d => d.id === t.department);
                return (
                  <div key={t.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-indigo-600">{dept?.name || t.department}</span>
                      <h4 className="font-bold text-slate-900 text-sm mt-0.5">{t.name}</h4>
                      <p className="text-xs text-slate-500 mt-1">{t.email}</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-600">● Password Active</span>
                      <button
                        onClick={() => handleResetTeacherPassword(t.id, t.name)}
                        className="text-[11px] font-bold px-2 py-1 rounded-lg bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-700 transition"
                      >
                        Reset Password
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE STUDENT LOGINS & ID AUDIT */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                <Bell className="w-5 h-5 text-indigo-600" />
                <span>Live Student Registration & Login Audit Feed</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Real-time logs with verified physical ID card thumbnails and device IDs</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>Live Updates</span>
            </span>
          </div>

          <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
            {studentLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-medium">
                No student logins recorded yet.
              </div>
            ) : (
              studentLogs.map(log => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-100/80 transition"
                >
                  <div className="flex items-center space-x-3">
                    {log.idCardPhoto ? (
                      <img
                        src={log.idCardPhoto}
                        alt="ID Card"
                        onClick={() => {
                          setSelectedPhoto(log.idCardPhoto);
                          setSelectedStudentName(log.studentName);
                        }}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-300 shadow-sm cursor-pointer hover:scale-105 transition"
                        title="Click to view full ID Card"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 font-extrabold text-sm flex items-center justify-center border border-indigo-100">
                        #{log.rollNo}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-slate-900 text-sm">{log.studentName}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                          Roll #{log.rollNo} • {log.division}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-1.5 font-mono">
                        <Smartphone className="w-3 h-3 text-slate-400" />
                        <span>PRN: {log.prn} • Dev: {log.deviceId ? log.deviceId.substring(0, 10) : 'LOCKED'}...</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 self-end sm:self-center">
                    <div className="text-right hidden sm:block">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ✓ Physical ID Verified
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteStudent(log.studentId, log.studentName, log.rollNo)}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center space-x-1"
                      title="Expel / Delete Fake Student Account"
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

      {/* TAB 3: FACULTY LECTURE HISTORY */}
      {activeTab === 'faculty' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-indigo-600" />
                <span>Faculty Login & Attendance Session History</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Audit log of lectures conducted by professors across divisions</p>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
            {facultyLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-medium">
                No faculty lectures recorded yet.
              </div>
            ) : (
              facultyLogs.map(log => (
                <div
                  key={log.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-slate-900 text-sm">👨‍🏫 {log.teacherName}</span>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {log.subjectName}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 font-medium">
                      Divisions: <span className="font-bold text-slate-900">{log.division}</span>
                      {log.batch !== 'All' ? ` • Batch: ${log.batch}` : ''}
                      {log.totalPresent !== undefined ? ` • Verified Present: ${log.totalPresent} students` : ''}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      log.type === 'FACULTY_LECTURE_START'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {log.type === 'FACULTY_LECTURE_START' ? '● Session Launched' : 'Concluded'}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(log.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: VERIFIED STUDENT ROSTER (WITH EXPEL BUTTON) */}
      {activeTab === 'roster' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <select
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
              >
                <option value="SY-A">Division SY-A</option>
                <option value="SY-B">Division SY-B</option>
                <option value="SY-C">Division SY-C</option>
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name / roll / PRN..."
                  className="bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-100 transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Student</span>
            </button>
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="text-slate-500 uppercase bg-slate-50 sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Roll No</th>
                  <th className="py-3 px-3">PRN</th>
                  <th className="py-3 px-3">Student Name</th>
                  <th className="py-3 px-3">Verified ID</th>
                  <th className="py-3 px-3">Attendance</th>
                  <th className="py-3 px-3">1-Phone Lock</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredStudents.map(student => (
                  <tr key={student.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3 font-extrabold text-slate-900">#{student.rollNo}</td>
                    <td className="py-3 px-3 text-slate-500 font-mono">{student.prn}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{student.name}</td>
                    <td className="py-3 px-3">
                      {student.idCardPhoto ? (
                        <button
                          onClick={() => {
                            setSelectedPhoto(student.idCardPhoto);
                            setSelectedStudentName(student.name);
                          }}
                          className="flex items-center space-x-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold"
                          title="View Verified Physical ID Card"
                        >
                          <img src={student.idCardPhoto} alt="ID" className="w-7 h-7 rounded-lg object-cover border border-slate-300 shadow-sm" />
                          <span>View ID</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs">Pending Upload</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-bold">
                      <span className={student.isDefaulter ? 'text-rose-600' : 'text-emerald-600'}>
                        {student.attendancePercentage}%
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {student.boundDeviceId ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200">
                          🔒 Bound
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold text-[11px]">
                          Unbound
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {student.boundDeviceId && (
                          <button
                            onClick={() => handleResetDevice(student.id, student.name)}
                            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold transition"
                            title="Reset Phone Lock"
                          >
                            <Unlock className="w-3 h-3 inline mr-0.5" />
                            Reset
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteStudent(student.id, student.name, student.rollNo)}
                          className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold transition flex items-center space-x-0.5"
                          title="Expel / Delete Suspicious Account"
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
          </div>
        </div>
      )}

      {/* TAB 5: DEFAULTERS */}
      {activeTab === 'defaulters' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span>Monthly Defaulter List (Attendance &lt; 75%)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Students below mandatory 75% attendance threshold</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Roll No</th>
                  <th className="py-3 px-3">PRN</th>
                  <th className="py-3 px-3">Student Name</th>
                  <th className="py-3 px-3">Division</th>
                  <th className="py-3 px-3">Attended</th>
                  <th className="py-3 px-3">Attendance %</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {defaulters.map(student => (
                  <tr key={student.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3 font-extrabold text-slate-900">#{student.rollNo}</td>
                    <td className="py-3 px-3 text-slate-500">{student.prn}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{student.name}</td>
                    <td className="py-3 px-3">{student.division}</td>
                    <td className="py-3 px-3">{student.attendedLectures} / {student.totalLectures}</td>
                    <td className="py-3 px-3 font-extrabold text-rose-600">{student.attendancePercentage}%</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[11px] border border-rose-200">
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

      {/* TAB 6: SECURITY & POLICIES */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 mb-2 flex items-center space-x-2">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <span>Master Faculty Launcher Passcode</span>
              </h3>
              <p className="text-xs text-slate-500 mb-4 font-medium">
                Emergency master passcode for faculty login.
              </p>

              {facultyPassMsg && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  {facultyPassMsg}
                </div>
              )}

              <form onSubmit={handleUpdateFacultyPasscode} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Faculty Passcode
                  </label>
                  <input
                    type="text"
                    value={newFacultyPass}
                    onChange={(e) => setNewFacultyPass(e.target.value)}
                    placeholder="e.g. faculty@2026"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-bold focus:border-indigo-600 outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-100 transition active:scale-[0.98]"
                >
                  Update Faculty Passcode
                </button>
              </form>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 mb-2 flex items-center space-x-2">
                <Key className="w-4 h-4 text-indigo-600" />
                <span>Change HOD Private Password</span>
              </h3>
              <p className="text-xs text-slate-500 mb-4 font-medium">
                Update the master password for {departmentFilter === 'all' ? 'HOD Computer Science' : departmentFilter.toUpperCase()}.
              </p>

              {passMsg && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  {passMsg}
                </div>
              )}

              {passError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
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
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 outline-none"
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
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition active:scale-[0.98]"
                >
                  Update HOD Password
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ID CARD FULL PHOTO INSPECTOR MODAL */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center">
            <h3 className="text-base font-extrabold text-slate-900 mb-1">{selectedStudentName || 'Student'}</h3>
            <p className="text-xs text-slate-500 mb-4">Physical College ID Card Verification</p>
            <img src={selectedPhoto} alt="Student ID" className="w-full rounded-2xl border border-slate-200 shadow-md mb-4" />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 text-white font-bold text-xs"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}

      {/* ADD STUDENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-extrabold text-slate-900 mb-4">Add Student to Roster</h3>
            <form onSubmit={handleAddStudent} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Department</label>
                <select
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600"
                >
                  {DEPARTMENTS.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Roll No</label>
                  <input
                    type="number"
                    value={newRollNo}
                    onChange={(e) => setNewRollNo(e.target.value)}
                    placeholder="e.g. 31"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">PRN</label>
                  <input
                    type="text"
                    value={newPrn}
                    onChange={(e) => setNewPrn(e.target.value)}
                    placeholder="12251ET031"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600"
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
                  placeholder="e.g. Rahul Sharma"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Division</label>
                  <select
                    value={newDivision}
                    onChange={(e) => setNewDivision(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600"
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
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600"
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
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-100"
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
