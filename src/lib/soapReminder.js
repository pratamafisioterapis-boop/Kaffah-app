// Pengingat SOAP untuk terapis: SOAP harus diisi sebelum slot sesi berakhir.
// Slot memakai jadwal asli (appointment_date + duration_minutes), jadi sesi 13.00-14.30
// dihitung 90 menit. Hanya relevan di klinik SOAP-first (soap_completed_at terisi oleh trigger).

export const REMINDER_WARN_MIN = 15;
export const REMINDER_CRIT_MIN = 5;
const DEFAULT_SLOT_MIN = 60;
const OPEN_STATUSES = ['confirmed', 'rescheduled'];

export const slotOf = (appointment) => {
  if (!appointment?.appointment_date) return null;
  const start = new Date(appointment.appointment_date).getTime();
  if (Number.isNaN(start)) return null;
  const duration = Number(appointment.duration_minutes) > 0 ? Number(appointment.duration_minutes) : DEFAULT_SLOT_MIN;
  return { start, end: start + duration * 60000, durationMin: duration };
};

export const fmtClock = (ms) => {
  try {
    return new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' });
  } catch {
    return '-';
  }
};

export const reminderLevel = (remainingMin) => {
  if (remainingMin <= REMINDER_CRIT_MIN) return 'crit';
  if (remainingMin <= REMINDER_WARN_MIN) return 'warn';
  return 'info';
};

// sessions: hasil normalisasi useTherapistToday. Mengembalikan sesi yang paling mendesak, atau null.
// Sesi yang masih berjalan didahulukan (sisa waktu paling sedikit), lalu sesi yang sudah lewat tanpa SOAP.
export const pickReminder = (sessions, now) => {
  const open = (sessions || []).filter((s) => s.slot && !s.soapDone && s.apptOpen && now >= s.slot.start);
  if (open.length === 0) return null;
  const ongoing = open.filter((s) => now < s.slot.end).sort((a, b) => a.slot.end - b.slot.end);
  const session = ongoing[0] || open.sort((a, b) => a.slot.end - b.slot.end)[0];
  const remainingMin = Math.ceil((session.slot.end - now) / 60000);
  const elapsed = Math.min(1, Math.max(0, (now - session.slot.start) / (session.slot.end - session.slot.start)));
  return { session, remainingMin, level: reminderLevel(remainingMin), progress: elapsed };
};

export const isApptOpen = (status) => OPEN_STATUSES.includes(status);
