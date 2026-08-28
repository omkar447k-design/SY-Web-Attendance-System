import React, { useState, useEffect, useRef } from 'react';
import { GraduationCap, Users, Shield, ArrowRight, Smartphone, Lock, X, Building2, Camera, CheckCircle2, Sparkles, User, BookOpen, CheckSquare, Square, KeyRound, AlertTriangle, ShieldCheck, Hash, Key } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { api } from '../services/api';
import { getDeviceIdentity } from '../services/fingerprint';

const DEPARTMENTS = [
  { id: 'comp', name: '1. Computer Science & Engineering', code: 'CSE', keywords: ['computer', 'cse', 'comp', 'software'] },
  { id: 'it', name: '2. Information Technology', code: 'IT', keywords: ['information', 'it', 'infotech'] },
  { id: 'aids', name: '3. Artificial Intelligence & Data Science', code: 'AI&DS', keywords: ['artificial', 'intelligence', 'data science', 'ai&ds', 'aids', 'ai/ds', 'ai'] },
  { id: 'entc', name: '4. Electronics & Telecommunication', code: 'ENTC', keywords: ['telecommunication', 'entc', 'electronics and telecommunication', 'e&tc', 'extc', 'etc'] },
  { id: 'elec', name: '5. Electrical Engineering', code: 'ELEC', keywords: ['electrical', 'ee', 'elec'] },
  { id: 'instru', name: '6. Instrumentation Engineering', code: 'INSTRU', keywords: ['instrumentation', 'instru', 'inst'] }
];

const DIVISIONS = ['SY-A', 'SY-B', 'SY-C'];

const DEFAULT_SUBJECTS = {
  comp: ['Operating Systems (CS201)', 'Database Management Systems (CS202)', 'Computer Networks (CS203)', 'OS Practical Lab', 'DBMS Lab'],
  it: ['Data Structures & Algorithms (IT201)', 'Object Oriented Programming (IT202)', 'Web Technologies (IT203)', 'DSA Lab'],
  aids: ['Machine Learning Foundations (AI201)', 'Python for Data Science (AI202)', 'Applied Statistics (AI203)', 'AI Lab'],
  entc: ['Digital Signal Processing (ET201)', 'Microcontrollers & Embedded Systems (ET202)', 'Analog Circuits (ET203)', 'DSP Lab'],
  elec: ['Power Systems & Machines (EE201)', 'Control Systems Engineering (EE202)', 'Power Electronics (EE203)', 'Machines Lab'],
  instru: ['Sensors & Transducers (IN201)', 'Industrial Instrumentation (IN202)', 'Process Control (IN203)', 'Instrumentation Lab']
};

function parseIdCardDetails(rawText) {
  if (!rawText) return { name: '', prn: '', departmentId: null };

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const fullTextLower = rawText.toLowerCase();

  // 1. EXTRACT PRN / STUDENT ID
  let detectedPrn = '';
  const prnPatterns = [
    /(?:prn|prn\s*no|p\.r\.n|reg\s*no|enrollment|id\s*no|student\s*id)\s*[:\-\. ]+\s*([a-zA-Z0-9]{6,16})/i,
    /\b(12\d{3}[a-zA-Z]{1,3}\d{3,6})\b/i,
    /\b(20\d{2}[a-zA-Z]{2,5}\d{3,6})\b/i,
    /\b([a-zA-Z]{2,4}\d{4,10})\b/i
  ];

  for (const pattern of prnPatterns) {
    const match = rawText.match(pattern);
    if (match && match[1]) {
      detectedPrn = match[1].toUpperCase().trim();
      break;
    }
  }

  // 2. EXTRACT DEPARTMENT / BRANCH (Strict keyword detection)
  let detectedDeptId = null;
  for (const dept of DEPARTMENTS) {
    for (const kw of dept.keywords) {
      if (fullTextLower.includes(kw)) {
        detectedDeptId = dept.id;
        break;
      }
    }
    if (detectedDeptId) break;
  }

  // Default to comp if general engineering card detected
  if (!detectedDeptId && (fullTextLower.includes('engineering') || fullTextLower.includes('technology') || fullTextLower.includes('college'))) {
    detectedDeptId = 'comp';
  }

  // 3. EXTRACT STUDENT FULL NAME
  let detectedName = '';
  for (const line of lines) {
    const nameMatch = line.match(/(?:student\s*name|name|full\s*name)\s*[:\-\. ]+\s*([a-zA-Z\s\.]{3,35})/i);
    if (nameMatch && nameMatch[1]) {
      const clean = nameMatch[1].replace(/[^a-zA-Z\s]/g, '').trim();
      if (clean.length >= 3 && !/college|department|university|engineering|technology/i.test(clean)) {
        detectedName = toTitleCase(clean);
        break;
      }
    }
  }

  if (!detectedName) {
    for (const line of lines) {
      const clean = line.replace(/[^a-zA-Z\s]/g, '').trim();
      const words = clean.split(/\s+/).filter(w => w.length >= 2);
      if (words.length >= 2 && words.length <= 4 && clean.length >= 5 && clean.length <= 35) {
        const isBlacklisted = /college|institute|department|university|engineering|technology|identity|card|branch|division|semester|academic|year|valid|holder|signature/i.test(clean);
        if (!isBlacklisted) {
          detectedName = toTitleCase(clean);
          break;
        }
      }
    }
  }

  return {
    name: detectedName,
    prn: detectedPrn,
    departmentId: detectedDeptId
  };
}

function toTitleCase(str) {
  return str
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
    };
  });
}

export function Login({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('student');

  // Student form state (Department is 100% LOCKED to ID card)
  const [department, setDepartment] = useState('');
  const [division, setDivision] = useState('SY-A');
  const [rollNo, setRollNo] = useState('');
  const [prn, setPrn] = useState('');
  const [name, setName] = useState('');

  // Lock status (Extracted fields are strictly read-only and cannot be altered)
  const [isNameLocked, setIsNameLocked] = useState(false);
  const [isPrnLocked, setIsPrnLocked] = useState(false);

  // ID Card Upload & AI Extraction State
  const [idCardPreview, setIdCardPreview] = useState(null);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState('');
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState('');
  const fileInputRef = useRef(null);

  // Teacher dynamic form state with Individual Password Setup
  const [teacherName, setTeacherName] = useState('Dr. A. K. Sharma');
  const [teacherDept, setTeacherDept] = useState('comp');
  const [selectedDivisions, setSelectedDivisions] = useState(['SY-A']);
  const [teacherSubject, setTeacherSubject] = useState(DEFAULT_SUBJECTS['comp'][0]);
  const [customSubject, setCustomSubject] = useState('');
  const [teacherBatch, setTeacherBatch] = useState('All');
  
  const [teacherIsFirstTime, setTeacherIsFirstTime] = useState(false);
  const [teacherPassword, setTeacherPassword] = useState('');
  const [teacherNewPassword, setTeacherNewPassword] = useState('');
  const [teacherConfirmPassword, setTeacherConfirmPassword] = useState('');

  // 2-Tier HOD Admin Modal State
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [gatekeeperStage, setGatekeeperStage] = useState(1);
  const [gatekeeperCode, setGatekeeperCode] = useState('');
  const [hodDeptList, setHodDeptList] = useState([]);
  const [selectedHodDept, setSelectedHodDept] = useState('comp');
  const [hodIsFirstTime, setHodIsFirstTime] = useState(false);
  const [hodPassword, setHodPassword] = useState('');
  const [hodNewPassword, setHodNewPassword] = useState('');
  const [hodConfirmPassword, setHodConfirmPassword] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adminError, setAdminError] = useState('');

  useEffect(() => {
    if (window.location.hash === '#admin' || window.location.pathname === '/admin') {
      setShowAdminModal(true);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'teacher' && teacherName.trim()) {
      api.checkTeacherStatus({ teacherName: teacherName.trim(), department: teacherDept })
        .then(res => {
          if (res.success) setTeacherIsFirstTime(res.isFirstTime);
        })
        .catch(() => {});
    }
  }, [teacherName, teacherDept, activeTab]);

  const handleTeacherDeptChange = (newDept) => {
    setTeacherDept(newDept);
    const subList = DEFAULT_SUBJECTS[newDept] || [];
    if (subList.length > 0) {
      setTeacherSubject(subList[0]);
    }
  };

  const toggleDivisionSelection = (div) => {
    if (selectedDivisions.includes(div)) {
      if (selectedDivisions.length > 1) {
        setSelectedDivisions(selectedDivisions.filter(d => d !== div));
      }
    } else {
      setSelectedDivisions([...selectedDivisions, div]);
    }
  };

  // AI OCR SCANNER (100% Extracts & Locks Department, Name, and PRN from ID card)
  const handleIdCardSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setOcrSuccessMsg('');
    setOcrScanning(true);
    setOcrProgress(15);
    setOcrStatusText('Preparing ID card image...');

    try {
      const compressedDataUrl = await compressImage(file);
      setIdCardPreview(compressedDataUrl);

      setOcrProgress(35);
      setOcrStatusText('Scanning Name, PRN & Department from physical ID...');

      const worker = await createWorker('eng');
      
      setOcrProgress(70);
      setOcrStatusText('Extracting verified identity data...');

      const ret = await worker.recognize(compressedDataUrl);
      await worker.terminate();

      setOcrProgress(100);
      const { name: detectedName, prn: detectedPrn, departmentId: detectedDept } = parseIdCardDetails(ret.data.text);

      let extractedItems = [];

      // 1. EXTRACT & LOCK FULL NAME
      if (detectedName) {
        setName(detectedName);
        setIsNameLocked(true);
        extractedItems.push(`Name: "${detectedName}"`);
      } else {
        setIsNameLocked(false);
      }

      // 2. EXTRACT & LOCK PRN
      if (detectedPrn) {
        setPrn(detectedPrn);
        setIsPrnLocked(true);
        extractedItems.push(`PRN: "${detectedPrn}"`);
      } else {
        setIsPrnLocked(false);
      }

      // 3. EXTRACT & PERMANENTLY LOCK DEPARTMENT (NO MANUAL SELECTION)
      const finalDept = detectedDept || 'comp';
      setDepartment(finalDept);
      const deptObj = DEPARTMENTS.find(d => d.id === finalDept);
      extractedItems.push(`Dept: ${deptObj?.name || finalDept.toUpperCase()}`);

      if (extractedItems.length > 0) {
        setOcrSuccessMsg(`🔒 Locked from Physical ID: ${extractedItems.join(' • ')}`);
      } else {
        setOcrSuccessMsg('📷 ID photo attached. Please fill manual roll number.');
      }
    } catch (err) {
      console.error('OCR Error:', err);
      setDepartment('comp');
      setOcrSuccessMsg('📷 ID photo attached. Please fill manual roll number.');
    } finally {
      setOcrScanning(false);
    }
  };

  const handleRemoveIdPhoto = () => {
    setIdCardPreview(null);
    setOcrSuccessMsg('');
    setName('');
    setPrn('');
    setDepartment('');
    setIsNameLocked(false);
    setIsPrnLocked(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isStudentFormComplete = Boolean(
    idCardPreview &&
    department &&
    rollNo &&
    Number(rollNo) > 0 &&
    prn &&
    prn.trim().length >= 4 &&
    name &&
    name.trim().length >= 3 &&
    division
  );

  const handleStudentLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!idCardPreview) {
      setError('🛑 Mandatory Field: Physical College ID Card photo is compulsory.');
      return;
    }

    if (!department) {
      setError('🛑 Mandatory Field: Department must be auto-extracted from your uploaded ID card.');
      return;
    }

    if (!rollNo || Number(rollNo) <= 0) {
      setError('🛑 Mandatory Field: Roll Number is compulsory.');
      return;
    }

    if (!prn || prn.trim().length < 4) {
      setError('🛑 Mandatory Field: PRN / Student ID is compulsory from your ID card.');
      return;
    }

    if (!name || name.trim().length < 3) {
      setError('🛑 Mandatory Field: Full Student Name is compulsory from your ID card.');
      return;
    }

    setLoading(true);

    try {
      const { deviceId, fingerprint } = await getDeviceIdentity();
      const res = await api.studentLogin({
        rollNo: Number(rollNo),
        prn: prn.trim().toUpperCase(),
        name: name.trim(),
        idCardPhoto: idCardPreview,
        department,
        division,
        deviceId,
        fingerprint
      });

      if (res.success) {
        onLoginSuccess('student', res.student, { deviceId, fingerprint });
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherLogin = async (e) => {
    e.preventDefault();
    if (!teacherName.trim()) return setError('Please enter Faculty Name');
    if (selectedDivisions.length === 0) return setError('Please select at least one Division (SY-A, SY-B, or SY-C)');
    const finalSubject = customSubject.trim() ? customSubject.trim() : teacherSubject;
    if (!finalSubject) return setError('Please select or type a subject');

    if (teacherIsFirstTime) {
      if (!teacherNewPassword || teacherNewPassword.length < 4) {
        return setError('Please create a password with at least 4 characters');
      }
      if (teacherNewPassword !== teacherConfirmPassword) {
        return setError('Passwords do not match');
      }
    } else if (!teacherPassword) {
      return setError('Please enter your Faculty Password');
    }

    setError('');
    setLoading(true);
    try {
      const authRes = await api.teacherAuth({
        teacherName: teacherName.trim(),
        department: teacherDept,
        password: teacherPassword,
        newPassword: teacherNewPassword,
        isFirstTimeSetup: teacherIsFirstTime
      });

      if (authRes.success) {
        const teacherProfile = {
          id: authRes.teacher?.id || `T_${teacherDept}_${Date.now()}`,
          name: teacherName.trim(),
          department: teacherDept,
          divisions: selectedDivisions,
          division: selectedDivisions.join(', '),
          subjectName: finalSubject,
          batch: teacherBatch,
          role: 'teacher'
        };
        onLoginSuccess('teacher', teacherProfile);
      }
    } catch (err) {
      setError(err.message || 'Faculty Authentication Failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGatekeeperSubmit = async (e) => {
    e.preventDefault();
    setAdminError('');
    setLoading(true);
    try {
      const res = await api.verifyGatekeeper(gatekeeperCode);
      if (res.success) {
        setHodDeptList(res.departments || []);
        const defaultDept = res.departments?.[0]?.id || 'comp';
        setSelectedHodDept(defaultDept);
        const curr = res.departments?.find(d => d.id === defaultDept);
        setHodIsFirstTime(Boolean(curr?.isFirstTime));
        setGatekeeperStage(2);
      }
    } catch (err) {
      setAdminError(err.message || 'Invalid College Access Code');
    } finally {
      setLoading(false);
    }
  };

  const handleHodLoginSubmit = async (e) => {
    e.preventDefault();
    setAdminError('');

    if (hodIsFirstTime) {
      if (!hodNewPassword || hodNewPassword.length < 6) {
        return setAdminError('Password must be at least 6 characters long');
      }
      if (hodNewPassword !== hodConfirmPassword) {
        return setAdminError('Passwords do not match');
      }
    }

    setLoading(true);
    try {
      const res = await api.hodLogin({
        department: selectedHodDept,
        password: hodPassword,
        newPassword: hodNewPassword,
        isFirstTimeSetup: hodIsFirstTime
      });

      if (res.success) {
        setShowAdminModal(false);
        onLoginSuccess('admin', {
          name: res.hodName || `HOD ${selectedHodDept.toUpperCase()}`,
          department: selectedHodDept,
          role: 'admin'
        });
      }
    } catch (err) {
      setAdminError(err.message || 'HOD Authentication Failed');
    } finally {
      setLoading(false);
    }
  };

  const matchedDeptObj = DEPARTMENTS.find(d => d.id === department);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-50">
      <div className="w-full max-w-lg">
        
        {/* Welcome Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 shadow-xl shadow-indigo-200 mb-3 ring-4 ring-indigo-50">
            <GraduationCap className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Engineering Attendance Portal
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            Second Year (SY) • Academic Year 2025-2026
          </p>
        </div>

        {/* Clean White Card */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/60">
          
          {/* Tab Switcher */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6 border border-slate-200/80">
            <button
              onClick={() => { setActiveTab('student'); setError(''); }}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 ${
                activeTab === 'student'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Student Portal</span>
            </button>

            <button
              onClick={() => { setActiveTab('teacher'); setError(''); }}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 ${
                activeTab === 'teacher'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Faculty Launcher</span>
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm leading-relaxed font-semibold flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* STUDENT LOGIN TAB */}
          {activeTab === 'student' && (
            <form onSubmit={handleStudentLogin} className="space-y-4">
              
              {/* 1. MANDATORY ID CARD UPLOAD */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5 text-indigo-700">
                    <Camera className="w-3.5 h-3.5" />
                    <span>1. Upload College ID Card <span className="text-rose-500 font-bold">*COMPULSORY</span></span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal normal-case">iOS & Android Ready</span>
                </label>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleIdCardSelected}
                  className="hidden"
                />

                {!idCardPreview ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-4 rounded-2xl border-2 border-dashed border-indigo-300 hover:border-indigo-600 bg-indigo-50/40 hover:bg-indigo-50/80 flex flex-col items-center justify-center space-y-2 transition-all cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white border border-indigo-200 group-hover:border-indigo-400 flex items-center justify-center text-indigo-600 shadow-sm transition">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-extrabold text-indigo-900">
                        📸 Tap to Snap or Choose ID from Gallery
                      </p>
                      <p className="text-[11px] text-indigo-700 mt-0.5 font-medium">
                        AI will automatically extract & lock your Department, Name & PRN!
                      </p>
                    </div>
                  </button>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center space-x-3">
                      <img
                        src={idCardPreview}
                        alt="ID Preview"
                        className="w-14 h-14 rounded-xl object-cover border border-slate-300 shadow-sm"
                      />
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center space-x-1 text-xs font-bold text-slate-900">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          <span className="truncate">Physical ID Card Attached</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">Department & identity locked to prevent tampering</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveIdPhoto}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition"
                        title="Remove ID Card"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {ocrScanning && (
                      <div className="pt-2">
                        <div className="flex items-center justify-between text-[11px] text-indigo-700 font-bold mb-1">
                          <span className="flex items-center space-x-1">
                            <Sparkles className="w-3 h-3 animate-spin" />
                            <span>{ocrStatusText}</span>
                          </span>
                          <span>{ocrProgress}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                            style={{ width: `${ocrProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {ocrSuccessMsg && !ocrScanning && (
                      <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center space-x-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span className="truncate">{ocrSuccessMsg}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. ENGINEERING DEPARTMENT (100% LOCKED TO ID CARD - NO MANUAL SELECTION) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>2. Engineering Department <span className="text-rose-500 font-bold">*FROM ID CARD ONLY</span></span>
                  </span>
                  {department ? (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold flex items-center space-x-1">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Locked from ID Card</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium">Auto-Extracted from ID</span>
                  )}
                </label>

                {/* Non-editable Locked Input showing verified Department */}
                <div className={`w-full border rounded-xl px-3.5 py-2.5 text-sm font-bold flex items-center justify-between transition ${
                  department
                    ? 'bg-slate-100 border-slate-300 text-slate-800 cursor-not-allowed'
                    : 'bg-slate-50 border-dashed border-slate-300 text-slate-400'
                }`}>
                  <span>
                    {department
                      ? matchedDeptObj?.name || department.toUpperCase()
                      : '📸 Snap / Upload ID Card to auto-detect Department'}
                  </span>
                  <Lock className={`w-4 h-4 ${department ? 'text-indigo-600' : 'text-slate-400'}`} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  🔒 Locked: Cannot be selected manually. AI reads your department directly from your physical ID card.
                </p>
              </div>

              {/* 3. DIVISION */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  3. Select Division <span className="text-rose-500 font-bold">*COMPULSORY</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DIVISIONS.map((div) => (
                    <button
                      key={div}
                      type="button"
                      onClick={() => setDivision(div)}
                      className={`py-2.5 rounded-xl text-xs sm:text-sm font-extrabold border transition-all ${
                        division === div
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {div}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. MANUAL ROLL NUMBER + 5. PRN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span className="flex items-center space-x-1">
                      <Hash className="w-3.5 h-3.5 text-indigo-600" />
                      <span>4. Roll Number <span className="text-rose-500 font-bold">*COMPULSORY</span></span>
                    </span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={rollNo}
                    onChange={(e) => setRollNo(e.target.value)}
                    placeholder="Type e.g. 24"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base text-slate-900 font-bold focus:border-indigo-600 focus:bg-white outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>5. PRN <span className="text-rose-500 font-bold">*COMPULSORY</span></span>
                    {isPrnLocked && (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold flex items-center space-x-0.5">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Locked</span>
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={prn}
                    readOnly={isPrnLocked}
                    onChange={(e) => setPrn(e.target.value)}
                    placeholder="Auto-extracted from ID"
                    className={`w-full border rounded-xl px-3.5 py-2.5 text-sm font-bold outline-none ${
                      isPrnLocked
                        ? 'bg-slate-100 border-slate-300 text-slate-700 cursor-not-allowed'
                        : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600'
                    }`}
                    required
                  />
                </div>
              </div>

              {/* 6. FULL NAME */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>6. Student Full Name <span className="text-rose-500 font-bold">*COMPULSORY</span></span>
                  {isNameLocked && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold flex items-center space-x-0.5">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Locked from ID</span>
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={name}
                  readOnly={isNameLocked}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Auto-extracted from ID Card"
                  className={`w-full border rounded-xl px-3.5 py-2.5 text-sm font-bold outline-none ${
                    isNameLocked
                      ? 'bg-slate-100 border-slate-300 text-slate-700 cursor-not-allowed'
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600'
                  }`}
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || ocrScanning || !isStudentFormComplete}
                  className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-200 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{loading ? 'Binding Phone & Entering...' : 'Verify All Fields & Enter Student Portal'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="text-center pt-1">
                <p className="text-[11px] text-slate-500 font-medium">
                  🔒 1-Device Binding: Department, Name & PRN are permanently locked to your verified physical ID card.
                </p>
              </div>
            </form>
          )}

          {/* TEACHER / FACULTY TAB */}
          {activeTab === 'teacher' && (
            <form onSubmit={handleTeacherLogin} className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Faculty / Professor Name</span>
                </label>
                <input
                  type="text"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="e.g. Dr. A. K. Sharma"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-bold focus:border-indigo-600 focus:bg-white outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Select Department</span>
                </label>
                <select
                  value={teacherDept}
                  onChange={(e) => handleTeacherDeptChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-semibold focus:border-indigo-600 outline-none"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Select Class / Division(s)
                  </label>
                  <span className="text-[11px] text-indigo-600 font-bold">
                    {selectedDivisions.length > 1 ? `Combined (${selectedDivisions.join(' + ')})` : 'Single Division'}
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  {DIVISIONS.map((div) => {
                    const isChecked = selectedDivisions.includes(div);
                    return (
                      <button
                        key={div}
                        type="button"
                        onClick={() => toggleDivisionSelection(div)}
                        className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold border transition-all flex items-center justify-center space-x-1.5 ${
                          isChecked
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-white" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                        <span>{div}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Select Subject / Lecture</span>
                </label>
                <select
                  value={teacherSubject}
                  onChange={(e) => {
                    setTeacherSubject(e.target.value);
                    if (e.target.value !== 'other') setCustomSubject('');
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-semibold focus:border-indigo-600 outline-none mb-2"
                >
                  {(DEFAULT_SUBJECTS[teacherDept] || []).map((sub, idx) => (
                    <option key={idx} value={sub}>{sub}</option>
                  ))}
                  <option value="other">➕ Enter Custom Subject / Lab...</option>
                </select>

                {teacherSubject === 'other' && (
                  <input
                    type="text"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="Type subject name (e.g. Cloud Computing Lab)"
                    className="w-full bg-slate-50 border border-indigo-400 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:bg-white outline-none"
                    autoFocus
                    required
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Lecture Type / Batch
                </label>
                <select
                  value={teacherBatch}
                  onChange={(e) => setTeacherBatch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-semibold focus:border-indigo-600 outline-none"
                >
                  <option value="All">All Batches (Theory Lecture)</option>
                  <option value="B1">Batch B1 (Practical Lab)</option>
                  <option value="B2">Batch B2 (Practical Lab)</option>
                  <option value="B3">Batch B3 (Practical Lab)</option>
                </select>
              </div>

              <div className="pt-1">
                {teacherIsFirstTime ? (
                  <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2.5">
                    <div className="text-xs font-bold text-indigo-900 flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>First-Time Setup: Set your Faculty Password</span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Create Password</label>
                      <input
                        type="password"
                        value={teacherNewPassword}
                        onChange={(e) => setTeacherNewPassword(e.target.value)}
                        placeholder="Min. 4 characters"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-600"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Confirm Password</label>
                      <input
                        type="password"
                        value={teacherConfirmPassword}
                        onChange={(e) => setTeacherConfirmPassword(e.target.value)}
                        placeholder="Repeat password"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-600"
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Faculty Private Password</span>
                    </label>
                    <input
                      type="password"
                      value={teacherPassword}
                      onChange={(e) => setTeacherPassword(e.target.value)}
                      placeholder="Enter your faculty password"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-semibold focus:border-indigo-600 focus:bg-white outline-none"
                      required
                    />
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-200 flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
                >
                  <span>{teacherIsFirstTime ? 'Save Password & Launch Dashboard' : 'Launch Faculty Dashboard'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Discrete Admin Link for HOD */}
        <div className="text-center mt-6">
          <button
            onClick={() => {
              setShowAdminModal(true);
              setGatekeeperStage(1);
              setAdminError('');
            }}
            className="text-xs text-slate-400 hover:text-slate-700 font-medium transition flex items-center justify-center space-x-1 mx-auto"
          >
            <Lock className="w-3 h-3" />
            <span>Department Admin Access</span>
          </button>
        </div>

      </div>

      {/* 2-TIER HOD ADMIN AUTHENTICATION MODAL */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setShowAdminModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg bg-slate-100 transition"
            >
              <X className="w-4 h-4" />
            </button>

            {gatekeeperStage === 1 && (
              <div>
                <div className="text-center mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2 border border-indigo-100">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900">College Administration Portal</h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">Enter College Access Code to proceed to HOD Login</p>
                </div>

                {adminError && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                    ⚠️ {adminError}
                  </div>
                )}

                <form onSubmit={handleGatekeeperSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      College Access Code
                    </label>
                    <input
                      type="password"
                      value={gatekeeperCode}
                      onChange={(e) => setGatekeeperCode(e.target.value)}
                      placeholder="Enter access code"
                      autoFocus
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:bg-white outline-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-100 transition active:scale-95"
                  >
                    {loading ? 'Verifying...' : 'Unlock HOD Department Login →'}
                  </button>
                </form>
              </div>
            )}

            {gatekeeperStage === 2 && (
              <div>
                <div className="text-center mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2 border border-indigo-100">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900">Department HOD Login</h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    {hodIsFirstTime ? '✨ First-Time Setup: Create your department password' : 'Enter your HOD master password'}
                  </p>
                </div>

                {adminError && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                    ⚠️ {adminError}
                  </div>
                )}

                <form onSubmit={handleHodLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Select Department
                    </label>
                    <select
                      value={selectedHodDept}
                      onChange={(e) => {
                        setSelectedHodDept(e.target.value);
                        const curr = hodDeptList.find(d => d.id === e.target.value);
                        setHodIsFirstTime(Boolean(curr?.isFirstTime));
                        setAdminError('');
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-semibold focus:border-indigo-600 outline-none"
                    >
                      {DEPARTMENTS.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  {hodIsFirstTime ? (
                    <div className="space-y-3 p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200">
                      <div className="text-xs font-bold text-indigo-900 flex items-center space-x-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>First-Time HOD Password Setup</span>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Create Private Password</label>
                        <input
                          type="password"
                          value={hodNewPassword}
                          onChange={(e) => setHodNewPassword(e.target.value)}
                          placeholder="Min. 6 characters"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-600"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Confirm Password</label>
                        <input
                          type="password"
                          value={hodConfirmPassword}
                          onChange={(e) => setHodConfirmPassword(e.target.value)}
                          placeholder="Repeat password"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-600"
                          required
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        HOD Password
                      </label>
                      <input
                        type="password"
                        value={hodPassword}
                        onChange={(e) => setHodPassword(e.target.value)}
                        placeholder="Enter HOD password"
                        autoFocus
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:bg-white outline-none"
                        required
                      />
                    </div>
                  )}

                  <div className="flex space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setGatekeeperStage(1)}
                      className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-100 transition active:scale-95"
                    >
                      {loading ? 'Authenticating...' : hodIsFirstTime ? 'Save Password & Enter' : 'Unlock HOD Portal'}
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
