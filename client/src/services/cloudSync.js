// HIGH-PERFORMANCE GLOBAL REAL-TIME CLOUD SYNCHRONIZATION ENGINE (NTFY BROKER)
// Connects Desktop, Mobile, and all client browsers with 100% live synchronization.

const SYNC_TOPIC = 'sy_attendance_prod_sync_v2026';
const SYNC_URL = `https://ntfy.sh/${SYNC_TOPIC}`;

let memoryCache = null;
let lastFetchTime = 0;

function sanitizeStudent(s) {
  if (!s) return null;
  return {
    id: s.id || `S_${s.department || 'entc'}_${s.division || 'SY-A'}_${s.rollNo}`,
    rollNo: Number(s.rollNo),
    name: (s.name || 'Student').trim(),
    prn: (s.prn || '').trim().toUpperCase(),
    department: s.department || 'entc',
    division: s.division || 'SY-A',
    batch: s.batch || (Number(s.rollNo) <= 20 ? 'B1' : Number(s.rollNo) <= 40 ? 'B2' : 'B3'),
    idCardPhoto: s.idCardPhoto && s.idCardPhoto.length < 5000 ? s.idCardPhoto : null,
    attendancePercentage: s.attendancePercentage || 100.0,
    isDefaulter: Boolean(s.isDefaulter),
    boundDeviceId: s.boundDeviceId || null,
    boundAt: s.boundAt || new Date().toISOString()
  };
}

function sanitizeLog(l) {
  if (!l) return null;
  return {
    id: l.id || `LOG_${Date.now()}_${l.rollNo || 0}`,
    type: l.type || 'STUDENT_LOGIN',
    studentId: l.studentId,
    studentName: (l.studentName || 'Student').trim(),
    rollNo: Number(l.rollNo),
    prn: (l.prn || '').trim().toUpperCase(),
    department: l.department || 'entc',
    division: l.division || 'SY-A',
    idCardPhoto: l.idCardPhoto && l.idCardPhoto.length < 5000 ? l.idCardPhoto : null,
    deviceId: l.deviceId,
    status: l.status || 'VERIFIED_PHYSICAL_ID',
    timestamp: l.timestamp || new Date().toISOString()
  };
}

function sanitizeSession(sess) {
  if (!sess) return null;
  return {
    id: sess.id || `SESS_${Date.now()}`,
    subjectName: (sess.subjectName || 'Lecture').trim(),
    teacherId: sess.teacherId || 'T_FACULTY',
    teacherName: (sess.teacherName || 'Faculty Member').trim(),
    department: sess.department || 'entc',
    division: sess.division || 'SY-A',
    divisions: sess.divisions || (sess.division ? sess.division.split(',').map(d => d.trim()) : ['SY-A']),
    batch: sess.batch || 'All',
    startTime: sess.startTime || new Date().toISOString(),
    endTime: sess.endTime || new Date().toISOString(),
    durationMinutes: Number(sess.durationMinutes) || 3,
    status: sess.status || 'closed',
    date: sess.date || (sess.startTime ? sess.startTime.split('T')[0] : new Date().toISOString().split('T')[0]),
    totalPresent: sess.totalPresent !== undefined ? sess.totalPresent : (sess.attendees?.length || 0),
    totalStudents: sess.totalStudents || 80,
    attendees: Array.isArray(sess.attendees) ? sess.attendees : []
  };
}

async function fetchCloudState() {
  const now = Date.now();
  if (memoryCache && now - lastFetchTime < 1500) {
    return memoryCache;
  }

  try {
    const res = await fetch(`${SYNC_URL}/json?poll=1`, { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      const lines = text.trim().split('\n').filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const item = JSON.parse(lines[i]);
          if (item && item.event === 'message' && item.message) {
            const parsed = JSON.parse(item.message);
            if (parsed && typeof parsed === 'object') {
              const state = {
                students: Array.isArray(parsed.students) ? parsed.students : [],
                sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
                logs: Array.isArray(parsed.logs) ? parsed.logs : [],
                hodAccounts: parsed.hodAccounts && typeof parsed.hodAccounts === 'object' ? parsed.hodAccounts : {},
                teachers: Array.isArray(parsed.teachers) ? parsed.teachers : []
              };
              memoryCache = state;
              lastFetchTime = now;
              try { localStorage.setItem('sy_cloud_cache_v3', JSON.stringify(state)); } catch (e) {}
              return state;
            }
          }
        } catch (lineErr) {}
      }
    }
  } catch (err) {
    console.warn('Cloud poll warning:', err.message);
  }

  // Fallback to local storage
  try {
    const local = localStorage.getItem('sy_cloud_cache_v3');
    if (local) {
      const parsed = JSON.parse(local);
      memoryCache = parsed;
      return parsed;
    }
  } catch (e) {}

  return { students: [], sessions: [], logs: [], hodAccounts: {}, teachers: [] };
}

async function broadcastCloudState(state) {
  memoryCache = state;
  lastFetchTime = Date.now();
  try { localStorage.setItem('sy_cloud_cache_v3', JSON.stringify(state)); } catch (e) {}

  try {
    const payload = JSON.stringify(state);
    await fetch(SYNC_URL, {
      method: 'POST',
      headers: {
        'Title': 'STATE_SYNC',
        'Priority': 'urgent'
      },
      body: payload
    });
  } catch (err) {
    console.warn('Cloud broadcast warning:', err.message);
  }
}

export const CloudSync = {
  // 1. HOD Accounts
  getHodAccounts: async () => {
    const state = await fetchCloudState();
    return state.hodAccounts || {};
  },

  saveHodAccount: async (department, accountData) => {
    const state = await fetchCloudState();
    state.hodAccounts = state.hodAccounts || {};
    state.hodAccounts[department] = {
      name: (accountData.name || '').trim(),
      password: accountData.password,
      configuredAt: new Date().toISOString()
    };
    await broadcastCloudState(state);
    return state.hodAccounts[department];
  },

  // 2. Students Roster
  getStudents: async (department = null, division = null) => {
    const state = await fetchCloudState();
    let list = state.students || [];

    if (department && department !== 'all') {
      list = list.filter(s => s.department === department);
    }
    if (division) {
      list = list.filter(s => s.division === division);
    }

    list.sort((a, b) => Number(a.rollNo || 0) - Number(b.rollNo || 0));
    return list;
  },

  saveStudent: async (student) => {
    const cleanStudent = sanitizeStudent(student);
    if (!cleanStudent) return student;

    const state = await fetchCloudState();
    state.students = state.students || [];

    const idx = state.students.findIndex(s =>
      s.id === cleanStudent.id ||
      (s.rollNo === Number(cleanStudent.rollNo) && s.department === cleanStudent.department && s.division === cleanStudent.division)
    );

    if (idx >= 0) {
      state.students[idx] = { ...state.students[idx], ...cleanStudent };
    } else {
      state.students.push(cleanStudent);
    }

    await broadcastCloudState(state);
    return cleanStudent;
  },

  deleteStudent: async (studentId) => {
    const state = await fetchCloudState();
    state.students = (state.students || []).filter(s => s.id !== studentId && s.rollNo !== Number(studentId));
    state.logs = (state.logs || []).filter(l => l.studentId !== studentId && l.rollNo !== Number(studentId));
    await broadcastCloudState(state);
  },

  resetDevice: async (studentId) => {
    const state = await fetchCloudState();
    state.students = (state.students || []).map(s => {
      if (s.id === studentId || s.rollNo === Number(studentId)) {
        return { ...s, boundDeviceId: null, boundAt: null };
      }
      return s;
    });
    await broadcastCloudState(state);
  },

  // 3. Conducted Lecture Sessions
  getSessions: async (department = null) => {
    const state = await fetchCloudState();
    let list = state.sessions || [];

    if (department && department !== 'all') {
      list = list.filter(s => s.department === department);
    }

    // Deduplicate sessions by department, division, subjectName, and timestamp
    const dedupMap = new Map();
    list.forEach(sess => {
      const timeKey = sess.startTime ? sess.startTime.slice(0, 16) : (sess.date || sess.id);
      const key = `${sess.department || 'entc'}_${sess.division || 'SY-A'}_${sess.subjectName || 'Lecture'}_${timeKey}`;
      
      const existing = dedupMap.get(key);
      if (!existing) {
        dedupMap.set(key, sess);
      } else {
        const existingCount = existing.totalPresent !== undefined ? existing.totalPresent : (existing.attendees?.length || 0);
        const newCount = sess.totalPresent !== undefined ? sess.totalPresent : (sess.attendees?.length || 0);
        if (newCount >= existingCount) {
          dedupMap.set(key, sess);
        }
      }
    });

    const uniqueList = Array.from(dedupMap.values());
    uniqueList.sort((a, b) => new Date(b.startTime || b.date || 0) - new Date(a.startTime || a.date || 0));
    return uniqueList;
  },

  saveSession: async (session) => {
    const cleanSess = sanitizeSession(session);
    if (!cleanSess) return session;

    const state = await fetchCloudState();
    state.sessions = state.sessions || [];

    const idx = state.sessions.findIndex(s => s.id === cleanSess.id);
    if (idx >= 0) {
      state.sessions[idx] = { ...state.sessions[idx], ...cleanSess };
    } else {
      state.sessions.unshift(cleanSess);
    }

    await broadcastCloudState(state);
    return cleanSess;
  },

  deleteSession: async (sessionId) => {
    const state = await fetchCloudState();
    state.sessions = (state.sessions || []).filter(s => s.id !== sessionId);
    await broadcastCloudState(state);
  },

  // 4. Live Login Logs
  getLogs: async (department = null) => {
    const state = await fetchCloudState();
    let list = state.logs || [];

    if (department && department !== 'all') {
      list = list.filter(l => l.department === department);
    }

    list.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    return list;
  },

  saveLog: async (log) => {
    const cleanLog = sanitizeLog(log);
    if (!cleanLog) return log;

    const state = await fetchCloudState();
    state.logs = state.logs || [];
    state.logs.unshift(cleanLog);

    if (state.logs.length > 100) {
      state.logs = state.logs.slice(0, 100);
    }

    await broadcastCloudState(state);
    return cleanLog;
  },

  // 5. Teachers
  getTeachers: async (department = null) => {
    const state = await fetchCloudState();
    let list = state.teachers || [];
    if (department && department !== 'all') {
      list = list.filter(t => t.department === department);
    }
    return list;
  },

  saveTeacher: async (teacher) => {
    const state = await fetchCloudState();
    state.teachers = state.teachers || [];
    const idx = state.teachers.findIndex(t => t.id === teacher.id || (t.name === teacher.name && t.department === teacher.department));
    if (idx >= 0) {
      state.teachers[idx] = { ...state.teachers[idx], ...teacher };
    } else {
      state.teachers.push(teacher);
    }
    await broadcastCloudState(state);
    return teacher;
  }
};
