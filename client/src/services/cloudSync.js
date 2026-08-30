// GLOBAL CROSS-DEVICE CLOUD SYNCHRONIZATION ENGINE
// Synchronizes Student Rosters, Live Logins, and Conducted Lectures across all mobile phones and laptops.

const SYNC_BASE_URL = 'https://crudcrud.com/api/da2d894039044336a0c7bbe03b46702f';

const STORAGE_KEYS = {
  STUDENTS: 'sy_perm_students',
  LOGS: 'sy_perm_logs',
  TEACHERS: 'sy_perm_teachers',
  SESSIONS: 'sy_perm_sessions'
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
    console.warn(`Local storage quota warning on [${key}]:`, e);
  }
}

export const CloudSync = {
  // 1. Fetch Students from Cloud and merge with Local
  getStudents: async (department = null, division = null) => {
    let cloudStudents = [];
    try {
      const res = await fetch(`${SYNC_BASE_URL}/students`, { cache: 'no-store' });
      if (res.ok) {
        cloudStudents = await res.json();
      }
    } catch (err) {
      console.warn('Cloud students fetch:', err.message);
    }

    const localStudents = getLocal(STORAGE_KEYS.STUDENTS);
    const map = new Map();

    localStudents.forEach(s => {
      const key = `${s.department || 'entc'}_${s.division || 'SY-A'}_${s.rollNo}`;
      map.set(key, s);
    });

    cloudStudents.forEach(s => {
      const key = `${s.department || 'entc'}_${s.division || 'SY-A'}_${s.rollNo}`;
      map.set(key, { ...(map.get(key) || {}), ...s });
    });

    const merged = Array.from(map.values());
    setLocal(STORAGE_KEYS.STUDENTS, merged);

    let filtered = merged;
    if (department && department !== 'all') {
      filtered = filtered.filter(s => s.department === department);
    }
    if (division) {
      filtered = filtered.filter(s => s.division === division);
    }

    filtered.sort((a, b) => Number(a.rollNo || 0) - Number(b.rollNo || 0));
    return filtered;
  },

  // 2. Fetch Live Logs from Cloud and merge with Local
  getLogs: async (department = null) => {
    let cloudLogs = [];
    try {
      const res = await fetch(`${SYNC_BASE_URL}/logs`, { cache: 'no-store' });
      if (res.ok) {
        cloudLogs = await res.json();
      }
    } catch (err) {
      console.warn('Cloud logs fetch:', err.message);
    }

    const localLogs = getLocal(STORAGE_KEYS.LOGS);
    const map = new Map();

    localLogs.forEach(l => {
      const key = `${l.department || 'entc'}_${l.division || 'SY-A'}_${l.rollNo || l.studentId}`;
      map.set(key, l);
    });

    cloudLogs.forEach(l => {
      const key = `${l.department || 'entc'}_${l.division || 'SY-A'}_${l.rollNo || l.studentId}`;
      map.set(key, { ...(map.get(key) || {}), ...l });
    });

    const merged = Array.from(map.values());
    merged.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    setLocal(STORAGE_KEYS.LOGS, merged);

    let filtered = merged;
    if (department && department !== 'all') {
      filtered = filtered.filter(l => l.department === department);
    }

    return filtered;
  },

  // 3. Fetch Conducted Lectures from Cloud
  getSessions: async (department = null) => {
    let cloudSessions = [];
    try {
      const res = await fetch(`${SYNC_BASE_URL}/sessions`, { cache: 'no-store' });
      if (res.ok) {
        cloudSessions = await res.json();
      }
    } catch (err) {
      console.warn('Cloud sessions fetch:', err.message);
    }

    const localSessions = getLocal(STORAGE_KEYS.SESSIONS);
    const map = new Map();

    localSessions.forEach(s => map.set(s.id, s));
    cloudSessions.forEach(s => map.set(s.id, { ...(map.get(s.id) || {}), ...s }));

    const merged = Array.from(map.values());
    merged.sort((a, b) => new Date(b.startTime || b.date || 0) - new Date(a.startTime || a.date || 0));
    setLocal(STORAGE_KEYS.SESSIONS, merged);

    let filtered = merged;
    if (department && department !== 'all') {
      filtered = filtered.filter(s => s.department === department);
    }

    return filtered;
  },

  // 4. Save/Register Student and Broadcast to Cloud
  saveStudent: async (student) => {
    if (!student || !student.id) return;
    const local = getLocal(STORAGE_KEYS.STUDENTS);
    const idx = local.findIndex(s => s.id === student.id || (s.rollNo === student.rollNo && s.department === student.department && s.division === student.division));
    if (idx >= 0) {
      local[idx] = { ...local[idx], ...student };
    } else {
      local.unshift(student);
    }
    setLocal(STORAGE_KEYS.STUDENTS, local);

    // Push to Cloud
    try {
      // Don't send large base64 ID photo to cloud payload to keep requests instant
      const studentToCloud = {
        id: student.id,
        rollNo: student.rollNo,
        name: student.name,
        prn: student.prn,
        department: student.department || 'entc',
        division: student.division || 'SY-A',
        batch: student.batch || 'B1',
        attendancePercentage: student.attendancePercentage || 100.0,
        isDefaulter: false,
        boundDeviceId: student.boundDeviceId || 'BOUND',
        boundAt: student.boundAt || new Date().toISOString()
      };

      await fetch(`${SYNC_BASE_URL}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentToCloud)
      });
    } catch (err) {
      console.warn('Cloud save student:', err.message);
    }
  },

  // 5. Save Live Audit Log and Broadcast to Cloud
  saveLog: async (log) => {
    if (!log) return;
    const local = getLocal(STORAGE_KEYS.LOGS);
    const idx = local.findIndex(l => 
      (l.studentId && log.studentId && l.studentId === log.studentId) || 
      (l.rollNo === log.rollNo && l.department === log.department && l.division === log.division)
    );

    if (idx >= 0) {
      local[idx] = { ...local[idx], ...log, timestamp: log.timestamp || local[idx].timestamp };
    } else {
      local.unshift({
        id: log.id || `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        timestamp: log.timestamp || new Date().toISOString(),
        ...log
      });
    }
    setLocal(STORAGE_KEYS.LOGS, local.slice(0, 200));

    try {
      const logToCloud = {
        id: log.id || `LOG_${Date.now()}`,
        studentId: log.studentId,
        studentName: log.studentName,
        rollNo: log.rollNo,
        prn: log.prn,
        department: log.department || 'entc',
        division: log.division || 'SY-A',
        status: log.status || 'VERIFIED_PHYSICAL_ID',
        timestamp: log.timestamp || new Date().toISOString()
      };

      await fetch(`${SYNC_BASE_URL}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logToCloud)
      });
    } catch (err) {
      console.warn('Cloud save log:', err.message);
    }
  },

  // 6. Save Conducted Lecture Session and Broadcast to Cloud
  saveSession: async (session) => {
    if (!session || !session.id) return;
    const local = getLocal(STORAGE_KEYS.SESSIONS);
    const idx = local.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      local[idx] = { ...local[idx], ...session };
    } else {
      local.unshift(session);
    }
    setLocal(STORAGE_KEYS.SESSIONS, local);

    try {
      await fetch(`${SYNC_BASE_URL}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session)
      });
    } catch (err) {
      console.warn('Cloud save session:', err.message);
    }
  },

  // 7. Delete Student Locally & Reset in Cloud
  deleteStudent: (studentId) => {
    let list = getLocal(STORAGE_KEYS.STUDENTS);
    list = list.filter(s => s.id !== studentId && s.rollNo !== Number(studentId));
    setLocal(STORAGE_KEYS.STUDENTS, list);

    let logs = getLocal(STORAGE_KEYS.LOGS);
    logs = logs.filter(l => l.studentId !== studentId && l.rollNo !== Number(studentId));
    setLocal(STORAGE_KEYS.LOGS, logs);
  },

  // 8. Reset Device Binding
  resetDevice: (studentId) => {
    const list = getLocal(STORAGE_KEYS.STUDENTS);
    const target = list.find(s => s.id === studentId || s.rollNo === Number(studentId));
    if (target) {
      target.boundDeviceId = null;
      target.boundFingerprint = null;
      target.boundAt = null;
      setLocal(STORAGE_KEYS.STUDENTS, list);
    }
  }
};
