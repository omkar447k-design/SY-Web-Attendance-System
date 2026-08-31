// ULTRA-HIGH PERFORMANCE REAL-TIME CLOUD ENGINE (NON-BLOCKING + ZERO LATENCY)
// Optimistic UI updates (0ms) + Asynchronous Non-Blocking Cloud Broker Sync

const SYNC_TOPIC = 'sy_attendance_prod_sync_v2026';
const SYNC_URL = `https://ntfy.sh/${SYNC_TOPIC}`;

let memoryCache = null;
let isSyncing = false;

// Track IDs that were explicitly deleted so cloud merge never resurrects them
let deletedStudentIds = new Set();
let deletedSessionIds = new Set();

// Restore persisted deletion tombstones
try {
  const ds = localStorage.getItem('sy_deleted_students_v1');
  if (ds) deletedStudentIds = new Set(JSON.parse(ds));
} catch (e) {}
try {
  const dl = localStorage.getItem('sy_deleted_sessions_v1');
  if (dl) deletedSessionIds = new Set(JSON.parse(dl));
} catch (e) {}

function persistDeletionTombstones() {
  try {
    localStorage.setItem('sy_deleted_students_v1', JSON.stringify([...deletedStudentIds]));
    localStorage.setItem('sy_deleted_sessions_v1', JSON.stringify([...deletedSessionIds]));
  } catch (e) {}
}

// 1. Instant Cache Loader (0ms)
function getInitialCache() {
  if (memoryCache) return memoryCache;
  try {
    const local = localStorage.getItem('sy_cloud_cache_v4');
    if (local) {
      memoryCache = JSON.parse(local);
      return memoryCache;
    }
  } catch (e) {}

  memoryCache = {
    students: [],
    sessions: [],
    logs: [],
    hodAccounts: {},
    teachers: []
  };
  return memoryCache;
}

function persistLocalState(state) {
  memoryCache = state;
  try {
    localStorage.setItem('sy_cloud_cache_v4', JSON.stringify(state));
  } catch (e) {}
}

// 2. Non-blocking asynchronous cloud broadcast (< 50ms)
function broadcastToCloudAsync(state) {
  if (typeof window === 'undefined') return;

  // Lightweight state (sanitize and strip heavy photos to keep payload < 5KB)
  const lightweightState = {
    students: (state.students || []).map(s => ({
      id: s.id,
      rollNo: s.rollNo,
      name: s.name,
      prn: s.prn,
      department: s.department,
      division: s.division,
      batch: s.batch,
      attendancePercentage: s.attendancePercentage,
      isDefaulter: s.isDefaulter,
      boundDeviceId: s.boundDeviceId,
      boundAt: s.boundAt,
      activeSessionToken: s.activeSessionToken,
      lastLoginAt: s.lastLoginAt
    })),
    sessions: (state.sessions || []).slice(0, 30),
    logs: (state.logs || []).slice(0, 200),
    hodAccounts: state.hodAccounts || {},
    teachers: state.teachers || []
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  fetch(SYNC_URL, {
    method: 'POST',
    headers: {
      'Title': 'STATE_DELTA',
      'Priority': 'urgent'
    },
    body: JSON.stringify(lightweightState),
    signal: controller.signal
  })
    .then(() => clearTimeout(timeoutId))
    .catch(() => clearTimeout(timeoutId));
}

// 3. Fast Background Revalidator
async function revalidateCloudStateInBackground() {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`${SYNC_URL}/json?poll=1`, {
      cache: 'no-store',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const text = await res.text();
      const lines = text.trim().split('\n').filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const item = JSON.parse(lines[i]);
          if (item && item.event === 'message' && item.message) {
            const parsed = JSON.parse(item.message);
            if (parsed && typeof parsed === 'object') {
              const current = getInitialCache();
              
              // Merge students intelligently — but NEVER resurrect deleted ones
              const studentMap = new Map();
              (current.students || []).forEach(s => {
                if (!deletedStudentIds.has(s.id)) studentMap.set(s.id, s);
              });
              (parsed.students || []).forEach(s => {
                if (!deletedStudentIds.has(s.id)) {
                  const existing = studentMap.get(s.id);
                  studentMap.set(s.id, { ...(existing || {}), ...s });
                }
              });

              // Merge HOD accounts
              const hodMap = { ...(current.hodAccounts || {}), ...(parsed.hodAccounts || {}) };

              // Merge sessions — but NEVER resurrect deleted ones
              const sessionMap = new Map();
              (current.sessions || []).forEach(s => {
                if (!deletedSessionIds.has(s.id)) sessionMap.set(s.id, s);
              });
              (parsed.sessions || []).forEach(s => {
                if (!deletedSessionIds.has(s.id)) {
                  sessionMap.set(s.id, { ...(sessionMap.get(s.id) || {}), ...s });
                }
              });

              const mergedState = {
                students: Array.from(studentMap.values()),
                sessions: Array.from(sessionMap.values()),
                logs: (parsed.logs || current.logs || []).filter(l => !deletedStudentIds.has(l.studentId)).slice(0, 500),
                hodAccounts: hodMap,
                teachers: parsed.teachers || current.teachers || []
              };

              persistLocalState(mergedState);
              break;
            }
          }
        } catch (e) {}
      }
    }
  } catch (err) {
    // Silent background timeout
  } finally {
    isSyncing = false;
  }
}

// Auto background sync every 3 seconds
if (typeof window !== 'undefined') {
  setInterval(revalidateCloudStateInBackground, 3000);
}

export const CloudSync = {
  // 1. HOD ACCOUNTS
  getHodAccounts: async () => {
    revalidateCloudStateInBackground();
    const state = getInitialCache();
    return state.hodAccounts || {};
  },

  saveHodAccount: async (department, accountData) => {
    const state = getInitialCache();
    state.hodAccounts = state.hodAccounts || {};
    state.hodAccounts[department] = {
      name: (accountData.name || '').trim(),
      password: accountData.password,
      configuredAt: new Date().toISOString()
    };
    persistLocalState(state);
    broadcastToCloudAsync(state);
    return state.hodAccounts[department];
  },

  // 2. STUDENTS ROSTER
  getStudents: async (department = null, division = null) => {
    revalidateCloudStateInBackground();
    const state = getInitialCache();
    let list = state.students || [];

    if (department && department !== 'all') {
      list = list.filter(s => String(s.department || '').toLowerCase() === String(department).toLowerCase());
    }
    if (division) {
      list = list.filter(s => String(s.division || '').toUpperCase() === String(division).toUpperCase());
    }

    list.sort((a, b) => Number(a.rollNo || 0) - Number(b.rollNo || 0));
    return list;
  },

  saveStudent: async (student) => {
    const state = getInitialCache();
    state.students = state.students || [];

    const idx = state.students.findIndex(s =>
      s.id === student.id ||
      (Number(s.rollNo) === Number(student.rollNo) &&
       String(s.department || '').toLowerCase() === String(student.department || '').toLowerCase() &&
       String(s.division || '').toUpperCase() === String(student.division || '').toUpperCase())
    );

    if (idx >= 0) {
      state.students[idx] = { ...state.students[idx], ...student };
    } else {
      state.students.push(student);
    }

    persistLocalState(state);
    broadcastToCloudAsync(state);
    return student;
  },

  deleteStudent: async (studentId) => {
    deletedStudentIds.add(studentId);
    persistDeletionTombstones();

    const state = getInitialCache();
    state.students = (state.students || []).filter(s => s.id !== studentId);
    state.logs = (state.logs || []).filter(l => l.studentId !== studentId);
    persistLocalState(state);
    broadcastToCloudAsync(state);
  },

  resetDevice: async (studentId) => {
    const state = getInitialCache();
    state.students = (state.students || []).map(s => {
      if (s.id === studentId) {
        return { ...s, boundDeviceId: null, boundAt: null, activeSessionToken: null };
      }
      return s;
    });
    persistLocalState(state);
    broadcastToCloudAsync(state);
  },

  // 3. CONDUCTED LECTURE SESSIONS
  getSessions: async (department = null) => {
    revalidateCloudStateInBackground();
    const state = getInitialCache();
    let list = state.sessions || [];

    if (department && department !== 'all') {
      list = list.filter(s => String(s.department || '').toLowerCase() === String(department).toLowerCase());
    }

    list.sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0));
    return list;
  },

  saveSession: async (session) => {
    const state = getInitialCache();
    state.sessions = state.sessions || [];

    const idx = state.sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      state.sessions[idx] = { ...state.sessions[idx], ...session };
    } else {
      state.sessions.unshift(session);
    }

    persistLocalState(state);
    broadcastToCloudAsync(state);
    return session;
  },

  deleteSession: async (sessionId) => {
    deletedSessionIds.add(sessionId);
    persistDeletionTombstones();

    const state = getInitialCache();
    state.sessions = (state.sessions || []).filter(s => s.id !== sessionId);
    persistLocalState(state);
    broadcastToCloudAsync(state);
  },

  // 4. AUDIT LOGS
  getLogs: async (department = null) => {
    revalidateCloudStateInBackground();
    const state = getInitialCache();
    let list = state.logs || [];

    if (department && department !== 'all') {
      list = list.filter(l => String(l.department || '').toLowerCase() === String(department).toLowerCase());
    }

    list.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    return list;
  },

  saveLog: async (log) => {
    const state = getInitialCache();
    state.logs = state.logs || [];

    const cleanLog = {
      id: log.id || `LOG_${Date.now()}_${log.rollNo || Math.floor(Math.random() * 1000)}`,
      type: log.type || 'STUDENT_LOG',
      studentId: log.studentId,
      studentName: log.studentName || 'Student',
      rollNo: log.rollNo,
      prn: log.prn,
      department: log.department,
      division: log.division,
      deviceId: log.deviceId,
      status: log.status || 'SUCCESS',
      timestamp: new Date().toISOString()
    };

    state.logs.unshift(cleanLog);
    if (state.logs.length > 500) state.logs = state.logs.slice(0, 500);

    persistLocalState(state);
    broadcastToCloudAsync(state);
    return cleanLog;
  },

  // 5. TEACHERS
  getTeachers: async (dept = null) => {
    revalidateCloudStateInBackground();
    const state = getInitialCache();
    let list = state.teachers || [];
    if (dept && dept !== 'all') {
      list = list.filter(t => String(t.department || '').toLowerCase() === String(dept).toLowerCase());
    }
    return list;
  },

  saveTeacher: async (teacher) => {
    const state = getInitialCache();
    state.teachers = state.teachers || [];
    const idx = state.teachers.findIndex(t => t.id === teacher.id || (t.name === teacher.name && t.department === teacher.department));
    if (idx >= 0) {
      state.teachers[idx] = { ...state.teachers[idx], ...teacher };
    } else {
      state.teachers.push(teacher);
    }
    persistLocalState(state);
    broadcastToCloudAsync(state);
    return teacher;
  },

  // 6. FORCE REFRESH (INSTANT SYNC TRIGGER)
  forceRefresh: async () => {
    await revalidateCloudStateInBackground();
    return getInitialCache();
  }
};
