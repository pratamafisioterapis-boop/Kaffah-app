// Pure lateness computation for a single attendance day, shared by
// attendanceExcelParser.buildAttendanceRecords (batch import from an
// uploaded file) and the recalculateAttendance* functions in lib/api.js
// (re-evaluating already-saved rows after a schedule/override/alias
// change). Kept dependency-free (no xlsx import) so importing it from
// lib/api.js — loaded across the whole app — doesn't pull the Excel parser
// into the main bundle.
//
// Priority: date-specific override > weekly schedule for that day of week >
// per-department shift setting > global default.
export const resolveAttendanceStatus = ({
  checkIn,
  checkOut,
  date,
  department,
  therapistSchedule, // { [dayOfWeek 0-6]: 'HH:MM' | 'HH:MM:SS' } | null
  therapistOverrides, // { [date]: 'HH:MM' | 'HH:MM:SS' } | null
  shiftSettingsByDept = {},
  defaultShift = { expected_check_in: '08:00', grace_minutes: 15 },
}) => {
  if (!checkOut) {
    // Only one punch recorded for the day — could be a missed check-in
    // or a missed check-out, so lateness can't be determined reliably.
    return { status: 'incomplete', late_minutes: 0, expected_check_in: null, expected_source: null };
  }

  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  const overrideStart = therapistOverrides?.[date];
  const scheduledStart = therapistSchedule?.[dayOfWeek];
  const deptShift = department && shiftSettingsByDept[department];

  let expectedCheckIn;
  let expectedSource;
  if (overrideStart) {
    expectedCheckIn = overrideStart.slice(0, 5);
    expectedSource = 'override';
  } else if (scheduledStart) {
    expectedCheckIn = scheduledStart.slice(0, 5);
    expectedSource = 'schedule';
  } else if (deptShift?.expected_check_in) {
    expectedCheckIn = deptShift.expected_check_in.slice(0, 5);
    expectedSource = 'department';
  } else {
    expectedCheckIn = defaultShift.expected_check_in;
    expectedSource = 'default';
  }
  const graceMinutes = deptShift?.grace_minutes ?? defaultShift.grace_minutes ?? 0;

  const [eh, em] = expectedCheckIn.split(':').map(Number);
  const expectedMinutes = eh * 60 + em;
  const [ch, cm] = checkIn.split(':').map(Number);
  const actualMinutes = ch * 60 + cm;

  const isLate = actualMinutes > expectedMinutes + graceMinutes;
  const lateMinutes = isLate ? actualMinutes - expectedMinutes : 0;

  return {
    status: isLate ? 'late' : 'on_time',
    late_minutes: lateMinutes,
    expected_check_in: expectedCheckIn,
    expected_source: expectedSource,
  };
};
