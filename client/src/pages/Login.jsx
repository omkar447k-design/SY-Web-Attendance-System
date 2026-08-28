import React, { useState, useEffect, useRef } from 'react';
import { GraduationCap, Users, Shield, ArrowRight, Smartphone, Lock, X, Building2, Camera, CheckCircle2, Sparkles, User, BookOpen, CheckSquare, Square, KeyRound, AlertTriangle, ShieldCheck, Hash, Key } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { api } from '../services/api';
import { getDeviceIdentity } from '../services/fingerprint';

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

  // 1. EXTRACT PRN / ENROLLMENT NO (e.g. 12251ET049, 12251CS020)
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

  // 3. EXACT DEPARTMENT DETECTION VIA PRN 2-LETTER CODE (CS, IT, AD, ET, EL, IN)
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

  // Fallback from Degree Line
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
        const maxDim = 1000;
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
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
    };
  });
}

export function Login({ onLoginSuccess }) {
  // Student form state
  const [department, setDepartment] = useState('');
  const [division, setDivision] = useState('SY-A');
  const [rollNo, setRollNo] = useState('');
  const [prn, setPrn] = useState('');
  const [name, setName] = useState('');

  // Lock status
  const [isNameLocked, setIsNameLocked] = useState(false);
  const [isPrnLocked, setIsPrnLocked] = useState(false);

  // ID Card Upload & AI Extraction State
  const [idCardPreview, setIdCardPreview] = useState(null);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState('');
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState('');
  const fileInputRef = useRef(null);

  // Department Admin & Faculty Modal State
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [modalMode, setModalMode] = useState('select'); // 'select' | 'teacher' | 'hod'
  const [gatekeeperStage, setGatekeeperStage] = useState(1);
  const [gatekeeperCode, setGatekeeperCode] = useState('');
  const [hodDeptList, setHodDeptList] = useState([]);
  
  // Faculty Teacher Form State
  const [teacherName, setTeacherName] = useState('');
  const [teacherDept, setTeacherDept] = useState('entc');
  const [teacherSubject, setTeacherSubject] = useState('');
  const [selectedDivisions, setSelectedDivisions] = useState(['SY-A']);
  const [teacherBatch, setTeacherBatch] = useState('All');
  const [teacherIsFirstTime, setTeacherIsFirstTime] = useState(false);
  const [teacherPassword, setTeacherPassword] = useState('');
  const [teacherNewPassword, setTeacherNewPassword] = useState('');
  const [teacherConfirmPassword, setTeacherConfirmPassword] = useState('');

  // HOD Form State (1 HOD per Department)
  const [selectedHodDept, setSelectedHodDept] = useState('entc');
  const [hodName, setHodName] = useState('');
  const [hodIsFirstTime, setHodIsFirstTime] = useState(true);
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
    if (modalMode === 'teacher' && teacherName.trim()) {
      api.checkTeacherStatus({ teacherName: teacherName.trim(), department: teacherDept })
        .then(res => {
          if (res.success) setTeacherIsFirstTime(res.isFirstTime);
        })
        .catch(() => {});
    }
  }, [teacherName, teacherDept, modalMode]);

  // Sync HOD Department State & Check Local Storage to never repeat setup
  const updateSelectedHodDepartment = (deptId, deptList = hodDeptList) => {
    setSelectedHodDept(deptId);
    setAdminError('');

    const curr = deptList.find(d => d.id === deptId);
    const localConfigured = localStorage.getItem(`sy_hod_configured_${deptId}`) === 'true';
    const localName = localStorage.getItem(`sy_hod_name_${deptId}`);

    if (localConfigured || (curr && curr.isFirstTime === false)) {
      setHodIsFirstTime(false);
      setHodName(localName || curr?.hodName || '');
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

  // AI OCR SCANNER
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
        setName(detectedName);
        setIsNameLocked(true);
        extractedItems.push(`Name: "${detectedName}"`);
      } else {
        setIsNameLocked(false);
      }

      if (detectedPrn) {
        setPrn(detectedPrn);
        setIsPrnLocked(true);
        extractedItems.push(`PRN: "${detectedPrn}"`);
      } else {
        setIsPrnLocked(false);
      }

      const finalDept = detectedDept || 'entc';
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
      setDepartment('entc');
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

  // FACULTY TEACHER LOGIN
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
        hodName: hodName.trim(),
        password: hodPassword,
        newPassword: hodNewPassword,
        isFirstTimeSetup: hodIsFirstTime
      });

      if (res.success) {
        localStorage.setItem(`sy_hod_configured_${selectedHodDept}`, 'true');
        localStorage.setItem(`sy_hod_name_${selectedHodDept}`, res.hodName || hodName.trim());

        setShowAdminModal(false);
        onLoginSuccess('admin', {
          name: res.hodName || hodName.trim(),
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
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-3 xs:p-4 sm:p-6 lg:p-8 bg-slate-50">
      <div className="w-full max-w-lg mx-auto">
        
        {/* Welcome Header */}
        <div className="text-center mb-5 sm:mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-indigo-600 shadow-xl shadow-indigo-200 mb-2.5 sm:mb-3 ring-4 ring-indigo-50">
            <GraduationCap className="w-8 h-8 sm:w-9 sm:h-9 text-white" />
          </div>
          <h1 className="text-xl xs:text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Engineering Attendance Portal
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 font-medium">
            Second Year (SY) • Academic Year 2025-2026
          </p>
        </div>

        {/* Main Card: STUDENT PORTAL ONLY */}
        <div className="bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-4 xs:p-6 sm:p-8 shadow-xl shadow-slate-200/60">
          
          <div className="flex items-center space-x-2.5 pb-3.5 sm:pb-4 mb-4 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 flex-shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm xs:text-base font-extrabold text-slate-900 truncate">Student Attendance Verification</h2>
              <p className="text-[11px] xs:text-xs text-slate-500 truncate">Scan physical ID card to verify identity & bind phone</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 sm:mb-5 p-3 sm:p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm leading-relaxed font-semibold flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleStudentLogin} className="space-y-3.5 sm:space-y-4">
            
            {/* 1. MANDATORY ID CARD UPLOAD */}
            <div>
              <label className="block text-[11px] xs:text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className="flex items-center space-x-1.5 text-indigo-700">
                  <Camera className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>1. Upload College ID Card <span className="text-rose-500 font-bold">*COMPULSORY</span></span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal normal-case hidden xs:inline">iOS & Android</span>
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
                  className="w-full p-3.5 xs:p-4 rounded-2xl border-2 border-dashed border-indigo-300 hover:border-indigo-600 bg-indigo-50/40 hover:bg-indigo-50/80 flex flex-col items-center justify-center space-y-1.5 sm:space-y-2 transition-all cursor-pointer group touch-target"
                >
                  <div className="w-9 h-9 xs:w-10 xs:h-10 rounded-xl bg-white border border-indigo-200 group-hover:border-indigo-400 flex items-center justify-center text-indigo-600 shadow-sm transition">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-extrabold text-indigo-900">
                      📸 Tap to Snap or Choose ID from Gallery
                    </p>
                    <p className="text-[10px] xs:text-[11px] text-indigo-700 mt-0.5 font-medium">
                      AI reads PRN code (ET, CS, IT, AD, EL, IN) & locks department!
                    </p>
                  </div>
                </button>
              ) : (
                <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center space-x-2.5 sm:space-x-3">
                    <img
                      src={idCardPreview}
                      alt="ID Preview"
                      className="w-12 h-12 xs:w-14 xs:h-14 rounded-xl object-cover border border-slate-300 shadow-sm flex-shrink-0"
                    />
                    <div className="flex-1 overflow-hidden min-w-0">
                      <div className="flex items-center space-x-1 text-xs font-bold text-slate-900">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span className="truncate">Physical ID Card Attached</span>
                      </div>
                      <p className="text-[10px] xs:text-[11px] text-slate-500 mt-0.5 truncate">Department & identity locked to prevent tampering</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveIdPhoto}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition flex-shrink-0"
                      title="Remove ID Card"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {ocrScanning && (
                    <div className="pt-2">
                      <div className="flex items-center justify-between text-[11px] text-indigo-700 font-bold mb-1">
                        <span className="flex items-center space-x-1 truncate">
                          <Sparkles className="w-3 h-3 animate-spin flex-shrink-0" />
                          <span className="truncate">{ocrStatusText}</span>
                        </span>
                        <span className="flex-shrink-0">{ocrProgress}%</span>
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
                    <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] xs:text-xs font-medium flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      <span className="truncate">{ocrSuccessMsg}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. ENGINEERING DEPARTMENT (100% LOCKED TO ID CARD) */}
            <div>
              <label className="block text-[11px] xs:text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                  <span>2. Department <span className="text-rose-500 font-bold">*FROM ID CARD</span></span>
                </span>
                {department ? (
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold flex items-center space-x-1 flex-shrink-0">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Locked</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-medium">Auto-Extracted</span>
                )}
              </label>

              <div className={`w-full border rounded-xl px-3.5 py-2.5 text-xs xs:text-sm font-bold flex items-center justify-between transition min-h-[44px] ${
                department
                  ? 'bg-slate-100 border-slate-300 text-slate-800 cursor-not-allowed'
                  : 'bg-slate-50 border-dashed border-slate-300 text-slate-400'
              }`}>
                <span className="truncate pr-2">
                  {department
                    ? matchedDeptObj?.name || department.toUpperCase()
                    : '📸 Snap / Upload ID Card to auto-detect'}
                </span>
                <Lock className={`w-4 h-4 flex-shrink-0 ${department ? 'text-indigo-600' : 'text-slate-400'}`} />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                🔒 Auto-extracted from PRN code (ET, CS, IT, AD, EL, IN).
              </p>
            </div>

            {/* 3. DIVISION */}
            <div>
              <label className="block text-[11px] xs:text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                3. Select Division <span className="text-rose-500 font-bold">*COMPULSORY</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {DIVISIONS.map((div) => (
                  <button
                    key={div}
                    type="button"
                    onClick={() => setDivision(div)}
                    className={`py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-extrabold border transition-all touch-target flex items-center justify-center ${
                      division === div
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 active:bg-slate-200'
                    }`}
                  >
                    {div}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. MANUAL ROLL NUMBER + 5. PRN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 pt-0.5">
              <div>
                <label className="block text-[11px] xs:text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center space-x-1">
                    <Hash className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                    <span>4. Roll No <span className="text-rose-500 font-bold">*REQUIRED</span></span>
                  </span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  placeholder="Enter Roll No (e.g. 24)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base text-slate-900 font-bold focus:border-indigo-600 focus:bg-white outline-none min-h-[44px]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] xs:text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>5. PRN <span className="text-rose-500 font-bold">*REQUIRED</span></span>
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
                  placeholder="From ID Card"
                  className={`w-full border rounded-xl px-3.5 py-2.5 text-base sm:text-sm font-bold outline-none min-h-[44px] ${
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
              <label className="block text-[11px] xs:text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>6. Student Full Name <span className="text-rose-500 font-bold">*REQUIRED</span></span>
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
                className={`w-full border rounded-xl px-3.5 py-2.5 text-base sm:text-sm font-bold outline-none min-h-[44px] ${
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
                className="w-full py-3.5 sm:py-4 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs xs:text-sm shadow-lg shadow-indigo-200 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed min-h-[48px]"
              >
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{loading ? 'Binding Phone & Entering...' : 'Verify All Fields & Enter Student Portal'}</span>
                <ArrowRight className="w-4 h-4 flex-shrink-0" />
              </button>
            </div>

            <div className="text-center pt-0.5">
              <p className="text-[10px] xs:text-[11px] text-slate-500 font-medium">
                🔒 1-Device Binding: Name & PRN are permanently locked to your verified physical ID card.
              </p>
            </div>
          </form>

        </div>

        {/* Secure Access Link for Faculty & Department HOD */}
        <div className="text-center mt-5 sm:mt-6">
          <button
            onClick={() => {
              setShowAdminModal(true);
              setGatekeeperStage(1);
              setModalMode('select');
              setAdminError('');
            }}
            className="text-xs text-slate-400 hover:text-slate-700 font-medium transition flex items-center justify-center space-x-1 mx-auto touch-target"
          >
            <Lock className="w-3.5 h-3.5 text-indigo-600" />
            <span>Faculty & Department Admin Access</span>
          </button>
        </div>

      </div>

      {/* DEPARTMENT ADMIN & FACULTY TEACHER LOGIN MODAL */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 xs:p-4">
          <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-5 sm:p-8 max-w-md w-full max-h-[92vh] overflow-y-auto shadow-2xl relative">
            <button
              onClick={() => setShowAdminModal(false)}
              className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg bg-slate-100 transition touch-target flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>

            {/* STAGE 1: COLLEGE GATEKEEPER PASSCODE */}
            {gatekeeperStage === 1 && (
              <div>
                <div className="text-center mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2 border border-indigo-100">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900">Faculty & Department Portal</h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">Enter College Access Code to proceed</p>
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
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base text-slate-900 focus:border-indigo-600 focus:bg-white outline-none min-h-[44px]"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 sm:py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-100 transition active:scale-95 min-h-[44px]"
                  >
                    {loading ? 'Verifying...' : 'Unlock Department Portals →'}
                  </button>
                </form>
              </div>
            )}

            {/* STAGE 2: ROLE SELECTOR */}
            {gatekeeperStage === 2 && modalMode === 'select' && (
              <div className="space-y-3.5 sm:space-y-4">
                <div className="text-center mb-4 sm:mb-5">
                  <h3 className="text-lg font-extrabold text-slate-900">Select Portal Role</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Choose how you want to proceed</p>
                </div>

                <button
                  type="button"
                  onClick={() => setModalMode('teacher')}
                  className="w-full p-3.5 sm:p-4 rounded-2xl border-2 border-indigo-200 hover:border-indigo-600 bg-indigo-50/50 hover:bg-indigo-50 flex items-center space-x-3 transition group text-left touch-target"
                >
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 flex-shrink-0">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-indigo-600 transition truncate">
                      👨‍🏫 Faculty / Teacher Login
                    </h4>
                    <p className="text-[11px] sm:text-xs text-slate-500 leading-tight">Log in with department, subject & password</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setModalMode('hod')}
                  className="w-full p-3.5 sm:p-4 rounded-2xl border-2 border-slate-200 hover:border-indigo-600 bg-slate-50 hover:bg-indigo-50/30 flex items-center space-x-3 transition group text-left touch-target"
                >
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-md flex-shrink-0">
                    <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-indigo-600 transition truncate">
                      👑 Department HOD Portal
                    </h4>
                    <p className="text-[11px] sm:text-xs text-slate-500 leading-tight">Only 1 HOD per department with master credentials</p>
                  </div>
                </button>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setGatekeeperStage(1)}
                    className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs touch-target flex items-center justify-center"
                  >
                    ← Back to Access Code
                  </button>
                </div>
              </div>
            )}

            {/* STAGE 2: TEACHER LOGIN FORM */}
            {gatekeeperStage === 2 && modalMode === 'teacher' && (
              <div>
                <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-100">
                  <h3 className="text-sm xs:text-base font-extrabold text-slate-900 flex items-center space-x-2 truncate">
                    <Users className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    <span className="truncate">Faculty / Teacher Login</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setModalMode('select')}
                    className="text-xs font-bold text-indigo-600 hover:underline flex-shrink-0 ml-2"
                  >
                    Switch Role
                  </button>
                </div>

                {adminError && (
                  <div className="mb-3 p-2.5 sm:p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                    ⚠️ {adminError}
                  </div>
                )}

                <form onSubmit={handleTeacherLogin} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Faculty / Professor Name</label>
                    <input
                      type="text"
                      value={teacherName}
                      onChange={(e) => setTeacherName(e.target.value)}
                      placeholder="Enter Full Professor Name"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-base sm:text-xs text-slate-900 font-bold outline-none focus:border-indigo-600 min-h-[44px]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Teaching In Department</label>
                    <select
                      value={teacherDept}
                      onChange={(e) => setTeacherDept(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-base sm:text-xs text-slate-900 font-semibold outline-none focus:border-indigo-600 min-h-[44px]"
                    >
                      {DEPARTMENTS.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Subject / Lecture Name</label>
                    <input
                      type="text"
                      value={teacherSubject}
                      onChange={(e) => setTeacherSubject(e.target.value)}
                      placeholder="e.g. Digital Signal Processing"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-base sm:text-xs text-slate-900 font-bold outline-none focus:border-indigo-600 min-h-[44px]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Select Division(s)</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {DIVISIONS.map(div => {
                        const isChecked = selectedDivisions.includes(div);
                        return (
                          <button
                            key={div}
                            type="button"
                            onClick={() => toggleDivisionSelection(div)}
                            className={`py-2 rounded-xl text-xs font-bold border transition touch-target flex items-center justify-center ${
                              isChecked
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
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
                      value={teacherBatch}
                      onChange={(e) => setTeacherBatch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-base sm:text-xs text-slate-900 font-semibold outline-none focus:border-indigo-600 min-h-[44px]"
                    >
                      <option value="All">All Batches (Theory Lecture)</option>
                      <option value="B1">Batch B1 (Practical Lab)</option>
                      <option value="B2">Batch B2 (Practical Lab)</option>
                      <option value="B3">Batch B3 (Practical Lab)</option>
                    </select>
                  </div>

                  {teacherIsFirstTime ? (
                    <div className="p-3 rounded-xl bg-indigo-50/80 border border-indigo-200 space-y-2">
                      <div className="text-[11px] font-bold text-indigo-900 flex items-center space-x-1">
                        <Sparkles className="w-3 h-3 text-indigo-600 flex-shrink-0" />
                        <span>First-Time Setup: Set Private Password</span>
                      </div>
                      <input
                        type="password"
                        value={teacherNewPassword}
                        onChange={(e) => setTeacherNewPassword(e.target.value)}
                        placeholder="Create Password (min. 4 chars)"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs text-slate-900 outline-none focus:border-indigo-600 min-h-[44px]"
                        required
                      />
                      <input
                        type="password"
                        value={teacherConfirmPassword}
                        onChange={(e) => setTeacherConfirmPassword(e.target.value)}
                        placeholder="Confirm Password"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs text-slate-900 outline-none focus:border-indigo-600 min-h-[44px]"
                        required
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Faculty Password</label>
                      <input
                        type="password"
                        value={teacherPassword}
                        onChange={(e) => setTeacherPassword(e.target.value)}
                        placeholder="Enter your faculty password"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs text-slate-900 font-semibold outline-none focus:border-indigo-600 min-h-[44px]"
                        required
                      />
                    </div>
                  )}

                  <div className="pt-2 flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setModalMode('select')}
                      className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs touch-target flex items-center justify-center"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-100 transition active:scale-95 touch-target flex items-center justify-center"
                    >
                      {loading ? 'Logging in...' : teacherIsFirstTime ? 'Save Password & Launch' : 'Enter Faculty Portal →'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* STAGE 2: HOD LOGIN FORM */}
            {gatekeeperStage === 2 && modalMode === 'hod' && (
              <div>
                <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-100">
                  <h3 className="text-sm xs:text-base font-extrabold text-slate-900 flex items-center space-x-2 truncate">
                    <Building2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    <span className="truncate">Department HOD Login</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setModalMode('select')}
                    className="text-xs font-bold text-indigo-600 hover:underline flex-shrink-0 ml-2"
                  >
                    Switch Role
                  </button>
                </div>

                {adminError && (
                  <div className="mb-3.5 p-2.5 sm:p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                    ⚠️ {adminError}
                  </div>
                )}

                <form onSubmit={handleHodLoginSubmit} className="space-y-3.5 sm:space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Select Department
                    </label>
                    <select
                      value={selectedHodDept}
                      onChange={(e) => updateSelectedHodDepartment(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-slate-900 font-semibold focus:border-indigo-600 outline-none min-h-[44px]"
                    >
                      {DEPARTMENTS.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  {hodIsFirstTime ? (
                    <div className="space-y-3 p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200">
                      <div className="text-xs font-bold text-indigo-900 flex items-center space-x-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                        <span>First-Time HOD Registration & Setup</span>
                      </div>
                      
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">HOD Full Name</label>
                        <input
                          type="text"
                          value={hodName}
                          onChange={(e) => setHodName(e.target.value)}
                          placeholder="Enter your Full Name as HOD"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs text-slate-900 font-bold outline-none focus:border-indigo-600 min-h-[44px]"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Create Private Password</label>
                        <input
                          type="password"
                          value={hodNewPassword}
                          onChange={(e) => setHodNewPassword(e.target.value)}
                          placeholder="Min. 6 characters"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs text-slate-900 outline-none focus:border-indigo-600 min-h-[44px]"
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
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-base sm:text-xs text-slate-900 outline-none focus:border-indigo-600 min-h-[44px]"
                          required
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-2 p-2.5 rounded-xl bg-slate-100 text-xs font-bold text-slate-800 flex items-center justify-between">
                        <span className="truncate">👨‍🏫 Registered: <span className="text-indigo-600">{hodName || 'Department Head'}</span></span>
                        <span className="text-[10px] text-emerald-600 font-extrabold flex-shrink-0 ml-1">● Configured</span>
                      </div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        HOD Private Password
                      </label>
                      <input
                        type="password"
                        value={hodPassword}
                        onChange={(e) => setHodPassword(e.target.value)}
                        placeholder="Enter your HOD password"
                        autoFocus
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-slate-900 focus:border-indigo-600 focus:bg-white outline-none min-h-[44px]"
                        required
                      />
                    </div>
                  )}

                  <div className="flex space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setModalMode('select')}
                      className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs touch-target flex items-center justify-center"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-100 transition active:scale-95 touch-target flex items-center justify-center"
                    >
                      {loading ? 'Authenticating...' : hodIsFirstTime ? 'Create HOD Account & Enter' : 'Unlock HOD Portal'}
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
