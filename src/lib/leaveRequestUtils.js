import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

export const LEAVE_TYPES = [
  { value: 'sick', label: 'Sakit' },
  { value: 'personal', label: 'Izin Pribadi' },
  { value: 'annual', label: 'Cuti' },
  { value: 'training', label: 'Training' },
  { value: 'other', label: 'Lainnya' },
];

export const leaveTypeLabel = (value) => LEAVE_TYPES.find((t) => t.value === value)?.label || 'Izin';

export const STATUS_META = {
  pending: { label: 'Menunggu persetujuan', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Disetujui', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Ditolak', className: 'bg-red-50 text-red-700 border-red-200' },
};

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

export const shiftMinutes = (shift) => Math.max(0, timeToMinutes(shift.end_time) - timeToMinutes(shift.start_time));

export const totalShiftMinutes = (shifts) => (shifts || []).reduce((sum, s) => sum + shiftMinutes(s), 0);
