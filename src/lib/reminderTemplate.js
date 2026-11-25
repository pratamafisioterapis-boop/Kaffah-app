import { parseISO } from 'date-fns';
import { KAFFAH_CLINIC_ID } from '@/lib/clinicIds';

// Isi template WABA "reminder_terapi_konfirmasi" (disetujui Meta). Teks ini hanya
// untuk PRATINJAU di halaman Follow Up; yang dikirim ke pasien adalah template
// itu sendiri (send_follow_up_whatsapp), bukan teks dari message_content.
export const THERAPY_REMINDER_TEMPLATE_NAME = 'reminder_terapi_konfirmasi';

export const THERAPY_REMINDER_BUTTONS = ['Hadir', 'Reschedule', 'Cancel'];

const TEMPLATE_BODY = [
  'Selamat Pagi {{full_name}}',
  '',
  'Kami dari {{klinik}} ingin mengingatkan bahwa sesi fisioterapi Anda akan berlangsung hari ini pukul {{jam}}.',
  '',
  'Datang tepat waktu sangat membantu kami memberikan terapi dengan hasil yang maksimal 🙏',
  '⏰ Apabila keterlambatan lebih dari 15 menit, sesi terapi tetap berjalan namun waktunya akan menyesuaikan.',
  '',
  'Semoga perjalanannya lancar.',
  'Salam sehat,',
  '{{klinik}}',
  '',
  'Mohon konfirmasi dengan memilih salah satu tombol di bawah ini.'
].join('\n');

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

// Sama dengan send_follow_up_whatsapp(): pasien terdaftar -> nickname, full_name;
// tamu -> guest_name; terakhir "Kak". Nickname dan guest_name biasanya sudah
// memuat sapaan, jadi tidak ditambah sapaan lain.
export const getTherapyReminderName = (item) => {
  const patient = item?.patient || item?.patients || {};
  return (
    clean(patient.nickname) ||
    clean(patient.full_name) ||
    clean(item?.guest_name) ||
    'Kak'
  );
};

export const getTherapyReminderTime = (item) => {
  const date = item?.appointment_data?.appointment_date;
  if (date) {
    try {
      // Selalu WITA, sama dengan jam yang dikirim database (TO_CHAR di Asia/Makassar),
      // apa pun zona waktu browser staf.
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Makassar',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).formatToParts(parseISO(date));
      const hh = parts.find((p) => p.type === 'hour')?.value;
      const mm = parts.find((p) => p.type === 'minute')?.value;
      if (hh && mm) return `${hh}:${mm}`;
    } catch {
      /* lanjut ke cadangan */
    }
  }
  // Cadangan: ambil dari teks pesan lama ("... pukul 09:00").
  return item?.message_content?.match(/pukul\s+(\d{1,2}[:.]\d{2})/i)?.[1]?.replace('.', ':') || '';
};

// Template WABA (tombol Hadir/Reschedule/Cancel) hanya dipakai Kaffah. Klinik lain
// (mis. Praxis) mengirim teks pesannya sendiri lewat wa.me, jadi memakai message_content.
export const isTherapyReminder = (item) =>
  item?.follow_up_type === 'therapy_reminder' && item?.clinic_id === KAFFAH_CLINIC_ID;

// Pratinjau isi template untuk satu baris antrean reminder terapi.
// clinicName = nama klinik yang sedang login (tiap klinik punya template WABA sendiri).
export const getTherapyReminderPreview = (item, clinicName) =>
  TEMPLATE_BODY
    .replaceAll('{{klinik}}', clean(clinicName) || 'klinik kami')
    .replace('{{full_name}}', getTherapyReminderName(item))
    .replace('{{jam}}', getTherapyReminderTime(item) || '-');
