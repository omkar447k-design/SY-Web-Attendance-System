// Multi-Department & Serverless-Ready Database
export const DEPARTMENTS = [
  { id: 'comp', name: 'Computer Science & Engineering', code: 'CSE' },
  { id: 'it', name: 'Information Technology', code: 'IT' },
  { id: 'aids', name: 'Artificial Intelligence & Data Science', code: 'AI&DS' },
  { id: 'entc', name: 'Electronics & Telecommunication', code: 'ENTC' },
  { id: 'elec', name: 'Electrical Engineering', code: 'ELEC' },
  { id: 'instru', name: 'Instrumentation Engineering', code: 'INSTRU' }
];

export const DIVISIONS = ['SY-A', 'SY-B', 'SY-C'];

const initialData = {
  settings: {
    collegeName: 'College of Engineering & Technology',
    academicYear: '2025-2026',
    defaultDurationMinutes: 3,
    maxDurationMinutes: 10,
    pinRotationSeconds: 10,
    pinToleranceSeconds: 12,
    adminPassword: 'admin'
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
    { id: 'S01', rollNo: 1, prn: '12251ET001', name: 'Aarav Mehta', department: 'comp', division: 'SY-A', batch: 'B1', boundDeviceId: null, boundFingerprint: null },
    { id: 'S02', rollNo: 2, prn: '12251ET002', name: 'Aditi Rao', department: 'comp', division: 'SY-A', batch: 'B1', boundDeviceId: null, boundFingerprint: null },
    { id: 'S22', rollNo: 22, prn: '12251ET049', name: 'Sanket Bhosale', department: 'comp', division: 'SY-A', batch: 'B2', boundDeviceId: null, boundFingerprint: null },
    { id: 'S23', rollNo: 23, prn: '12251ET050', name: 'Shruti Tawde', department: 'comp', division: 'SY-A', batch: 'B2', boundDeviceId: null, boundFingerprint: null },
    { id: 'S24', rollNo: 24, prn: '12251ET051', name: 'Omkar Pawar', department: 'comp', division: 'SY-A', batch: 'B2', boundDeviceId: null, boundFingerprint: null }
  ],
  sessions: [],
  attendance: []
};

// Global singleton for persistence across invocations
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

  getSettings() {
    return global._sy_db_data.settings;
  }

  updateSettings(newSettings) {
    global._sy_db_data.settings = { ...global._sy_db_data.settings, ...newSettings };
    return global._sy_db_data.settings;
  }
}

export const db = new Database();
