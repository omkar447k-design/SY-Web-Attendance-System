// GLOBAL CLOUD PERSISTENCE & MULTI-DEVICE SYNC ENGINE
// Connects phone browsers, laptops, and Vercel serverless containers into a single shared database.

const CLOUD_SYNC_ENDPOINT = 'https://api.restful-api.dev/objects/ff808181a04ccf2d01a051a4120014c6';

const STORAGE_KEYS = {
  STUDENTS: 'sy_perm_students',
  LOGS: 'sy_perm_logs',
  TEACHERS: 'sy_perm_teachers',
  SESSIONS: 'sy_perm_sessions',
  HOD_ACCOUNTS: 'sy_perm_hod_accounts'
};

function getLocal(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function setLocal(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Local storage quota on [${key}]:`, e);
  }
}

let syncTimeout = null;
let isSyncing = false;

export const CloudSync = {
  // Fetch latest global data across all devices
  fetchGlobalState: async () => {
    try {
      const res = await fetch(CLOUD_SYNC_ENDPOINT, { cache: 'no-store' });
      if (!res.ok) return null;
      const json = await res.json();
      const cloudData = json.data || {};

      // Merge Cloud Students with Local
      if (Array.isArray(cloudData.students) && cloudData.students.length > 0) {
        const local = getLocal(STORAGE_KEYS.STUDENTS);
        const map = new Map();
        local.forEach(s => map.set(`${s.department || 'entc'}_${s.division || 'SY-A'}_${s.rollNo}`, s));
        cloudData.students.forEach(s => {
          const key = `${s.department || 'entc'}_${s.division || 'SY-A'}_${s.rollNo}`;
          map.set(key, { ...(map.get(key) || {}), ...s });
        });
        const mergedStudents = Array.from(map.values());
        setLocal(STORAGE_KEYS.STUDENTS, mergedStudents);
      }

      // Merge Cloud Logs with Local
      if (Array.isArray(cloudData.loginLogs) && cloudData.loginLogs.length > 0) {
        const localLogs = getLocal(STORAGE_KEYS.LOGS);
        const logMap = new Map();
        localLogs.forEach(l => logMap.set(l.id || `${l.department}_${l.division}_${l.rollNo}`, l));
        cloudData.loginLogs.forEach(l => logMap.set(l.id || `${l.department}_${l.division}_${l.rollNo}`, l));
        const mergedLogs = Array.from(logMap.values());
        mergedLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setLocal(STORAGE_KEYS.LOGS, mergedLogs);
      }

      // Merge Cloud Sessions with Local
      if (Array.isArray(cloudData.sessions) && cloudData.sessions.length > 0) {
        const localSessions = getLocal(STORAGE_KEYS.SESSIONS);
        const sessMap = new Map();
        localSessions.forEach(s => sessMap.set(s.id, s));
        cloudData.sessions.forEach(s => sessMap.set(s.id, { ...(sessMap.get(s.id) || {}), ...s }));
        const mergedSessions = Array.from(sessMap.values());
        mergedSessions.sort((a, b) => new Date(b.startTime || b.date) - new Date(a.startTime || a.date));
        setLocal(STORAGE_KEYS.SESSIONS, mergedSessions);
      }

      return cloudData;
    } catch (err) {
      console.warn('Cloud sync read warning:', err.message);
      return null;
    }
  },

  // Push full updated dataset to Cloud Store
  pushGlobalState: async () => {
    if (isSyncing) return;
    isSyncing = true;
    try {
      const students = getLocal(STORAGE_KEYS.STUDENTS);
      const loginLogs = getLocal(STORAGE_KEYS.LOGS).slice(0, 100); // keep clean
      const sessions = getLocal(STORAGE_KEYS.SESSIONS);

      await fetch(CLOUD_SYNC_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'sy_attendance_sync',
          data: {
            students,
            loginLogs,
            sessions,
            lastSyncedAt: new Date().toISOString()
          }
        })
      });
    } catch (err) {
      console.warn('Cloud sync push warning:', err.message);
    } finally {
      isSyncing = false;
    }
  },

  // Save student on this device and immediately synchronize globally
  saveStudent: async (student) => {
    if (!student || !student.id) return;
    const list = getLocal(STORAGE_KEYS.STUDENTS);
    const idx = list.findIndex(s => s.id === student.id || (s.rollNo === student.rollNo && s.department === student.department && s.division === student.division));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...student };
    } else {
      list.unshift(student);
    }
    setLocal(STORAGE_KEYS.STUDENTS, list);

    // Immediate Cloud Push
    CloudSync.pushGlobalState();
  },

  // Delete student on this device and immediately synchronize globally
  deleteStudent: async (studentId) => {
    let list = getLocal(STORAGE_KEYS.STUDENTS);
    list = list.filter(s => s.id !== studentId && s.rollNo !== Number(studentId));
    setLocal(STORAGE_KEYS.STUDENTS, list);

    let logs = getLocal(STORAGE_KEYS.LOGS);
    logs = logs.filter(l => l.studentId !== studentId && l.rollNo !== Number(studentId));
    setLocal(STORAGE_KEYS.LOGS, logs);

    CloudSync.pushGlobalState();
  },

  // Save login log on this device and sync globally
  saveLog: async (log) => {
    if (!log) return;
    const logs = getLocal(STORAGE_KEYS.LOGS);
    const idx = logs.findIndex(l => 
      (l.studentId && log.studentId && l.studentId === log.studentId) || 
      (l.rollNo === log.rollNo && l.department === log.department && l.division === log.division)
    );

    if (idx >= 0) {
      logs[idx] = { ...logs[idx], ...log, timestamp: log.timestamp || logs[idx].timestamp };
    } else {
      logs.unshift({
        id: log.id || `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        timestamp: log.timestamp || new Date().toISOString(),
        ...log
      });
    }
    setLocal(STORAGE_KEYS.LOGS, logs.slice(0, 300));
    CloudSync.pushGlobalState();
  },

  // Save lecture session and sync globally
  saveSession: async (session) => {
    if (!session || !session.id) return;
    const list = getLocal(STORAGE_KEYS.SESSIONS);
    const idx = list.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...session };
    } else {
      list.unshift(session);
    }
    setLocal(STORAGE_KEYS.SESSIONS, list);
    CloudSync.pushGlobalState();
  },

  // Reset student phone hardware binding and sync globally
  resetDevice: async (studentId) => {
    const list = getLocal(STORAGE_KEYS.STUDENTS);
    const target = list.find(s => s.id === studentId || s.rollNo === Number(studentId));
    if (target) {
      target.boundDeviceId = null;
      target.boundFingerprint = null;
      target.boundAt = null;
      setLocal(STORAGE_KEYS.STUDENTS, list);
      CloudSync.pushGlobalState();
    }
  }
};
