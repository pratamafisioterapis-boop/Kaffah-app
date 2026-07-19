import { format, isSameDay } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { calculateDayNameIndonesia } from './whatsappService';

// Batas maksimal jam yang ditampilkan ke pasien.
// Kalau jam kosong sebenarnya lebih banyak dari ini, kita cuma tampilkan
// sebagian yang disebar (pagi/siang/sore) supaya tidak kelihatan sepi.
const MAX_SHOWN_SLOTS = 4;

// Jangan tawarkan jam kosong yang sudah/hampir lewat — hanya berlaku kalau
// `date` yang diminta adalah hari ini.
const MIN_LEAD_MINUTES = 20;

const filterByLeadTime = (slots, date) => {
  if (!date) return slots;
  const now = new Date();
  const target = new Date(date);
  if (!isSameDay(target, now)) return slots;

  return slots.filter(s => {
    const [h, m] = (s.slot_start_time || '').split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return true;
    const slotDateTime = new Date(target);
    slotDateTime.setHours(h, m, 0, 0);
    return (slotDateTime.getTime() - now.getTime()) >= MIN_LEAD_MINUTES * 60 * 1000;
  });
};

const pickSpreadSlots = (slots, max) => {
  if (slots.length <= max) return slots;

  const step = (slots.length - 1) / (max - 1);
  const pickedIdx = new Set();
  for (let i = 0; i < max; i++) {
    pickedIdx.add(Math.round(i * step));
  }

  return [...pickedIdx]
    .sort((a, b) => a - b)
    .map(idx => slots[idx]);
};

// ─── MODE: PER TERAPIS ─────────────────────────────────────────────────────

export const getTherapistSlotSummary = (allSlots = [], maxShown = MAX_SHOWN_SLOTS, date = null) => {
  const available = filterByLeadTime(
    allSlots
      .filter(s => s.status === 'aktif')
      .sort((a, b) => a.slot_start_time.localeCompare(b.slot_start_time)),
    date
  );

  if (available.length === 0) return null;

  const shown = pickSpreadSlots(available, maxShown);

  return {
    totalAvailable: available.length,
    shownSlots: shown,
    isTruncated: available.length > shown.length
  };
};

export const generateBookingAvailabilityMessage = ({ clinicName, date, therapistSummaries }) => {
  const hari = calculateDayNameIndonesia(date);
  const tanggal = format(new Date(date), 'dd MMMM yyyy', { locale: idLocale });

  const activeSummaries = therapistSummaries.filter(t => t.summary);

  if (activeSummaries.length === 0) {
    return `Mohon maaf, untuk hari ${hari}, ${tanggal} jadwal kami sudah penuh 🙏\nBoleh infokan tanggal lain, nanti kami carikan jadwal terbaik untuk Anda.`;
  }

  let body = `Berikut jadwal yang tersedia untuk hari ${hari}, ${tanggal}:\n\n`;

  activeSummaries.forEach(({ name, summary }) => {
    body += `*${name}*\n`;
    body += summary.shownSlots
      .map(s => `🕒 ${s.slot_start_time.slice(0, 5)}`)
      .join('\n');
    body += '\n\n';
  });

  body += `\n${clinicName || ''}`;

  return body.trim();
};

// ─── MODE: GLOBAL (TANPA NAMA TERAPIS) ─────────────────────────────────────

export const getGlobalSlotSummary = (allSlotLists = [], maxShown = MAX_SHOWN_SLOTS, date = null) => {
  const uniqueTimes = new Set();

  allSlotLists.forEach(slots => {
    filterByLeadTime(slots.filter(s => s.status === 'aktif'), date)
      .forEach(s => uniqueTimes.add(s.slot_start_time));
  });

  const sortedTimes = [...uniqueTimes].sort();

  if (sortedTimes.length === 0) return null;

  const asObjects = sortedTimes.map(t => ({ slot_start_time: t }));
  const shown = pickSpreadSlots(asObjects, maxShown);

  return {
    totalAvailable: sortedTimes.length,
    shownSlots: shown,
    isTruncated: sortedTimes.length > shown.length
  };
};

export const generateGlobalAvailabilityMessage = ({ clinicName, date, globalSummary }) => {
  const hari = calculateDayNameIndonesia(date);
  const tanggal = format(new Date(date), 'dd MMMM yyyy', { locale: idLocale });

  if (!globalSummary) {
    return `Mohon maaf, untuk hari ${hari}, ${tanggal} jadwal kami sudah penuh 🙏\nBoleh infokan tanggal lain, nanti kami carikan jadwal terbaik untuk Anda.`;
  }

  let body = `Berikut jadwal yang tersedia untuk hari ${hari}, ${tanggal}:\n\n`;

  body += globalSummary.shownSlots
    .map(s => `🕒 ${s.slot_start_time.slice(0, 5)}`)
    .join('\n');

  body += `\n\n${clinicName || ''}`;

  return body.trim();
};