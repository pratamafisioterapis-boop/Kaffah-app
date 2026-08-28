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

const HOMECARE_CHECKIN_GRACE_MINUTES = 30;

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// A homecare visit that morning makes it physically impossible to clock in
// at the clinic at the normal time. For every homecare block that has
// already started by the currently-expected check-in time, push the
// expectation back to 30 minutes after that visit ends — chained so two
// back-to-back homecare visits both get accounted for.
const applyHomecareCheckInAdjustment = (expectedMinutes, homecareBlocks) => {
  if (!homecareBlocks || homecareBlocks.length === 0) return expectedMinutes;
  let effective = expectedMinutes;
  let changed = true;
  while (changed) {
    changed = false;
    for (const block of homecareBlocks) {
      const start = toMinutes(block.start);
      const end = toMinutes(block.end);
      const releaseAt = end + HOMECARE_CHECKIN_GRACE_MINUTES;
      if (start <= effective && releaseAt > effective) {
        effective = releaseAt;
        changed = true;
      }
    }
  }
  return effective;
};

export const resolveAttendanceStatus = ({
  checkIn,
  checkOut,
  date,
  department,
  therapistSchedule, // { [dayOfWeek 0-6]: 'HH:MM' | 'HH:MM:SS' } | null
  therapistOverrides, // { [date]: 'HH:MM' | 'HH:MM:SS' } | null
  shiftSettingsByDept = {},
  defaultShift = { expected_check_in: '08:00', grace_minutes: 15 },
  // Homecare visits for this therapist on this date, used to relax both
  // check-in lateness (a morning visit delays when they can reach the
  // clinic) and the missing-checkout flag (a visit that is the last
  // session of the day means they may never come back to the clinic).
  homecare = null, // { blocks: [{ start: 'HH:MM', end: 'HH:MM' }], lastSessionIsHomecare: boolean } | null
}) => {
  if (!checkOut && !homecare?.lastSessionIsHomecare) {
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
  let expectedMinutes = eh * 60 + em;
  const homecareAdjustedMinutes = applyHomecareCheckInAdjustment(expectedMinutes, homecare?.blocks);
  if (homecareAdjustedMinutes > expectedMinutes) {
    expectedMinutes = homecareAdjustedMinutes;
    expectedCheckIn = `${String(Math.floor(expectedMinutes / 60)).padStart(2, '0')}:${String(expectedMinutes % 60).padStart(2, '0')}`;
    expectedSource = 'homecare';
  }

  if (!checkIn) {
    // No check-in either, but the day's last session was homecare — treat
    // it as a day worked away from the clinic rather than incomplete.
    return { status: 'on_time', late_minutes: 0, expected_check_in: expectedCheckIn, expected_source: expectedSource };
  }

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
