// Multi-Department Database Configuration
export const DEPARTMENTS = [
  { id: 'comp', name: '1. Computer Science & Engineering', code: 'CSE', prnCode: 'CS', keywords: ['computer', 'cse', 'comp'] },
  { id: 'it', name: '2. Information Technology', code: 'IT', prnCode: 'IT', keywords: ['information technology', 'infotech'] },
  { id: 'aids', name: '3. Artificial Intelligence & Data Science', code: 'AI&DS', prnCode: 'AD', keywords: ['artificial', 'data science', 'ai&ds', 'aids', 'ai/ds', 'ai & ds'] },
  { id: 'entc', name: '4. Electronics & Telecommunication', code: 'ENTC', prnCode: 'ET', keywords: ['electronics', 'telecommunication', 'entc', 'electronics & telecommunication', 'electronics and telecommunication', 'e&tc', 'extc', 'etc'] },
  { id: 'elec', name: '5. Electrical Engineering', code: 'ELEC', prnCode: 'EL', keywords: ['electrical', 'ee', 'elec'] },
  { id: 'instru', name: '6. Instrumentation Engineering', code: 'INSTRU', prnCode: 'IN', keywords: ['instrumentation', 'instru', 'inst'] }
];

export const DIVISIONS = ['SY-A', 'SY-B', 'SY-C'];

const initialData = {
  settings: {
    collegeName: process.env.COLLEGE_NAME || 'Engineering College & Technology',
    academicYear: '2025-2026',
    defaultDurationMinutes: 3,
    maxDurationMinutes: 10,
    pinRotationSeconds: 10,
    pinToleranceSeconds: 12,
    adminGatekeeperCode: process.env.ADMIN_GATEKEEPER_CODE || 'admin',
    facultyPassword: process.env.FACULTY_MASTER_PASSCODE || 'faculty@2026'
  },
  // 1 HOD per Department (Configured on First-Time Setup by HOD)
  hodAccounts: {
    comp: { department: 'comp', name: null, password: null, isFirstTime: true },
    it: { department: 'it', name: null, password: null, isFirstTime: true },
    aids: { department: 'aids', name: null, password: null, isFirstTime: true },
    entc: { department: 'entc', name: null, password: null, isFirstTime: true },
    elec: { department: 'elec', name: null, password: null, isFirstTime: true },
    instru: { department: 'instru', name: null, password: null, isFirstTime: true }
  },
  teachers: [],
  subjects: [],
  students: [],
  sessions: [],
  attendance: [],
  loginLogs: []
};

if (!global._sy_db_data) {
  global._sy_db_data = JSON.parse(JSON.stringify(initialData));
}

class Database {
  get(collection) {
    return global._sy_db_data[collection] || [];
  }

  set(collection, items) {
    global._sy_db_data[collection] = items;
  }

  getHodAccounts() {
    return global._sy_db_data.hodAccounts || initialData.hodAccounts;
  }

  setHodAccount(dept, data) {
    if (!global._sy_db_data.hodAccounts) global._sy_db_data.hodAccounts = initialData.hodAccounts;
    global._sy_db_data.hodAccounts[dept] = {
      ...global._sy_db_data.hodAccounts[dept],
      ...data
    };
  }

  addLog(log) {
    if (!global._sy_db_data.loginLogs) global._sy_db_data.loginLogs = [];
    global._sy_db_data.loginLogs.unshift({
      id: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...log
    });
    if (global._sy_db_data.loginLogs.length > 500) {
      global._sy_db_data.loginLogs = global._sy_db_data.loginLogs.slice(0, 500);
    }
  }

  getLogs(limit = 100, department = null) {
    const logs = global._sy_db_data.loginLogs || [];
    if (!department || department === 'all') return logs.slice(0, limit);
    return logs.filter(l => l.department === department).slice(0, limit);
  }

  getSettings() {
    return global._sy_db_data.settings;
  }

  updateSettings(newSettings) {
    global._sy_db_data.settings = { ...global._sy_db_data.settings, ...newSettings };
    return global._sy_db_data.settings;
  }
}

export const db = new Database();
