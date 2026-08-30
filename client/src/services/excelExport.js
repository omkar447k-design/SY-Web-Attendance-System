import * as XLSX from 'xlsx';

const DEPT_NAMES = {
  comp: 'Computer Science & Engineering',
  it: 'Information Technology',
  aids: 'Artificial Intelligence & Data Science',
  entc: 'Electronics & Telecommunication',
  elec: 'Electrical Engineering',
  instru: 'Instrumentation Engineering'
};

function getRegisteredRoster() {
  try {
    const raw = localStorage.getItem('sy_perm_students');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Generates an Excel (.xlsx) file with the exact sequential attendance format:
 * - Header: Department, Division, Subject Name, Faculty Name, Date & Time
 * - Table (Sequential Roll No. 1 to 80):
 *   Column 1: Roll No. (1, 2, 3... 80)
 *   Column 2: Student Name (Fetched from roster or marked attendee; blank if absent & unregistered)
 *   Column 3: PRN / Enrollment No. (Fetched from roster or marked attendee; blank if absent & unregistered)
 *   Column 4: Attendance Status (PRESENT or ABSENT)
 *   Column 5: Marked Time (Formatted timestamp for present; blank for absent)
 */
export function exportLectureExcelFile(session) {
  if (!session) return;

  const departmentName = DEPT_NAMES[session.department] || (session.department || 'Engineering').toUpperCase();
  const division = session.division || 'SY-A';
  const subjectName = session.subjectName || 'Lecture';
  const facultyName = session.teacherName || 'Faculty Member';
  const conductedDate = session.date || (session.startTime ? new Date(session.startTime).toLocaleDateString() : new Date().toLocaleDateString());
  const conductedTime = session.startTime 
    ? new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const attendees = session.attendees || [];
  const registeredStudents = getRegisteredRoster();

  // Create fast lookup maps
  const attendeeMap = new Map();
  attendees.forEach(att => {
    const roll = Number(att.rollNo);
    if (!isNaN(roll)) {
      attendeeMap.set(roll, att);
    }
  });

  const rosterMap = new Map();
  registeredStudents.forEach(st => {
    const roll = Number(st.rollNo);
    if (!isNaN(roll) && (!session.department || st.department === session.department)) {
      rosterMap.set(roll, st);
    }
  });

  // Calculate highest roll number (default standard SY class strength is 80)
  const maxAttendeeRoll = attendees.reduce((max, a) => Math.max(max, Number(a.rollNo) || 0), 0);
  const maxRosterRoll = registeredStudents.reduce((max, s) => Math.max(max, Number(s.rollNo) || 0), 0);
  const totalClassStrength = Math.max(80, maxAttendeeRoll, maxRosterRoll);

  // Build Sheet Rows
  const rows = [
    ['DEPARTMENT:', departmentName, '', 'DIVISION:', division],
    ['SUBJECT / COURSE:', subjectName, '', 'FACULTY / TEACHER:', facultyName],
    ['CONDUCTED DATE & TIME:', `${conductedDate} at ${conductedTime}`, '', 'BATCH:', session.batch || 'All'],
    ['TOTAL CLASS STRENGTH:', `${totalClassStrength} Students`, '', 'TOTAL VERIFIED PRESENT:', `${attendeeMap.size} Present`],
    ['ATTENDANCE PERCENTAGE:', `${((attendeeMap.size / totalClassStrength) * 100).toFixed(1)}%`, '', 'SESSION STATUS:', 'CONCLUDED'],
    [],
    ['Roll No.', 'Student Name', 'PRN / Enrollment No.', 'Attendance Status', 'Marked Time']
  ];

  // Generate 1 to 80 sequentially
  for (let roll = 1; roll <= totalClassStrength; roll++) {
    const att = attendeeMap.get(roll);
    const reg = rosterMap.get(roll);

    if (att) {
      // Student is PRESENT
      const studentName = att.studentName && att.studentName !== 'Student' 
        ? att.studentName 
        : (reg?.name || 'Verified Student');
      const prn = att.prn && att.prn !== '-' 
        ? att.prn 
        : (reg?.prn || `12251ET${String(roll).padStart(3, '0')}`);
      const markedTime = att.timestamp 
        ? new Date(att.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
        : conductedTime;

      rows.push([
        roll,
        studentName,
        prn,
        'PRESENT',
        markedTime
      ]);
    } else {
      // Student is ABSENT - Blank spaces for absent student details as requested
      const studentName = reg?.name || '';
      const prn = reg?.prn || '';

      rows.push([
        roll,
        studentName,
        prn,
        'ABSENT',
        ''
      ]);
    }
  }

  rows.push([]);
  rows.push(['SUMMARY & AUDIT VERIFICATION:']);
  rows.push(['Total Class Strength:', totalClassStrength]);
  rows.push(['Total Present Students:', attendeeMap.size]);
  rows.push(['Total Absent Students:', totalClassStrength - attendeeMap.size]);
  rows.push(['Attendance Percentage:', `${((attendeeMap.size / totalClassStrength) * 100).toFixed(1)}%`]);
  rows.push(['Export Generated On:', `${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`]);

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Set professional column widths
  worksheet['!cols'] = [
    { wch: 10 }, // Roll No
    { wch: 34 }, // Student Name
    { wch: 24 }, // PRN
    { wch: 20 }, // Attendance Status
    { wch: 18 }  // Marked Time
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Report');

  const cleanSubject = subjectName.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanDiv = division.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Attendance_${cleanSubject}_${cleanDiv}_${conductedDate.replace(/[\/\\]/g, '-')}.xlsx`;

  XLSX.writeFile(workbook, filename);
}
