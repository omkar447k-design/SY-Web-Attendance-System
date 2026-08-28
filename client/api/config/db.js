// Multi-Department & Serverless-Ready Database with 6 HOD Accounts, Faculty Lecture Logs & Audit
export const DEPARTMENTS = [
  { id: 'comp', name: 'Computer Science & Engineering', code: 'CSE', keywords: ['computer', 'cse', 'comp', 'software'] },
  { id: 'it', name: 'Information Technology', code: 'IT', keywords: ['information', 'it', 'infotech'] },
  { id: 'aids', name: 'Artificial Intelligence & Data Science', code: 'AI&DS', keywords: ['artificial', 'intelligence', 'data science', 'ai&ds', 'aids', 'ai/ds', 'ai'] },
  { id: 'entc', name: 'Electronics & Telecommunication', code: 'ENTC', keywords: ['telecommunication', 'entc', 'electronics and telecommunication', 'e&tc', 'extc', 'etc'] },
  { id: 'elec', name: 'Electrical Engineering', code: 'ELEC', keywords: ['electrical', 'ee', 'elec'] },
  { id: 'instru', name: 'Instrumentation Engineering', code: 'INSTRU', keywords: ['instrumentation', 'instru', 'inst'] }
];

export const DIVISIONS = ['SY-A', 'SY-B', 'SY-C'];

const initialData = {
  settings: {
    collegeName: 'Engineering College & Technology',
    academicYear: '2025-2026',
    defaultDurationMinutes: 3,
    maxDurationMinutes: 10,
    pinRotationSeconds: 10,
    pinToleranceSeconds: 12,
    adminGatekeeperCode: 'admin',
    facultyPassword: 'faculty@2026'
  },
  hodAccounts: {
    comp: { department: 'comp', name: 'HOD Computer Science', password: null, isFirstTime: true },
    it: { department: 'it', name: 'HOD Information Technology', password: null, isFirstTime: true },
    aids: { department: 'aids', name: 'HOD AI & Data Science', password: null, isFirstTime: true },
    entc: { department: 'entc', name: 'HOD ENTC', password: null, isFirstTime: true },
    elec: { department: 'elec', name: 'HOD Electrical', password: null, isFirstTime: true },
    instru: { department: 'instru', name: 'HOD Instrumentation', password: null, isFirstTime: true }
  },
  teachers: [
    { id: 'T101', name: 'Dr. A. K. Sharma', department: 'comp', email: 'sharma@college.edu', role: 'Teacher' },
    { id: 'T102', name: 'Prof. S. R. Patil', department: 'it', email: 'patil@college.edu', role: 'Teacher' },
    { id: 'T103', name: 'Prof. N. V. Deshmukh', department: 'aids', email: 'deshmukh@college.edu', role: 'Teacher' },
    { id: 'T104', name: 'Prof. V. M. Kulkarni', department: 'entc', email: 'kulkarni@college.edu', role: 'Teacher' },
    { id: 'T105', name: 'Prof. P. R. Joshi', department: 'elec', email: 'joshi@college.edu', role: 'Teacher' },
    { id: 'T106', name: 'Prof. M. S. Shinde', department: 'instru', email: 'shinde@college.edu', role: 'Teacher' }
  ],
  subjects: [
    { id: 'SUB101', code: 'CS201', name: 'Operating Systems', department: 'comp', division: 'SY-A', type: 'Theory', teacherId: 'T101' },
    { id: 'SUB102', code: 'CS202', name: 'Database Management Systems (DBMS)', department: 'comp', division: 'SY-A', type: 'Theory', teacherId: 'T101' },
    { id: 'SUB103', code: 'IT201', name: 'Data Structures & Algorithms', department: 'it', division: 'SY-A', type: 'Theory', teacherId: 'T102' },
    { id: 'SUB104', code: 'AI201', name: 'Machine Learning Foundations', department: 'aids', division: 'SY-A', type: 'Theory', teacherId: 'T103' },
    { id: 'SUB105', code: 'ET201', name: 'Digital Signal Processing', department: 'entc', division: 'SY-A', type: 'Theory', teacherId: 'T104' },
    { id: 'SUB106', code: 'EE201', name: 'Power Systems & Machines', department: 'elec', division: 'SY-A', type: 'Theory', teacherId: 'T105' },
    { id: 'SUB107', code: 'IN201', name: 'Sensors & Transducers', department: 'instru', division: 'SY-A', type: 'Theory', teacherId: 'T106' }
  ],
  students: [
    { id: 'S01', rollNo: 1, prn: '12251ET001', name: 'Aarav Mehta', department: 'comp', division: 'SY-A', batch: 'B1', boundDeviceId: null, boundFingerprint: null, idCardPhoto: null },
    { id: 'S02', rollNo: 2, prn: '12251ET002', name: 'Aditi Rao', department: 'comp', division: 'SY-A', batch: 'B1', boundDeviceId: null, boundFingerprint: null, idCardPhoto: null },
    { id: 'S22', rollNo: 22, prn: '12251ET049', name: 'Sanket Bhosale', department: 'comp', division: 'SY-A', batch: 'B2', boundDeviceId: null, boundFingerprint: null, idCardPhoto: null },
    { id: 'S23', rollNo: 23, prn: '12251ET050', name: 'Shruti Tawde', department: 'comp', division: 'SY-A', batch: 'B2', boundDeviceId: null, boundFingerprint: null, idCardPhoto: null },
    { id: 'S24', rollNo: 24, prn: '12251ET051', name: 'Omkar Pawar', department: 'comp', division: 'SY-A', batch: 'B2', boundDeviceId: null, boundFingerprint: null, idCardPhoto: null }
  ],
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
