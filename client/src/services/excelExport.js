import * as XLSX from 'xlsx';

const DEPT_NAMES = {
  comp: 'Computer Science & Engineering',
  it: 'Information Technology',
  aids: 'Artificial Intelligence & Data Science',
  entc: 'Electronics & Telecommunication',
  elec: 'Electrical Engineering',
  instru: 'Instrumentation Engineering'
};

/**
 * Generates an Excel (.xlsx) file with the exact requested layout:
 * - Header: Department & Division
 * - Below that: Date & Time, Subject Name, Faculty/Teacher Name
 * - Table: Roll No. | Student Name | PRN | Status | Marked Time
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

  const rows = [
    ['DEPARTMENT:', departmentName, '', 'DIVISION:', division],
    ['SUBJECT / COURSE:', subjectName, '', 'FACULTY / TEACHER:', facultyName],
    ['CONDUCTED DATE & TIME:', `${conductedDate} at ${conductedTime}`, '', 'BATCH:', session.batch || 'All'],
    ['TOTAL ATTENDANCE:', `${attendees.length} Present`, '', 'STATUS:', 'CONCLUDED'],
    [],
    ['Roll No.', 'Student Name', 'PRN / Enrollment No.', 'Attendance Status', 'Marked Time']
  ];

  if (attendees.length > 0) {
    const sortedAttendees = [...attendees].sort((a, b) => Number(a.rollNo || 0) - Number(b.rollNo || 0));
    sortedAttendees.forEach((att, idx) => {
      rows.push([
        att.rollNo || idx + 1,
        att.studentName || '-',
        att.prn || '-',
        'PRESENT',
        att.timestamp ? new Date(att.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : conductedTime
      ]);
    });
  } else {
    rows.push(['-', 'No present students recorded for this session', '-', 'ABSENT', '-']);
  }

  rows.push([]);
  rows.push(['SUMMARY:']);
  rows.push(['Total Verified Present:', attendees.length]);
  rows.push(['Generated On:', `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`]);

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  worksheet['!cols'] = [
    { wch: 12 }, // Roll No
    { wch: 32 }, // Student Name
    { wch: 22 }, // PRN
    { wch: 20 }, // Status
    { wch: 18 }  // Time
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');

  const cleanSubject = subjectName.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanDiv = division.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Attendance_${cleanSubject}_${cleanDiv}_${conductedDate.replace(/[\/\\]/g, '-')}.xlsx`;

  XLSX.writeFile(workbook, filename);
}
