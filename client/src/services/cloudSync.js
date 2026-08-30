// REAL-TIME PERMANENT CROSS-DEVICE CLOUD DATABASE ENGINE
// Synchronizes HOD Accounts, Student Rosters, Live Logins, and Conducted Lectures across Mobile and Desktop.

const CLOUD_STORE_URL = 'https://api.restful-api.dev/objects/ff808181a04ccf2d01a0526641ec1632';

async function fetchCloudState() {
  try {
    const res = await fetch(CLOUD_STORE_URL, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json && json.data) {
        return {
          students: Array.isArray(json.data.students) ? json.data.students : [],
          sessions: Array.isArray(json.data.sessions) ? json.data.sessions : [],
          logs: Array.isArray(json.data.logs) ? json.data.logs : [],
          hodAccounts: json.data.hodAccounts && typeof json.data.hodAccounts === 'object' ? json.data.hodAccounts : {},
          teachers: Array.isArray(json.data.teachers) ? json.data.teachers : []
        };
      }
    }
  } catch (err) {
    console.warn('Cloud state fetch warning:', err.message);
  }

  // Fallback to local cache if network drop
  try {
    const raw = localStorage.getItem('sy_cloud_cache_v2');
    return raw ? JSON.parse(raw) : { students: [], sessions: [], logs: [], hodAccounts: {}, teachers: [] };
  } catch (e) {
    return { students: [], sessions: [], logs: [], hodAccounts: {}, teachers: [] };
  }
}

async function writeCloudState(state) {
  try {
    localStorage.setItem('sy_cloud_cache_v2', JSON.stringify(state));
  } catch (e) {}

  try {
    await fetch(CLOUD_STORE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'SY_ATTENDANCE_STATE',
        data: state
      })
    });
  } catch (err) {
    console.warn('Cloud state write warning:', err.message);
  }
}

export const CloudSync = {
  // 1. HOD Accounts (Permanent Cross-Device Creation & Verification)
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
    await writeCloudState(state);
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
    const state = await fetchCloudState();
    state.students = state.students || [];

    const idx = state.students.findIndex(s =>
      s.id === student.id ||
      (s.rollNo === Number(student.rollNo) && s.department === student.department && s.division === student.division)
    );

    if (idx >= 0) {
      state.students[idx] = { ...state.students[idx], ...student };
    } else {
      state.students.push(student);
    }

    await writeCloudState(state);
    return student;
  },

  deleteStudent: async (studentId) => {
    const state = await fetchCloudState();
    state.students = (state.students || []).filter(s => s.id !== studentId && s.rollNo !== Number(studentId));
    state.logs = (state.logs || []).filter(l => l.studentId !== studentId && l.rollNo !== Number(studentId));
    await writeCloudState(state);
  },

  resetDevice: async (studentId) => {
    const state = await fetchCloudState();
    state.students = (state.students || []).map(s => {
      if (s.id === studentId || s.rollNo === Number(studentId)) {
        return { ...s, boundDeviceId: null, boundAt: null };
      }
      return s;
    });
    await writeCloudState(state);
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
    const state = await fetchCloudState();
    state.sessions = state.sessions || [];

    const idx = state.sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      state.sessions[idx] = { ...state.sessions[idx], ...session };
    } else {
      state.sessions.unshift(session);
    }

    await writeCloudState(state);
    return session;
  },

  deleteSession: async (sessionId) => {
    const state = await fetchCloudState();
    state.sessions = (state.sessions || []).filter(s => s.id !== sessionId);
    await writeCloudState(state);
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
    const state = await fetchCloudState();
    state.logs = state.logs || [];
    state.logs.unshift({
      ...log,
      id: log.id || `LOG_${Date.now()}`,
      timestamp: log.timestamp || new Date().toISOString()
    });
    await writeCloudState(state);
    return log;
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
    await writeCloudState(state);
    return teacher;
  }
};
