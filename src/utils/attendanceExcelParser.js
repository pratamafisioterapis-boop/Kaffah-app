// Parser for "Employee Attendance Record" exports produced by common
// fingerprint/attendance-machine software (User ID / Name / Department
// header block, followed by a day-number row 1..31, followed by a row of
// "HH:MM\nHH:MM" punches per day column).
import { read, utils } from 'xlsx';
import { matchEmployeeNameToTherapist } from '@/utils/therapistNameMatch';

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

const parseTimeToken = (tok) => {
  const m = tok.trim().match(TIME_RE);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return { minutes: h * 60 + min, label: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` };
};

const findLabelValue = (row, label) => {
  const idx = row.findIndex((c) => c !== null && c !== undefined && c.toString().trim().toLowerCase() === label.toLowerCase());
  if (idx === -1) return null;
  for (let j = idx + 1; j < Math.min(row.length, idx + 6); j++) {
    const v = row[j];
    if (v !== null && v !== undefined && v.toString().trim() !== '') return v.toString().trim();
  }
  return null;
};

export const attendanceDateForDay = (periodStart, day) => {
  if (!periodStart) return null;
  const base = new Date(`${periodStart}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;
  base.setDate(base.getDate() + (day - 1));
  return base.toISOString().slice(0, 10);
};

/**
 * Parses the raw workbook data (binary string or array buffer) into a list
 * of per-employee day punches plus the attendance period found in the file.
 */
export const parseAttendanceExcel = (data, { type = 'binary' } = {}) => {
  const wb = read(data, { type });
  const wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const rows = utils.sheet_to_json(ws, { header: 1, defval: '' });

  let periodStart = null;
  let periodEnd = null;
  outer: for (const row of rows) {
    for (const cell of row) {
      if (typeof cell !== 'string') continue;
      const m = cell.match(/Attendance date:\s*(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/i);
      if (m) {
        periodStart = m[1];
        periodEnd = m[2];
        break outer;
      }
    }
  }

  const warnings = [];
  if (!periodStart) {
    warnings.push('Periode absensi ("Attendance date") tidak ditemukan di file. Pastikan file adalah export asli dari mesin absensi.');
  }

  const employees = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const hasUserIdLabel = row.some((c) => c !== null && c !== undefined && c.toString().trim().toLowerCase() === 'user id:');
    if (!hasUserIdLabel) continue;

    const externalId = findLabelValue(row, 'User ID:');
    const name = findLabelValue(row, 'Name:');
    const department = findLabelValue(row, 'Department:');

    let dayRowIdx = -1;
    for (let j = i + 1; j < Math.min(rows.length, i + 4); j++) {
      const numericCount = rows[j].filter((c) => Number.isInteger(c) && c >= 1 && c <= 31).length;
      if (numericCount >= 5) {
        dayRowIdx = j;
        break;
      }
    }
    if (dayRowIdx === -1) {
      warnings.push(`Baris tanggal untuk ${name || externalId || 'salah satu karyawan'} tidak ditemukan, data dilewati.`);
      continue;
    }
    const dayRow = rows[dayRowIdx];
    const punchRow = rows[dayRowIdx + 1] || [];

    const days = [];
    dayRow.forEach((dayValue, colIdx) => {
      if (!(Number.isInteger(dayValue) && dayValue >= 1 && dayValue <= 31)) return;
      const raw = punchRow[colIdx];
      if (raw === null || raw === undefined || raw.toString().trim() === '') return;

      const tokens = raw.toString().split('\n').map((t) => t.trim()).filter(Boolean);
      const times = tokens.map(parseTimeToken).filter(Boolean).sort((a, b) => a.minutes - b.minutes);
      if (times.length === 0) return;

      days.push({
        day: dayValue,
        checkIn: times[0].label,
        checkOut: times.length > 1 ? times[times.length - 1].label : null,
        rawPunches: times.map((t) => t.label),
      });
    });

    if (!name && !externalId) {
      warnings.push(`Ditemukan blok karyawan tanpa Nama/User ID pada baris ${i + 1}, dilewati.`);
    } else {
      employees.push({
        externalId,
        name: name || `Karyawan ${externalId}`,
        department: department || null,
        days,
      });
    }

    i = dayRowIdx + 1;
  }

  if (employees.length === 0) {
    warnings.push('Tidak ada data karyawan yang berhasil dibaca dari file ini.');
  }

  return { periodStart, periodEnd, employees, warnings };
};

/**
 * Flattens parsed employee blocks into flat day records with lateness
 * computed against the employee's actual booking-calendar schedule for that
 * day of week when available (therapist_schedules), falling back to a
 * per-department expected check-in time, then a global default.
 *
 * `therapists` is the list from getAttendanceScheduleLookup():
 * { id, name, schedule: { [dayOfWeek 0-6]: 'HH:MM' } }[]. Attendance-machine
 * names are short/nicknames, so they're matched to the therapist's full
 * formal name with matchEmployeeNameToTherapist rather than an exact match.
 */
export const buildAttendanceRecords = (
  parsed,
  { shiftSettingsByDept = {}, therapists = [], defaultShift = { expected_check_in: '08:00', grace_minutes: 15 } } = {}
) => {
  const records = [];
  for (const emp of parsed.employees) {
    const matchedTherapist = matchEmployeeNameToTherapist(emp.name, therapists);
    const empSchedule = matchedTherapist?.schedule;
    for (const d of emp.days) {
      const date = attendanceDateForDay(parsed.periodStart, d.day);
      if (!date) continue;

      let status;
      let lateMinutes = 0;
      let expectedCheckIn = null;
      let expectedSource = null;

      if (!d.checkOut) {
        // Only one punch recorded for the day — could be a missed check-in
        // or a missed check-out, so lateness can't be determined reliably.
        status = 'incomplete';
      } else {
        const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
        const scheduledStart = empSchedule?.[dayOfWeek];
        const deptShift = emp.department && shiftSettingsByDept[emp.department];

        if (scheduledStart) {
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
        const [ch, cm] = d.checkIn.split(':').map(Number);
        const actualMinutes = ch * 60 + cm;

        const isLate = actualMinutes > expectedMinutes + graceMinutes;
        lateMinutes = isLate ? actualMinutes - expectedMinutes : 0;
        status = isLate ? 'late' : 'on_time';
      }

      records.push({
        employee_external_id: emp.externalId,
        employee_name: emp.name,
        department: emp.department,
        attendance_date: date,
        check_in: d.checkIn,
        check_out: d.checkOut,
        raw_punches: d.rawPunches,
        status,
        late_minutes: lateMinutes,
        expected_check_in: expectedCheckIn,
        expected_source: expectedSource,
        matched_therapist_name: matchedTherapist?.name || null,
      });
    }
  }
  return records;
};
