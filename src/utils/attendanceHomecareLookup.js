// Groups a list of appointments into per-therapist, per-date homecare
// context consumed by resolveAttendanceStatus: which part(s) of the day a
// therapist spent on a homecare visit (so a morning visit can delay when
// they're expected to clock in at the clinic), and whether the day's last
// session was homecare (so a missing checkout isn't flagged — they may
// never come back to the clinic that day).
const CLINIC_TIMEZONE = 'Asia/Makassar';

const ACTIVE_STATUSES = new Set(['confirmed', 'rescheduled', 'ongoing', 'completed']);

const toLocalDateAndMinutes = (isoString) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(isoString));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
};

const minutesToHHMM = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * @param {Array} appointments - rows shaped like getAppointments() results:
 *   { therapist_id, appointment_date (ISO timestamp), duration_minutes, is_homecare, status }
 * @returns {{ [therapistId: string]: { [date: string]: { blocks: {start:string,end:string}[], lastSessionIsHomecare: boolean } } }}
 */
export const buildHomecareLookup = (appointments) => {
  const byTherapistDate = {};
  for (const appt of appointments || []) {
    if (!appt.therapist_id || !appt.appointment_date) continue;
    if (appt.status && !ACTIVE_STATUSES.has(appt.status)) continue;

    const { date, minutes: start } = toLocalDateAndMinutes(appt.appointment_date);
    const end = start + (appt.duration_minutes || 60);

    const byDate = (byTherapistDate[appt.therapist_id] ??= {});
    const day = (byDate[date] ??= { sessions: [] });
    day.sessions.push({ start, end, isHomecare: !!appt.is_homecare });
  }

  const result = {};
  for (const [therapistId, byDate] of Object.entries(byTherapistDate)) {
    result[therapistId] = {};
    for (const [date, { sessions }] of Object.entries(byDate)) {
      const sorted = [...sessions].sort((a, b) => a.start - b.start);
      const lastSession = sorted[sorted.length - 1];
      result[therapistId][date] = {
        blocks: sorted
          .filter((s) => s.isHomecare)
          .map((s) => ({ start: minutesToHHMM(s.start), end: minutesToHHMM(s.end) })),
        lastSessionIsHomecare: !!lastSession?.isHomecare,
      };
    }
  }
  return result;
};
