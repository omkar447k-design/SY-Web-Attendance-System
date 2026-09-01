import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';

const LOCAL_STORAGE_KEY = 'sy_firestore_cache_v1';
let memoryCache = {
  students: [],
  sessions: [],
  logs: [],
  hodAccounts: {},
  teachers: []
};

// Initialize cache from localStorage
try {
  const local = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (local) {
    memoryCache = { ...memoryCache, ...JSON.parse(local) };
  }
} catch (e) {}

function persistLocalState(state) {
  memoryCache = state;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
}

// ==========================================
// REAL-TIME FIRESTORE LIVE SYNC LISTENERS
// ==========================================
let isListenersInitialized = false;

function initRealtimeListeners() {
  if (isListenersInitialized || typeof window === 'undefined') return;
  isListenersInitialized = true;

  try {
    // 1. Live Students Listener
    onSnapshot(collection(db, 'students'), (snapshot) => {
      const liveStudents = [];
      snapshot.forEach(docSnap => {
        if (docSnap.exists()) {
          liveStudents.push({ id: docSnap.id, ...docSnap.data() });
        }
      });
      memoryCache.students = liveStudents;
      persistLocalState(memoryCache);
    }, (err) => {
      console.warn('Firestore students listener fallback:', err.message);
    });

    // 2. Live Sessions Listener
    onSnapshot(query(collection(db, 'sessions'), orderBy('startTime', 'desc'), limit(50)), (snapshot) => {
      const liveSessions = [];
      snapshot.forEach(docSnap => {
        if (docSnap.exists()) {
          liveSessions.push({ id: docSnap.id, ...docSnap.data() });
        }
      });
      memoryCache.sessions = liveSessions;
      persistLocalState(memoryCache);
    }, (err) => {
      console.warn('Firestore sessions listener fallback:', err.message);
    });

    // 3. Live Teachers Listener
    onSnapshot(collection(db, 'teachers'), (snapshot) => {
      const liveTeachers = [];
      snapshot.forEach(docSnap => {
        if (docSnap.exists()) {
          liveTeachers.push({ id: docSnap.id, ...docSnap.data() });
        }
      });
      memoryCache.teachers = liveTeachers;
      persistLocalState(memoryCache);
    }, (err) => {
      console.warn('Firestore teachers listener fallback:', err.message);
    });

    // 4. Live HOD Accounts Listener
    onSnapshot(collection(db, 'hodAccounts'), (snapshot) => {
      const hodMap = {};
      snapshot.forEach(docSnap => {
        if (docSnap.exists()) {
          hodMap[docSnap.id] = docSnap.data();
        }
      });
      memoryCache.hodAccounts = hodMap;
      persistLocalState(memoryCache);
    }, (err) => {
      console.warn('Firestore hod listener fallback:', err.message);
    });

    // 5. Live Logs Listener
    onSnapshot(query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(200)), (snapshot) => {
      const liveLogs = [];
      snapshot.forEach(docSnap => {
        if (docSnap.exists()) {
          liveLogs.push({ id: docSnap.id, ...docSnap.data() });
        }
      });
      memoryCache.logs = liveLogs;
      persistLocalState(memoryCache);
    }, (err) => {
      console.warn('Firestore logs listener fallback:', err.message);
    });

  } catch (err) {
    console.warn('Firestore real-time listeners initialization error:', err);
  }
}

// Start listeners immediately
initRealtimeListeners();

// ==========================================
// UNIFIED CLOUDSYNC SERVICE (FIRESTORE)
// ==========================================
export const CloudSync = {
  getInitialCache: () => memoryCache,

  // 1. HOD ACCOUNTS
  getHodAccounts: async () => {
    initRealtimeListeners();
    try {
      const snapshot = await getDocs(collection(db, 'hodAccounts'));
      const hodMap = {};
      snapshot.forEach(docSnap => {
        if (docSnap.exists()) hodMap[docSnap.id] = docSnap.data();
      });
      memoryCache.hodAccounts = { ...memoryCache.hodAccounts, ...hodMap };
      persistLocalState(memoryCache);
      return memoryCache.hodAccounts;
    } catch (e) {
      return memoryCache.hodAccounts || {};
    }
  },

  saveHodAccount: async (department, accountData) => {
    const cleanDept = String(department).toLowerCase();
    const cleanData = {
      name: (accountData.name || '').trim(),
      password: accountData.password,
      configuredAt: new Date().toISOString()
    };
    memoryCache.hodAccounts = memoryCache.hodAccounts || {};
    memoryCache.hodAccounts[cleanDept] = cleanData;
    persistLocalState(memoryCache);

    try {
      await setDoc(doc(db, 'hodAccounts', cleanDept), cleanData, { merge: true });
    } catch (e) {
      console.warn('Firestore saveHodAccount error:', e.message);
    }
    return cleanData;
  },

  // 2. STUDENTS ROSTER
  getStudents: async (department = null, division = null) => {
    initRealtimeListeners();
    let list = memoryCache.students || [];

    try {
      const snapshot = await getDocs(collection(db, 'students'));
      const fetched = [];
      snapshot.forEach(docSnap => {
        if (docSnap.exists()) fetched.push({ id: docSnap.id, ...docSnap.data() });
      });
      if (fetched.length > 0) {
        memoryCache.students = fetched;
        persistLocalState(memoryCache);
        list = fetched;
      }
    } catch (e) {
      // Use memory cache
    }

    if (department && department !== 'all') {
      const cleanDept = String(department).toLowerCase();
      list = list.filter(s => String(s.department || '').toLowerCase() === cleanDept);
    }
    if (division && division !== 'all') {
      const cleanDiv = String(division).toUpperCase();
      list = list.filter(s => String(s.division || '').toUpperCase() === cleanDiv);
    }

    list.sort((a, b) => Number(a.rollNo || 0) - Number(b.rollNo || 0));
    return list;
  },

  saveStudent: async (student) => {
    const canonicalDept = String(student.department || 'entc').toLowerCase();
    const canonicalDiv = String(student.division || 'SY-A').toUpperCase();
    const canonicalRoll = Number(student.rollNo);
    const canonicalId = student.id || `S_${canonicalDept}_${canonicalDiv}_${canonicalRoll}`;

    const cleanStudent = {
      ...student,
      id: canonicalId,
      department: canonicalDept,
      division: canonicalDiv,
      rollNo: canonicalRoll
    };

    const idx = (memoryCache.students || []).findIndex(s => s.id === canonicalId);
    if (idx >= 0) {
      memoryCache.students[idx] = { ...memoryCache.students[idx], ...cleanStudent };
    } else {
      memoryCache.students = memoryCache.students || [];
      memoryCache.students.push(cleanStudent);
    }
    persistLocalState(memoryCache);

    try {
      await setDoc(doc(db, 'students', canonicalId), cleanStudent, { merge: true });
    } catch (e) {
      console.warn('Firestore saveStudent error:', e.message);
    }
    return cleanStudent;
  },

  deleteStudent: async (studentId) => {
    memoryCache.students = (memoryCache.students || []).filter(s => s.id !== studentId && String(s.rollNo) !== String(studentId));
    memoryCache.logs = (memoryCache.logs || []).filter(l => l.studentId !== studentId);
    persistLocalState(memoryCache);

    try {
      await deleteDoc(doc(db, 'students', studentId));
    } catch (e) {
      console.warn('Firestore deleteStudent error:', e.message);
    }
  },

  clearDepartmentStudents: async (department, division = null) => {
    const cleanDept = String(department).toLowerCase();
    const toDelete = [];

    memoryCache.students = (memoryCache.students || []).filter(s => {
      const matchDept = String(s.department || '').toLowerCase() === cleanDept;
      if (!matchDept) return true;
      if (division) {
        const matchDiv = String(s.division || '').toUpperCase() === String(division).toUpperCase();
        if (matchDiv) toDelete.push(s.id);
        return !matchDiv;
      }
      toDelete.push(s.id);
      return false;
    });
    persistLocalState(memoryCache);

    // Delete from Firestore
    for (const sId of toDelete) {
      try {
        await deleteDoc(doc(db, 'students', sId));
      } catch (e) {}
    }
  },

  resetDevice: async (studentId) => {
    memoryCache.students = (memoryCache.students || []).map(s => {
      if (s.id === studentId || String(s.rollNo) === String(studentId)) {
        return { ...s, boundDeviceId: null, boundAt: null, activeSessionToken: null };
      }
      return s;
    });
    persistLocalState(memoryCache);

    try {
      const target = (memoryCache.students || []).find(s => s.id === studentId || String(s.rollNo) === String(studentId));
      if (target) {
        await setDoc(doc(db, 'students', target.id), {
          boundDeviceId: null,
          boundAt: null,
          activeSessionToken: null
        }, { merge: true });
      }
    } catch (e) {
      console.warn('Firestore resetDevice error:', e.message);
    }
  },

  // 3. CONDUCTED LECTURE SESSIONS
  getSessions: async (department = null) => {
    initRealtimeListeners();
    let list = memoryCache.sessions || [];

    try {
      const snapshot = await getDocs(query(collection(db, 'sessions'), orderBy('startTime', 'desc'), limit(50)));
      const fetched = [];
      snapshot.forEach(docSnap => {
        if (docSnap.exists()) fetched.push({ id: docSnap.id, ...docSnap.data() });
      });
      if (fetched.length > 0) {
        memoryCache.sessions = fetched;
        persistLocalState(memoryCache);
        list = fetched;
      }
    } catch (e) {}

    if (department && department !== 'all') {
      list = list.filter(s => String(s.department || '').toLowerCase() === String(department).toLowerCase());
    }

    list.sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0));
    return list;
  },

  saveSession: async (session) => {
    const idx = (memoryCache.sessions || []).findIndex(s => s.id === session.id);
    if (idx >= 0) {
      memoryCache.sessions[idx] = { ...memoryCache.sessions[idx], ...session };
    } else {
      memoryCache.sessions = memoryCache.sessions || [];
      memoryCache.sessions.unshift(session);
    }
    persistLocalState(memoryCache);

    try {
      await setDoc(doc(db, 'sessions', session.id), session, { merge: true });
    } catch (e) {
      console.warn('Firestore saveSession error:', e.message);
    }
    return session;
  },

  deleteSession: async (sessionId) => {
    memoryCache.sessions = (memoryCache.sessions || []).filter(s => s.id !== sessionId);
    persistLocalState(memoryCache);

    try {
      await deleteDoc(doc(db, 'sessions', sessionId));
    } catch (e) {
      console.warn('Firestore deleteSession error:', e.message);
    }
  },

  // 4. AUDIT LOGS
  getLogs: async (department = null) => {
    initRealtimeListeners();
    let list = memoryCache.logs || [];

    try {
      const snapshot = await getDocs(query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(150)));
      const fetched = [];
      snapshot.forEach(docSnap => {
        if (docSnap.exists()) fetched.push({ id: docSnap.id, ...docSnap.data() });
      });
      if (fetched.length > 0) {
        memoryCache.logs = fetched;
        persistLocalState(memoryCache);
        list = fetched;
      }
    } catch (e) {}

    if (department && department !== 'all') {
      list = list.filter(l => String(l.department || '').toLowerCase() === String(department).toLowerCase());
    }

    list.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    return list;
  },

  saveLog: async (log) => {
    const logId = log.id || `LOG_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullLog = { ...log, id: logId };
    memoryCache.logs = memoryCache.logs || [];
    memoryCache.logs.unshift(fullLog);
    if (memoryCache.logs.length > 200) memoryCache.logs.pop();
    persistLocalState(memoryCache);

    try {
      await setDoc(doc(db, 'logs', logId), fullLog, { merge: true });
    } catch (e) {
      console.warn('Firestore saveLog error:', e.message);
    }
    return fullLog;
  },

  // 5. REGISTERED TEACHERS
  getTeachers: async (department = null) => {
    initRealtimeListeners();
    let list = memoryCache.teachers || [];

    try {
      const snapshot = await getDocs(collection(db, 'teachers'));
      const fetched = [];
      snapshot.forEach(docSnap => {
        if (docSnap.exists()) fetched.push({ id: docSnap.id, ...docSnap.data() });
      });
      if (fetched.length > 0) {
        memoryCache.teachers = fetched;
        persistLocalState(memoryCache);
        list = fetched;
      }
    } catch (e) {}

    if (department && department !== 'all') {
      list = list.filter(t => String(t.department || '').toLowerCase() === String(department).toLowerCase());
    }

    return list;
  },

  saveTeacher: async (teacher) => {
    const teacherId = teacher.id || `T_${String(teacher.department || 'entc').toLowerCase()}_${Date.now()}`;
    const cleanTeacher = { ...teacher, id: teacherId };

    const idx = (memoryCache.teachers || []).findIndex(t => t.id === teacherId);
    if (idx >= 0) {
      memoryCache.teachers[idx] = { ...memoryCache.teachers[idx], ...cleanTeacher };
    } else {
      memoryCache.teachers = memoryCache.teachers || [];
      memoryCache.teachers.push(cleanTeacher);
    }
    persistLocalState(memoryCache);

    try {
      await setDoc(doc(db, 'teachers', teacherId), cleanTeacher, { merge: true });
    } catch (e) {
      console.warn('Firestore saveTeacher error:', e.message);
    }
    return cleanTeacher;
  },

  deleteTeacher: async (teacherId) => {
    memoryCache.teachers = (memoryCache.teachers || []).filter(t => t.id !== teacherId);
    persistLocalState(memoryCache);

    try {
      await deleteDoc(doc(db, 'teachers', teacherId));
    } catch (e) {
      console.warn('Firestore deleteTeacher error:', e.message);
    }
  },

  resetTeacherPassword: async (teacherId, newPassword = 'password123') => {
    memoryCache.teachers = (memoryCache.teachers || []).map(t => {
      if (t.id === teacherId) return { ...t, password: newPassword };
      return t;
    });
    persistLocalState(memoryCache);

    try {
      await setDoc(doc(db, 'teachers', teacherId), { password: newPassword }, { merge: true });
    } catch (e) {
      console.warn('Firestore resetTeacherPassword error:', e.message);
    }
  }
};
