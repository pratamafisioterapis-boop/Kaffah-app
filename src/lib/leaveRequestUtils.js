import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

export const LEAVE_TYPES = [
  { value: 'sick', label: 'Sakit' },
  { value: 'personal', label: 'Izin Pribadi' },
  { value: 'annual', label: 'Cuti' },
  { value: 'training', label: 'Training' },
  { value: 'organization', label: 'Kegiatan Organisasi' },
  { value: 'other', label: 'Lainnya' },
];

export const leaveTypeLabel = (value) => LEAVE_TYPES.find((t) => t.value === value)?.label || 'Izin';

export const STATUS_META = {
  pending: { label: 'Menunggu persetujuan', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Disetujui', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Ditolak', className: 'bg-red-50 text-red-700 border-red-200' },
};

// Izin yang disetujui lalu dibatalkan owner disimpan sebagai rejected + revoked_at.
export const requestStatusMeta = (req) => (req.revoked_at
  ? { label: 'Dibatalkan', className: 'bg-slate-100 text-slate-600 border-slate-300' }
  : (STATUS_META[req.status] || STATUS_META.pending));

export const hhmm = (t) => (t ? String(t).slice(0, 5) : '');

export const timeToMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = String(t).split(':');
  return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
};

export const formatDuration = (minutes) => {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${h} jam ${r} menit`;
  if (h) return `${h} jam`;
  return `${r} menit`;
};

// "Sabtu, 12 Oktober 2026" dari string 'yyyy-MM-dd'
export const formatLongDate = (dateStr) => {
  if (!dateStr) return '-';
  return format(parseISO(dateStr), 'EEEE, d MMMM yyyy', { locale: idLocale });
};

export const formatShortDate = (dateStr) => {
  if (!dateStr) return '-';
  return format(parseISO(dateStr), 'EEE, d MMM', { locale: idLocale });
};

export const leaveScopeLabel = (req) =>
  req.is_partial ? `${hhmm(req.start_time)} – ${hhmm(req.end_time)}` : 'Seharian penuh';

// Dampak izin ke hari masuk (gaji & hari kerja), untuk dijelaskan ke terapis dan owner.
export const attendanceImpactNote = (isPartial) => (isPartial
  ? 'Izin sebagian jam: hari izin ini tetap dihitung masuk (gaji & hari kerja). Tanggal pengganti hanya menambah jam kerja, tidak dihitung sebagai hari masuk lagi.'
  : 'Izin seharian: hari izin ini tidak dihitung masuk. Tanggal pengganti dihitung sebagai hari masuk (gaji & hari kerja).');

// Izin di hari Sabtu/Minggu (seharian maupun jam tertentu): hari pengganti hanya boleh hari Minggu.
export const isWeekendDate = (dateStr) => {
  if (!dateStr) return false;
  const dow = parseISO(dateStr).getDay();
  return dow === 0 || dow === 6;
};

export const isSundayDate = (dateStr) => !!dateStr && parseISO(dateStr).getDay() === 0;

export const WEEKEND_REPLACEMENT_NOTE = 'Izin di hari Sabtu/Minggu wajib diganti di hari Minggu. Hari lain tidak bisa dipilih.';

export const shiftMinutes = (shift) => Math.max(0, timeToMinutes(shift.end_time) - timeToMinutes(shift.start_time));

export const totalShiftMinutes = (shifts) => (shifts || []).reduce((sum, s) => sum + shiftMinutes(s), 0);

// Preset jam kerja shift (klinik dengan fitur izin terapis, mis. Kaffah).
export const WORK_SHIFT_PRESETS = [
  { name: 'Shift Pagi', start: '09:00', end: '17:00' },
  { name: 'Shift Siang', start: '13:00', end: '21:00' },
];

// Gabungkan preset dengan shift yang dipakai terapis klinik; jam yang sama dianggap satu shift.
export const buildShiftOptions = (therapists = []) => {
  const map = new Map();
  WORK_SHIFT_PRESETS.forEach((p) => map.set(`${p.start}-${p.end}`, { name: p.name, start: p.start, end: p.end }));
  therapists.forEach((t) => {
    if (!t.work_start_time || !t.work_end_time) return;
    const start = hhmm(t.work_start_time);
    const end = hhmm(t.work_end_time);
    const key = `${start}-${end}`;
    if (!map.has(key)) map.set(key, { name: t.work_shift_name || 'Shift', start, end });
  });
  return [...map.values()].sort((a, b) => a.start.localeCompare(b.start));
};
