import { supabase } from '@/lib/customSupabaseClient';
import { format, differenceInYears } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { calculateDayNameIndonesia } from './whatsappService';

// Helper to get salutation
const getSalutation = (patient) => {
  if (patient.nickname) return patient.nickname;
  if (patient.gender === 'Laki-laki') return 'Pak';
  if (patient.gender === 'Perempuan') return 'Bu';
  return 'Kak';
};

// Helper to replace placeholders
const fillTemplate = (template, data) => {
  let message = template;
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`\\[${key}\\]`, 'gi');
    message = message.replace(regex, data[key] || '-');
  });
  return message;
};

// Fetch template from DB
const getTemplate = async (category) => {
  const { data } = await supabase
    .from('wa_templates')
    .select('template_text')
    .eq('category', category)
    .maybeSingle();
  return data?.template_text || '';
};

export const generateBookingMessage = async (patient, appointment) => {
  let template = await getTemplate('booking_appointment');
  if (!template) {
    // Fallback default
    template = "Halo [sapaan] [nama], booking appointment Anda pada hari [hari_booking], [tanggal] pukul [jam] dengan [terapis] untuk layanan [layanan] telah berhasil dibuat. Terima kasih.";
  }

  return fillTemplate(template, {
    sapaan: getSalutation(patient),
    nama: patient.full_name,
    tanggal: format(new Date(appointment.appointment_date), 'dd MMMM yyyy', { locale: idLocale }),
    jam: format(new Date(appointment.appointment_date), 'HH:mm'),
    hari_booking: calculateDayNameIndonesia(appointment.appointment_date),
    terapis: appointment.therapist?.name || 'Terapis Kami',
    layanan: 'Fisioterapi' // Or fetch service name if available
  });
};

export const generateBookingHomecareMessage = async (patient, appointment) => {
  let template = await getTemplate('booking_homecare');
  if (!template) {
    template = "Terima kasih sudah melakukan booking layanan homecare di Kaffah Physiotherapy 🤍\nJadwal [nickname] sudah tercatat untuk [hari_booking], [tanggal] pukul [jam] di lokasi yang telah disepakati.\n\nUntuk layanan homecare, pembayaran mohon dilakukan maksimal H-1 sebelum jadwal terapi melalui transfer ke:\na.n KAFFAH PHYSIOTHERAPY\nNo. Rek: 3030399993\n\nMohon melakukan pembayaran sebelum jadwal sesi berjalan sesuai waktu yang telah disepakati 🙏\n\nSalam sehat,\nKaffah Physiotherapy";
  }

  return fillTemplate(template, {
    sapaan: getSalutation(patient),
    nama: patient.full_name,
    nickname: patient.nickname || `Ka ${patient.full_name}`,
    tanggal: format(new Date(appointment.appointment_date), 'dd MMMM yyyy', { locale: idLocale }),
    jam: format(new Date(appointment.appointment_date), 'HH:mm'),
    hari_booking: calculateDayNameIndonesia(appointment.appointment_date),
    terapis: appointment.therapist?.name || 'Terapis Kami',
    layanan: 'Homecare',
  });
};

export const generateFollowUpMessage = async (patient, lastAppointment) => {
  let template = await getTemplate('follow_up');
  if (!template) {
     template = "Halo [sapaan] [nama], sudah beberapa hari sejak kunjungan terakhir Anda pada [tanggal_appointment_terakhir]. Bagaimana perkembangan kondisi Anda?";
  }

  return fillTemplate(template, {
    sapaan: getSalutation(patient),
    nama: patient.full_name,
    tanggal_appointment_terakhir: format(new Date(lastAppointment.appointment_date), 'dd MMMM yyyy', { locale: idLocale })
  });
};

export const generatePackageExpiryMessage = async (patient, pkg) => {
  let template = await getTemplate('package_expiry');
  if (!template) {
     template = "Halo [sapaan] [nama], paket [jenis_paket] Anda tersisa [sisa_sesi] sesi dan akan habis pada hari [hari_expiry], [tanggal_habis]. Segera jadwalkan sesi Anda.";
  }

  const expiryDate = pkg.extended_until || pkg.end_date;

  return fillTemplate(template, {
    sapaan: getSalutation(patient),
    nama: patient.full_name,
    jenis_paket: pkg.package_name,
    sisa_sesi: pkg.sessions_remaining,
    tanggal_habis: expiryDate ? format(new Date(expiryDate), 'dd MMMM yyyy', { locale: idLocale }) : 'segera',
    hari_expiry: expiryDate ? calculateDayNameIndonesia(expiryDate) : '-'
  });
};

// ─── Kirim pesan via Watzap API ───────────────────────────────────────────────
const sendViaWatzap = async (phone, message) => {
  const { data: wa } = await supabase
    .from('wa_settings')
    .select('api_key, number_key')
    .single();

  if (!wa?.api_key || !wa?.number_key) {
    console.warn('[Watzap] api_key / number_key tidak ditemukan di wa_settings');
    return { success: false };
  }

  let normalized = phone.replace(/\D/g, '');
  if (normalized.startsWith('0')) normalized = '62' + normalized.slice(1);
  else if (!normalized.startsWith('62')) normalized = '62' + normalized;

  const res = await fetch('https://api.watzap.id/v1/waba_send_message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: wa.api_key,
      number_key: wa.number_key,
      phone_no: normalized,
      message,
    }),
  });

  const result = await res.json();
  return result;
};

// ─── Therapy Reminder Homecare ────────────────────────────────────────────────
export const generateTherapyReminderHomecareMessage = (patient, appointment) => {
  const nickname = patient.nickname || `Ka ${patient.full_name}`;
  const jam = format(new Date(appointment.appointment_date), 'HH:mm');
  const hari = calculateDayNameIndonesia(appointment.appointment_date);
  const terapis = appointment.therapist?.name || 'Terapis Kami';

  return `Selamat Pagi ${nickname} 👋\nMengingatkan jadwal terapi homecare Anda *hari ini* (${hari}) pukul *${jam}*.\nTerapis kami *${terapis}* akan datang ke lokasi Anda sesuai alamat yang telah disepakati.\n\nSalam sehat,\nKaffah Physiotherapy`;
};

export const sendTherapyReminderHomecare = async (patient, appointment) => {
  const phone = patient.phone;
  if (!phone) return { success: false, error: 'Nomor telepon pasien tidak ada' };

  const message = generateTherapyReminderHomecareMessage(patient, appointment);
  return await sendViaWatzap(phone, message);
};

// ─────────────────────────────────────────────────────────────────────────────

export const generateTherapyReminderMessage = async (patient, appointment) => {
  let template = await getTemplate('therapy_reminder');
  if (!template) {
      template = "Halo [sapaan] [nama], mengingatkan jadwal terapi Anda hari ini ([hari_booking]) pukul [jam_terapi] dengan [terapis] di [lokasi]. Sampai jumpa!";
  }

  return fillTemplate(template, {
    sapaan: getSalutation(patient),
    nama: patient.full_name,
    jam_terapi: format(new Date(appointment.appointment_date), 'HH:mm'),
    hari_booking: calculateDayNameIndonesia(appointment.appointment_date),
    terapis: appointment.therapist?.name || 'Terapis',
    lokasi: 'Klinik Kaffah Care'
  });
};

export const generateBirthdayMessage = async (patient) => {
  let template = await getTemplate('birthday');
  if (!template) {
      template = "Selamat Ulang Tahun [sapaan] [nama] yang ke-[umur_baru]! Semoga sehat selalu dan panjang umur.";
  }

  const age = patient.date_of_birth ? differenceInYears(new Date(), new Date(patient.date_of_birth)) : 0;

  return fillTemplate(template, {
    sapaan: getSalutation(patient),
    nama: patient.full_name,
    umur_baru: age
  });
};