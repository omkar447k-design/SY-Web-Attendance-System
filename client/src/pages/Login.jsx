import React, { useState, useEffect, useRef } from 'react';
import {
  GraduationCap, Users, Shield, ArrowRight, Smartphone, Lock, X,
  Building2, Camera, CheckCircle2, Sparkles, User, BookOpen, CheckSquare,
  Square, KeyRound, AlertTriangle, ShieldCheck, Hash, Key, ScanFace,
  UserCheck, UserPlus, LogIn, RefreshCw
} from 'lucide-react';
import { createWorker } from 'tesseract.js';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import { getDeviceIdentity, getDeviceType, promptCompulsoryDeviceAuth } from '../services/fingerprint';

// 6 Engineering Departments with exact PRN 2-Letter Branch Code Mapping
const DEPARTMENTS = [
  { id: 'comp', name: '1. Computer Science & Engineering', code: 'CSE', prnCode: 'CS', keywords: ['computer', 'cse', 'comp'] },
  { id: 'it', name: '2. Information Technology', code: 'IT', prnCode: 'IT', keywords: ['information technology', 'infotech'] },
  { id: 'aids', name: '3. Artificial Intelligence & Data Science', code: 'AI&DS', prnCode: 'AD', keywords: ['artificial', 'data science', 'ai&ds', 'aids', 'ai/ds', 'ai & ds'] },
  { id: 'entc', name: '4. Electronics & Telecommunication', code: 'ENTC', prnCode: 'ET', keywords: ['electronics', 'telecommunication', 'entc', 'electronics & telecommunication', 'electronics and telecommunication', 'e&tc', 'extc', 'etc'] },
  { id: 'elec', name: '5. Electrical Engineering', code: 'ELEC', prnCode: 'EL', keywords: ['electrical', 'ee', 'elec'] },
  { id: 'instru', name: '6. Instrumentation Engineering', code: 'INSTRU', prnCode: 'IN', keywords: ['instrumentation', 'instru', 'inst'] }
];

const DIVISIONS = ['SY-A', 'SY-B', 'SY-C'];

function parseIdCardDetails(rawText) {
  if (!rawText) return { name: '', prn: '', departmentId: null };

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. EXTRACT PRN / ENROLLMENT NO
  let detectedPrn = '';
  const prnPatterns = [
    /(?:enrollment\s*no|prn|prn\s*no|p\.r\.n|reg\s*no|id\s*no|student\s*id)\s*[:\-\. ]+\s*([a-zA-Z0-9]{6,16})/i,
    /\b(12\d{3}(?:ET|CS|IT|AD|EL|IN)\d{3,6})\b/i,
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

  // 2. EXTRACT STUDENT FULL NAME
  let detectedName = '';
  const enrollIndex = lines.findIndex(l => /enrollment|prn|reg\s*no/i.test(l));
  if (enrollIndex > 0) {
    const prevLine = lines[enrollIndex - 1].replace(/[^a-zA-Z\s]/g, '').trim();
    if (prevLine.length >= 3 && !/aissms|institute|technology|college|engineering|adding value/i.test(prevLine)) {
      detectedName = toTitleCase(prevLine);
    }
  }

  if (!detectedName) {
    for (const line of lines) {
      const nameMatch = line.match(/(?:student\s*name|name|full\s*name)\s*[:\-\. ]+\s*([a-zA-Z\s\.]{3,35})/i);
      if (nameMatch && nameMatch[1]) {
        const clean = nameMatch[1].replace(/[^a-zA-Z\s]/g, '').trim();
        if (clean.length >= 3 && !/college|department|university|engineering|technology|institute|aissms/i.test(clean)) {
          detectedName = toTitleCase(clean);
          break;
        }
      }
    }
  }

  if (!detectedName) {
    for (const line of lines) {
      const clean = line.replace(/[^a-zA-Z\s]/g, '').trim();
      const words = clean.split(/\s+/).filter(w => w.length >= 2);
      if (words.length >= 2 && words.length <= 4 && clean.length >= 5 && clean.length <= 35) {
        const isBlacklisted = /college|institute|department|university|engineering|technology|identity|card|branch|division|semester|academic|year|valid|holder|signature|aissms|adding value/i.test(clean);
        if (!isBlacklisted) {
          detectedName = toTitleCase(clean);
          break;
        }
      }
    }
  }

  // 3. EXACT DEPARTMENT DETECTION VIA PRN 2-LETTER CODE
  let detectedDeptId = null;

  if (detectedPrn) {
    const cleanPrnUpper = detectedPrn.toUpperCase();
    if (cleanPrnUpper.includes('ET')) {
      detectedDeptId = 'entc';
    } else if (cleanPrnUpper.includes('CS')) {
      detectedDeptId = 'comp';
    } else if (cleanPrnUpper.includes('IT')) {
      detectedDeptId = 'it';
    } else if (cleanPrnUpper.includes('AD')) {
      detectedDeptId = 'aids';
    } else if (cleanPrnUpper.includes('EL')) {
      detectedDeptId = 'elec';
    } else if (cleanPrnUpper.includes('IN')) {
      detectedDeptId = 'instru';
    }
  }

  if (!detectedDeptId) {
    const candidateBodyLines = lines.filter(line => {
      const l = line.toLowerCase();
      return !l.includes('institute of') &&
             !l.includes('college of') &&
             !l.includes('adding value') &&
             !l.includes('aissms') &&
             !l.includes('university') &&
             !l.includes('identity card');
    });

    const deptLine = candidateBodyLines.find(l => /b\.?\s*tech|b\.?\s*e|branch|department|telecommunication|electronics|computer|artificial|instrumentation|electrical/i.test(l));
    const searchText = deptLine ? deptLine.toLowerCase() : candidateBodyLines.join(' ').toLowerCase();

    if (/electronics|telecommunication|entc|extc|e\s*&\s*tc|etc/i.test(searchText)) {
      detectedDeptId = 'entc';
    } else if (/artificial|data\s*science|ai\s*&\s*ds|aids|ai\/ds/i.test(searchText)) {
      detectedDeptId = 'aids';
    } else if (/computer|cse|software/i.test(searchText)) {
      detectedDeptId = 'comp';
    } else if (/information\s*technology|infotech/i.test(searchText)) {
      detectedDeptId = 'it';
    } else if (/electrical/i.test(searchText)) {
      detectedDeptId = 'elec';
    } else if (/instrumentation|instru/i.test(searchText)) {
      detectedDeptId = 'instru';
    }
  }

  return {
    name: detectedName,
    prn: detectedPrn,
    departmentId: detectedDeptId || 'entc'
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
        const maxDim = 640;
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
        resolve(canvas.toDataURL('image/jpeg', 0.70));
      };
    };
  });
}

export function Login({ onLoginSuccess }) {
  // Student Form Mode: 'login' (Daily 3-Field Entry) vs 'register' (First-Time ID Card & Device Binding)
  const [studentTab, setStudentTab] = useState('login');

  // --- DAILY LOGIN STATE (3 Fields: Dept, Division, Roll No) ---
  const [loginDept, setLoginDept] = useState('entc');
  const [loginDivision, setLoginDivision] = useState('SY-A');
  const [loginRollNo, setLoginRollNo] = useState('');

  // --- REGISTRATION STATE (ID Card + Device Binding) ---
  const [regDepartment, setRegDepartment] = useState('');
  const [regDivision, setRegDivision] = useState('SY-A');
  const [regRollNo, setRegRollNo] = useState('');
  const [regPrn, setRegPrn] = useState('');
  const [regName, setRegName] = useState('');

  const [isNameLocked, setIsNameLocked] = useState(false);
  const [isPrnLocked, setIsPrnLocked] = useState(false);

  const [idCardPreview, setIdCardPreview] = useState(null);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState('');
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState('');
  const fileInputRef = useRef(null);

  // --- ADMIN & FACULTY STATE ---
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [modalMode, setModalMode] = useState('select');
  const [gatekeeperStage, setGatekeeperStage] = useState(1);
  const [gatekeeperCode, setGatekeeperCode] = useState('');
  const [hodDeptList, setHodDeptList] = useState([]);
  
  const [teacherName, setTeacherName] = useState('');
  const [teacherDept, setTeacherDept] = useState('entc');
  const [teacherSubject, setTeacherSubject] = useState('');
  const [selectedDivisions, setSelectedDivisions] = useState(['SY-A']);
  const [teacherBatch, setTeacherBatch] = useState('All');
  const [teacherIsFirstTime, setTeacherIsFirstTime] = useState(false);
  const [teacherPassword, setTeacherPassword] = useState('');
  const [teacherNewPassword, setTeacherNewPassword] = useState('');
  const [teacherConfirmPassword, setTeacherConfirmPassword] = useState('');

  const [selectedHodDept, setSelectedHodDept] = useState('entc');
  const [hodName, setHodName] = useState('');
  const [hodIsFirstTime, setHodIsFirstTime] = useState(true);
  const [hodPassword, setHodPassword] = useState('');
  const [hodNewPassword, setHodNewPassword] = useState('');
  const [hodConfirmPassword, setHodConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adminError, setAdminError] = useState('');
  const [regSuccessData, setRegSuccessData] = useState(null);

  useEffect(() => {
    if (window.location.hash === '#admin' || window.location.pathname === '/admin') {
      setShowAdminModal(true);
    }
  }, []);

  useEffect(() => {
    if (modalMode === 'teacher' && teacherName.trim()) {
      api.checkTeacherStatus({ teacherName: teacherName.trim(), department: teacherDept })
        .then(res => {
          if (res.success) setTeacherIsFirstTime(res.isFirstTime);
        })
        .catch(() => {});
    }
  }, [teacherName, teacherDept, modalMode]);

  const updateSelectedHodDepartment = (deptId, deptList = hodDeptList) => {
    setSelectedHodDept(deptId);
    setAdminError('');

    const curr = deptList.find(d => d.id === deptId);
    if (curr && curr.isFirstTime === false && curr.hodName) {
      setHodIsFirstTime(false);
      setHodName(curr.hodName);
    } else {
      setHodIsFirstTime(true);
      setHodName('');
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

  // OCR Processing for Registration
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
      setOcrStatusText('Scanning Name, PRN & Branch code...');

      const worker = await createWorker('eng');
      
      setOcrProgress(70);
      setOcrStatusText('Matching PRN branch code & student details...');

      const ret = await worker.recognize(compressedDataUrl);
      await worker.terminate();

      setOcrProgress(100);
      const { name: detectedName, prn: detectedPrn, departmentId: detectedDept } = parseIdCardDetails(ret.data.text);

      let extractedItems = [];

      if (detectedName) {
        setRegName(detectedName);
        setIsNameLocked(true);
        extractedItems.push(`Name: "${detectedName}"`);
      } else {
        setIsNameLocked(false);
      }

      if (detectedPrn) {
        setRegPrn(detectedPrn);
        setIsPrnLocked(true);
        extractedItems.push(`PRN: "${detectedPrn}"`);
      } else {
        setIsPrnLocked(false);
      }

      const finalDept = detectedDept || 'entc';
      setRegDepartment(finalDept);
      const deptObj = DEPARTMENTS.find(d => d.id === finalDept);
      extractedItems.push(`Dept: ${deptObj?.name || finalDept.toUpperCase()}`);

      if (extractedItems.length > 0) {
        setOcrSuccessMsg(`🔒 Verified from Physical ID: ${extractedItems.join(' • ')}`);
      } else {
        setOcrSuccessMsg('📷 ID photo attached. Please fill manual roll number.');
      }
    } catch (err) {
      console.error('OCR Error:', err);
      setRegDepartment('entc');
      setOcrSuccessMsg('📷 ID photo attached. Please fill manual roll number.');
    } finally {
      setOcrScanning(false);
    }
  };

  const handleRemoveIdPhoto = () => {
    setIdCardPreview(null);
    setOcrSuccessMsg('');
    setRegName('');
    setRegPrn('');
    setRegDepartment('');
    setIsNameLocked(false);
    setIsPrnLocked(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 1. SUBMIT: DAILY STUDENT LOGIN (Matches 3 Fields + Same Device Verification)
  const handleDailyStudentLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!loginDept) {
      setError('🛑 Please select your Department.');
      return;
    }

    if (!loginDivision) {
      setError('🛑 Please select your Division.');
      return;
    }

    if (!loginRollNo || Number(loginRollNo) <= 0) {
      setError('🛑 Please enter a valid Roll Number.');
      return;
    }

    setLoading(true);

    try {
      // 1. Biometric / Passcode Verification on Mobile
      await promptCompulsoryDeviceAuth(`Roll_${loginRollNo}`);

      // 2. Capture Device Identity (SAME DEVICE CHECK)
      const { deviceId, fingerprint, deviceName, biometricName } = await getDeviceIdentity();

      // 3. Authenticate with server/cloud
      const res = await api.studentLogin({
        department: loginDept,
        division: loginDivision,
        rollNo: Number(loginRollNo),
        deviceId
      });

      if (res.success) {
        onLoginSuccess('student', res.student, { deviceId, fingerprint, deviceName, biometricName });
      }
    } catch (err) {
      setError(err.message || 'Login verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 2. SUBMIT: FIRST-TIME STUDENT REGISTRATION (Binds ID Card & Device)
  const handleStudentRegistration = async (e) => {
    e.preventDefault();
    setError('');

    if (!idCardPreview) {
      setError('🛑 Mandatory: Physical College ID Card photo is required for first-time registration.');
      return;
    }

    if (!regDepartment) {
      setError('🛑 Mandatory: Department must be selected or auto-detected from your ID card.');
      return;
    }

    if (!regRollNo || Number(regRollNo) <= 0) {
      setError('🛑 Mandatory: Valid Roll Number is required.');
      return;
    }

    if (!regPrn || regPrn.trim().length < 4) {
      setError('🛑 Mandatory: Valid PRN / Student ID is required.');
      return;
    }

    if (!regName || regName.trim().length < 3) {
      setError('🛑 Mandatory: Full Student Name is required.');
      return;
    }

    setLoading(true);

    try {
      // 1. Biometric / Passcode Verification on Mobile
      await promptCompulsoryDeviceAuth(regName.trim());

      // 2. Hardware Device Identity (FingerprintJS v4 + Hardware Canvas/WebGL Engine)
      const { deviceId, fingerprint, deviceName, biometricName } = await getDeviceIdentity();

      // 3. Register and Bind Device Permanently
      const res = await api.studentRegister({
        rollNo: Number(regRollNo),
        prn: regPrn.trim().toUpperCase(),
        name: regName.trim(),
        idCardPhoto: idCardPreview,
        department: regDepartment,
        division: regDivision,
        deviceId,
        fingerprint,
        deviceName,
        biometricMethod: biometricName
      });

      if (res.success) {
        try {
          confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
        } catch (e) {}

        setRegSuccessData({
          student: res.student,
          meta: { deviceId, fingerprint, deviceName, biometricName }
        });

        setTimeout(() => {
          onLoginSuccess('student', res.student, { deviceId, fingerprint, deviceName, biometricName });
        }, 1600);
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Duplicate records or conflicting details are prohibited.');
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherLogin = async (e) => {
    e.preventDefault();
    if (!teacherName.trim()) return setAdminError('Please enter your Faculty Name');
    if (!teacherSubject.trim()) return setAdminError('Please enter the Subject Name you teach');
    if (selectedDivisions.length === 0) return setAdminError('Please select at least one Division (SY-A, SY-B, or SY-C)');

    if (teacherIsFirstTime) {
      if (!teacherNewPassword || teacherNewPassword.length < 4) {
        return setAdminError('Please create a password with at least 4 characters');
      }
      if (teacherNewPassword !== teacherConfirmPassword) {
        return setAdminError('Passwords do not match');
      }
    } else if (!teacherPassword) {
      return setAdminError('Please enter your Faculty Password');
    }

    setAdminError('');
    setLoading(true);
    try {
      const authRes = await api.teacherAuth({
        teacherName: teacherName.trim(),
        department: teacherDept,
        subjectName: teacherSubject.trim(),
        password: teacherPassword,
        newPassword: teacherNewPassword,
        isFirstTimeSetup: teacherIsFirstTime
      });

      if (authRes.success) {
        setShowAdminModal(false);
        const teacherProfile = {
          id: authRes.teacher?.id || `T_${teacherDept}_${Date.now()}`,
          name: teacherName.trim(),
          department: teacherDept,
          divisions: selectedDivisions,
          division: selectedDivisions.join(', '),
          subjectName: teacherSubject.trim(),
          batch: teacherBatch,
          role: 'teacher'
        };
        onLoginSuccess('teacher', teacherProfile);
      }
    } catch (err) {
      setAdminError(err.message || 'Faculty Authentication Failed.');
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
        const defaultDept = res.departments?.[0]?.id || 'entc';
        setGatekeeperStage(2);
        setModalMode('select');
        updateSelectedHodDepartment(defaultDept, res.departments || []);
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
      if (!hodName.trim() || hodName.trim().length < 3) {
        return setAdminError('Please enter your Full Name as HOD');
      }
      if (!hodNewPassword || hodNewPassword.length < 4) {
        return setAdminError('Please create a password with at least 4 characters');
      }
      if (hodNewPassword !== hodConfirmPassword) {
        return setAdminError('Passwords do not match');
      }
    } else if (!hodPassword) {
      return setAdminError('Please enter your HOD Password');
    }

    setLoading(true);
    try {
      const res = await api.hodLogin({
        department: selectedHodDept,
        hodName: hodName.trim(),
        password: hodPassword,
        newPassword: hodNewPassword,
        isFirstTimeSetup: hodIsFirstTime
      });

      if (res.success) {
        const finalName = res.hodName || hodName.trim() || 'Department Head';
        setShowAdminModal(false);
        onLoginSuccess('admin', {
          name: finalName,
          department: selectedHodDept,
          role: 'admin'
        });
      }
    } catch (err) {
      setAdminError(err.message || 'HOD Authentication Failed. Please verify your password.');
    } finally {
      setLoading(false);
    }
  };

  const isRegFormComplete = Boolean(
    idCardPreview &&
    regDepartment &&
    regRollNo &&
    Number(regRollNo) > 0 &&
    regPrn &&
    regPrn.trim().length >= 4 &&
    regName &&
    regName.trim().length >= 3 &&
    regDivision
  );

  const matchedRegDeptObj = DEPARTMENTS.find(d => d.id === regDepartment);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-50">
      <div className="w-full max-w-lg mx-auto">
        
        {/* Welcome Header */}
        <div className="text-center mb-5">
          <GraduationCap className="w-10 h-10 text-slate-900 mx-auto mb-2 stroke-[1.5]" />
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight uppercase">
            Attendance Portal
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5 font-medium">
            Engineering Department Verification • AY 2025-2026
          </p>
        </div>

        {/* Main Card: STUDENT PORTAL (Tabs for Login vs Register) */}
        <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
          
          {/* TAB HEADER: 1. DAILY LOGIN vs 2. NEW REGISTRATION */}
          <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-100/70">
            <button
              type="button"
              onClick={() => { setStudentTab('login'); setError(''); }}
              className={`py-3.5 px-3 text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition border-b-2 ${
                studentTab === 'login'
                  ? 'bg-white text-slate-900 border-slate-900 shadow-sm'
                  : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <LogIn className="w-4 h-4 text-sky-600 flex-shrink-0" />
              <span className="truncate">Student Login</span>
            </button>

            <button
              type="button"
              onClick={() => { setStudentTab('register'); setError(''); }}
              className={`py-3.5 px-3 text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition border-b-2 ${
                studentTab === 'register'
                  ? 'bg-white text-slate-900 border-slate-900 shadow-sm'
                  : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <UserPlus className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="truncate">New Registration</span>
            </button>
          </div>

          <div className="p-5 sm:p-7">
            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-semibold flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* ============================================================ */}
            {/* TAB 1: DAILY STUDENT LOGIN (3-Field Match + Same Device Lock) */}
            {/* ============================================================ */}
            {studentTab === 'login' && (
              <form onSubmit={handleDailyStudentLogin} className="space-y-4">
                <div className="pb-1 border-b border-slate-100">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                    <UserCheck className="w-4 h-4 text-sky-600" />
                    <span>Daily Attendance Login</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-normal">
                    Requires same device registered with your Roll No.
                  </p>
                </div>

                {/* 1. DEPARTMENT SELECTOR */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
                    <Building2 className="w-3.5 h-3.5 text-sky-600" />
                    <span>1. Department <span className="text-rose-600 font-bold">*</span></span>
                  </label>
                  <select
                    value={loginDept}
                    onChange={(e) => setLoginDept(e.target.value)}
                    className="w-full bg-white border border-slate-300 px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-900 outline-none focus:border-slate-800"
                    required
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. DIVISION SELECTOR */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    2. Division <span className="text-rose-600 font-bold">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {DIVISIONS.map((div) => (
                      <button
                        key={div}
                        type="button"
                        onClick={() => setLoginDivision(div)}
                        className={`py-2.5 text-xs sm:text-sm font-bold border transition flex items-center justify-center ${
                          loginDivision === div
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {div}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. ROLL NUMBER */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span className="flex items-center space-x-1.5">
                      <Hash className="w-3.5 h-3.5 text-sky-600" />
                      <span>3. Roll Number <span className="text-rose-600 font-bold">*</span></span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">e.g. 24</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={loginRollNo}
                    onChange={(e) => setLoginRollNo(e.target.value)}
                    placeholder="Enter your Roll No."
                    className="w-full bg-white border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 font-bold focus:border-slate-800 outline-none min-h-[44px]"
                    required
                  />
                </div>

                {/* BIOMETRIC SECURITY BANNER (Mobile: Apple Face ID / Android Fingerprint) */}
                {getDeviceType().isMobile && (
                  <div className="p-3 bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="w-7 h-7 bg-sky-50 border border-sky-200 flex items-center justify-center flex-shrink-0">
                        {getDeviceType().type === 'ios' ? (
                          <ScanFace className="w-4 h-4 text-sky-600" />
                        ) : (
                          <Smartphone className="w-4 h-4 text-sky-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate flex items-center space-x-1.5">
                          <span>{getDeviceType().biometricName}</span>
                          <span className="text-[9px] text-sky-700 bg-sky-50 px-1 py-0.5 border border-sky-200 font-bold uppercase">
                            Required
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium truncate">
                          {getDeviceType().type === 'ios' ? 'Apple Face ID & iPhone Passcode' : 'Fingerprint Sensor & Screen PIN'}
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 border border-emerald-200 flex-shrink-0 ml-2">
                      ● Active
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || !loginRollNo}
                    className="w-full py-3.5 sm:py-4 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm tracking-wide uppercase flex items-center justify-center space-x-2 transition active:scale-[0.99] disabled:opacity-30 disabled:cursor-not-allowed min-h-[48px]"
                  >
                    <ShieldCheck className="w-4 h-4 text-sky-400 flex-shrink-0" />
                    <span className="truncate">
                      {loading
                        ? 'Verifying Device & Entering...'
                        : getDeviceType().isMobile
                        ? `Verify ${getDeviceType().type === 'ios' ? 'Face ID' : 'Fingerprint'} & Enter Portal`
                        : 'Verify Identity & Enter Student Portal'}
                    </span>
                    <ArrowRight className="w-4 h-4 flex-shrink-0" />
                  </button>
                </div>

                <div className="text-center pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-600 font-medium">
                    First time on this phone?{' '}
                    <button
                      type="button"
                      onClick={() => { setStudentTab('register'); setError(''); }}
                      className="font-bold text-sky-600 hover:underline"
                    >
                      Register New Account & Bind Device →
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* ============================================================ */}
            {/* TAB 2: FIRST-TIME REGISTRATION (Physical ID + Phone Binding)  */}
            {/* ============================================================ */}
            {studentTab === 'register' && (
              <form onSubmit={handleStudentRegistration} className="space-y-4">
                <div className="pb-1 border-b border-slate-100">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                    <UserPlus className="w-4 h-4 text-emerald-600" />
                    <span>New Student Registration</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-normal">
                    Permanently binds your Physical ID Card to this device.
                  </p>
                </div>

                {/* 1. MANDATORY ID CARD UPLOAD */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span className="flex items-center space-x-1.5 text-slate-900">
                      <Camera className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
                      <span>1. Upload College ID Card <span className="text-rose-600 font-bold">*REQUIRED</span></span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal normal-case hidden xs:inline">Camera / Gallery</span>
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
                      className="w-full p-4 border border-dashed border-slate-300 hover:border-slate-500 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center space-y-1.5 transition cursor-pointer group"
                    >
                      <Camera className="w-6 h-6 text-slate-500 group-hover:text-slate-900 transition" />
                      <div className="text-center">
                        <p className="text-xs font-bold text-slate-800">
                          Tap to Snap or Upload ID Card Photo
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 font-normal">
                          AI auto-detects PRN branch code (ET, CS, IT, AD, EL, IN) & locks department
                        </p>
                      </div>
                    </button>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center space-x-3">
                        <img
                          src={idCardPreview}
                          alt="ID Preview"
                          className="w-12 h-12 sm:w-14 sm:h-14 object-cover border border-slate-300 flex-shrink-0"
                        />
                        <div className="flex-1 overflow-hidden min-w-0">
                          <div className="flex items-center space-x-1 text-xs font-bold text-slate-900">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            <span className="truncate">Physical ID Card Attached</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">Department & identity locked to prevent tampering</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveIdPhoto}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white border border-slate-200 transition flex-shrink-0"
                          title="Remove ID Card"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {ocrScanning && (
                        <div className="pt-1">
                          <div className="flex items-center justify-between text-xs text-slate-800 font-bold mb-1">
                            <span className="flex items-center space-x-1 truncate">
                              <Sparkles className="w-3 h-3 animate-spin text-sky-600 flex-shrink-0" />
                              <span className="truncate">{ocrStatusText}</span>
                            </span>
                            <span className="flex-shrink-0">{ocrProgress}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 overflow-hidden">
                            <div
                              className="h-full bg-slate-800 transition-all duration-200"
                              style={{ width: `${ocrProgress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}

                      {ocrSuccessMsg && !ocrScanning && (
                        <div className="p-2 bg-slate-100 border border-slate-200 text-slate-800 text-xs font-medium flex items-center space-x-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
                          <span className="truncate">{ocrSuccessMsg}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. ENGINEERING DEPARTMENT */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span className="flex items-center space-x-1.5">
                      <Building2 className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
                      <span>2. Department <span className="text-rose-600 font-bold">*FROM ID CARD</span></span>
                    </span>
                    {regDepartment ? (
                      <span className="text-[10px] text-slate-700 bg-slate-100 px-2 py-0.5 border border-slate-200 font-bold flex items-center space-x-1 flex-shrink-0">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Locked</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium">Auto-Extracted</span>
                    )}
                  </label>

                  <div className={`w-full border px-3.5 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-between transition min-h-[44px] ${
                    regDepartment
                      ? 'bg-slate-100 border-slate-300 text-slate-900 cursor-not-allowed'
                      : 'bg-slate-50 border-dashed border-slate-300 text-slate-400'
                  }`}>
                    <span className="truncate pr-2">
                      {regDepartment
                        ? matchedRegDeptObj?.name || regDepartment.toUpperCase()
                        : '📸 Upload ID Card to auto-detect'}
                    </span>
                    <Lock className={`w-4 h-4 flex-shrink-0 ${regDepartment ? 'text-slate-600' : 'text-slate-400'}`} />
                  </div>
                </div>

                {/* 3. DIVISION */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    3. Select Division <span className="text-rose-600 font-bold">*REQUIRED</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {DIVISIONS.map((div) => (
                      <button
                        key={div}
                        type="button"
                        onClick={() => setRegDivision(div)}
                        className={`py-2.5 text-xs sm:text-sm font-bold border transition flex items-center justify-center ${
                          regDivision === div
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {div}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. ROLL NO & PRN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      4. Roll No <span className="text-rose-600 font-bold">*REQUIRED</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={regRollNo}
                      onChange={(e) => setRegRollNo(e.target.value)}
                      placeholder="e.g. 24"
                      className="w-full bg-white border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 font-bold focus:border-slate-800 outline-none min-h-[44px]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>5. PRN <span className="text-rose-600 font-bold">*REQUIRED</span></span>
                      {isPrnLocked && (
                        <span className="text-[10px] text-slate-700 bg-slate-100 px-1.5 py-0.5 border border-slate-200 font-bold flex items-center space-x-0.5">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Locked</span>
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={regPrn}
                      readOnly={isPrnLocked}
                      onChange={(e) => setRegPrn(e.target.value)}
                      placeholder="From ID Card"
                      className={`w-full border px-3.5 py-2.5 text-base sm:text-sm font-bold outline-none min-h-[44px] ${
                        isPrnLocked
                          ? 'bg-slate-100 border-slate-300 text-slate-700 cursor-not-allowed'
                          : 'bg-white border-slate-300 text-slate-900 focus:border-slate-800'
                      }`}
                      required
                    />
                  </div>
                </div>

                {/* 6. FULL NAME */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>6. Student Full Name <span className="text-rose-600 font-bold">*REQUIRED</span></span>
                    {isNameLocked && (
                      <span className="text-[10px] text-slate-700 bg-slate-100 px-1.5 py-0.5 border border-slate-200 font-bold flex items-center space-x-0.5">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Locked</span>
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={regName}
                    readOnly={isNameLocked}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Auto-extracted from ID Card"
                    className={`w-full border px-3.5 py-2.5 text-base sm:text-sm font-bold outline-none min-h-[44px] ${
                      isNameLocked
                        ? 'bg-slate-100 border-slate-300 text-slate-700 cursor-not-allowed'
                        : 'bg-white border-slate-300 text-slate-900 focus:border-slate-800'
                      }`}
                    required
                  />
                </div>

                {/* BIOMETRIC SECURITY BANNER */}
                {getDeviceType().isMobile && (
                  <div className="p-3 bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="w-7 h-7 bg-sky-50 border border-sky-200 flex items-center justify-center flex-shrink-0">
                        {getDeviceType().type === 'ios' ? (
                          <ScanFace className="w-4 h-4 text-sky-600" />
                        ) : (
                          <Smartphone className="w-4 h-4 text-sky-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate flex items-center space-x-1.5">
                          <span>{getDeviceType().biometricName}</span>
                          <span className="text-[9px] text-sky-700 bg-sky-50 px-1 py-0.5 border border-sky-200 font-bold uppercase">
                            Lock
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium truncate">
                          Device will be permanently bound to this account
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 border border-emerald-200 flex-shrink-0 ml-2">
                      ● Active
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || ocrScanning || !isRegFormComplete}
                    className="w-full py-3.5 sm:py-4 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm tracking-wide uppercase flex items-center justify-center space-x-2 transition active:scale-[0.99] disabled:opacity-30 disabled:cursor-not-allowed min-h-[48px]"
                  >
                    <ShieldCheck className="w-4 h-4 text-sky-400 flex-shrink-0" />
                    <span className="truncate">
                      {loading ? 'Binding Phone & Registering...' : 'Bind Device & Create Account'}
                    </span>
                    <ArrowRight className="w-4 h-4 flex-shrink-0" />
                  </button>
                </div>

                <div className="text-center pt-2 border-t border-slate-100">
                  <p className="text-xs text-slate-600 font-medium">
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => { setStudentTab('login'); setError(''); }}
                      className="font-bold text-sky-600 hover:underline"
                    >
                      Click here to Login directly →
                    </button>
                  </p>
                </div>
              </form>
            )}

          </div>

        </div>

        {/* Secure Access Link for Faculty & Department HOD */}
        <div className="text-center mt-5">
          <button
            onClick={() => {
              setShowAdminModal(true);
              setGatekeeperStage(1);
              setModalMode('select');
              setAdminError('');
            }}
            className="text-xs text-slate-500 hover:text-slate-900 font-semibold tracking-wider transition flex items-center justify-center space-x-1 mx-auto"
          >
            <Lock className="w-3.5 h-3.5 text-sky-600" />
            <span>Faculty & Department Admin Access</span>
          </button>
        </div>

      </div>

      {/* DEPARTMENT ADMIN & FACULTY MODAL */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 p-6 sm:p-8 max-w-md w-full max-h-[92vh] overflow-y-auto relative shadow-xl">
            
            <button
              onClick={() => setShowAdminModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* STAGE 1: COLLEGE GATEKEEPER PASSCODE */}
            {gatekeeperStage === 1 && (
              <form onSubmit={handleGatekeeperSubmit} className="space-y-4">
                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-slate-100 border border-slate-200 mx-auto flex items-center justify-center mb-3">
                    <Lock className="w-6 h-6 text-slate-800" />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">College Administration</h2>
                  <p className="text-xs text-slate-500 mt-1">Enter Master Gatekeeper Code to Proceed</p>
                </div>

                {adminError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                    {adminError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    College Access Code
                  </label>
                  <input
                    type="password"
                    value={gatekeeperCode}
                    onChange={(e) => setGatekeeperCode(e.target.value)}
                    placeholder="Enter Gatekeeper Code"
                    className="w-full bg-white border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-slate-800 outline-none"
                    autoFocus
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !gatekeeperCode}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wide transition disabled:opacity-40"
                >
                  {loading ? 'Verifying...' : 'Unlock Portal Access'}
                </button>
              </form>
            )}

            {/* STAGE 2: ROLE SELECTION & LOGIN (HOD vs FACULTY) */}
            {gatekeeperStage === 2 && (
              <div>
                {/* Mode Selector */}
                <div className="flex border-b border-slate-200 mb-6">
                  <button
                    type="button"
                    onClick={() => { setModalMode('select'); setAdminError(''); }}
                    className={`flex-1 py-2.5 text-xs font-bold transition border-b-2 ${
                      modalMode === 'select'
                        ? 'border-slate-900 text-slate-900'
                        : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    🏢 Department HOD
                  </button>
                  <button
                    type="button"
                    onClick={() => { setModalMode('teacher'); setAdminError(''); }}
                    className={`flex-1 py-2.5 text-xs font-bold transition border-b-2 ${
                      modalMode === 'teacher'
                        ? 'border-slate-900 text-slate-900'
                        : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    👨‍🏫 Faculty Member
                  </button>
                </div>

                {adminError && (
                  <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                    {adminError}
                  </div>
                )}

                {/* HOD LOGIN FORM */}
                {modalMode === 'select' && (
                  <form onSubmit={handleHodLoginSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Select Department
                      </label>
                      <select
                        value={selectedHodDept}
                        onChange={(e) => updateSelectedHodDepartment(e.target.value)}
                        className="w-full bg-white border border-slate-300 px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-900 outline-none focus:border-slate-800"
                      >
                        {DEPARTMENTS.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>

                    {hodIsFirstTime ? (
                      <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200">
                        <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                          <KeyRound className="w-4 h-4 text-sky-600" />
                          <span>First-Time HOD Account Registration</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Register your name and secure password for this Department.
                        </p>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            HOD Full Name
                          </label>
                          <input
                            type="text"
                            value={hodName}
                            onChange={(e) => setHodName(e.target.value)}
                            placeholder="e.g. Dr. Patil / Prof. Sharma"
                            className="w-full bg-white border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-slate-800"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Create Master Password
                          </label>
                          <input
                            type="password"
                            value={hodNewPassword}
                            onChange={(e) => setHodNewPassword(e.target.value)}
                            placeholder="At least 4 characters"
                            className="w-full bg-white border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-slate-800"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                            Confirm Password
                          </label>
                          <input
                            type="password"
                            value={hodConfirmPassword}
                            onChange={(e) => setHodConfirmPassword(e.target.value)}
                            placeholder="Re-type password"
                            className="w-full bg-white border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-slate-800"
                            required
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                          <span>HOD Password</span>
                          <span className="text-[11px] text-slate-500 font-normal">Head: {hodName}</span>
                        </label>
                        <input
                          type="password"
                          value={hodPassword}
                          onChange={(e) => setHodPassword(e.target.value)}
                          placeholder="Enter your HOD Password"
                          className="w-full bg-white border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-slate-800 outline-none"
                          required
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wide transition"
                    >
                      {loading ? 'Authenticating...' : hodIsFirstTime ? 'Create HOD Account & Enter' : 'Enter HOD Administration'}
                    </button>
                  </form>
                )}

                {/* TEACHER / FACULTY LOGIN FORM */}
                {modalMode === 'teacher' && (
                  <form onSubmit={handleTeacherLogin} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Department
                      </label>
                      <select
                        value={teacherDept}
                        onChange={(e) => setTeacherDept(e.target.value)}
                        className="w-full bg-white border border-slate-300 px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-900 outline-none focus:border-slate-800"
                      >
                        {DEPARTMENTS.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Faculty Name
                      </label>
                      <input
                        type="text"
                        value={teacherName}
                        onChange={(e) => setTeacherName(e.target.value)}
                        placeholder="e.g. Prof. R. K. Sharma"
                        className="w-full bg-white border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-slate-800 outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Subject Name
                      </label>
                      <input
                        type="text"
                        value={teacherSubject}
                        onChange={(e) => setTeacherSubject(e.target.value)}
                        placeholder="e.g. Digital Signal Processing"
                        className="w-full bg-white border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-slate-800 outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Select Divisions
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {DIVISIONS.map(div => (
                          <button
                            key={div}
                            type="button"
                            onClick={() => toggleDivisionSelection(div)}
                            className={`py-2 text-xs font-bold border transition ${
                              selectedDivisions.includes(div)
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {div}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Faculty Password
                      </label>
                      <input
                        type="password"
                        value={teacherPassword}
                        onChange={(e) => setTeacherPassword(e.target.value)}
                        placeholder="Enter Faculty Password"
                        className="w-full bg-white border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-slate-800 outline-none"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wide transition"
                    >
                      {loading ? 'Authenticating...' : 'Enter Faculty Portal'}
                    </button>
                  </form>
                )}

              </div>
            )}

          </div>
        </div>
      )}

      {/* REGISTRATION SUCCESS CELEBRATION MODAL */}
      {regSuccessData && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-emerald-500 p-6 sm:p-8 max-w-md w-full text-center shadow-2xl">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center rounded-full mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mb-1 uppercase tracking-tight">
              Registration Successful!
            </h2>
            <p className="text-xs text-slate-600 mb-4">
              Your College ID & Device have been permanently bound to the database.
            </p>

            <div className="p-3.5 bg-slate-50 border border-slate-200 text-left text-xs space-y-1.5 mb-6">
              <div className="flex justify-between">
                <span className="text-slate-500">Student:</span>
                <span className="font-bold text-slate-900">{regSuccessData.student.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Roll No & Div:</span>
                <span className="font-bold text-slate-900">Roll {regSuccessData.student.rollNo} ({regSuccessData.student.division})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Department:</span>
                <span className="font-bold text-slate-900">{regSuccessData.student.department.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Device Lock:</span>
                <span className="font-bold text-emerald-700">🔒 Bound Permanently</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onLoginSuccess('student', regSuccessData.student, regSuccessData.meta)}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition cursor-pointer"
            >
              <span>Enter Student Portal Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default Login;
