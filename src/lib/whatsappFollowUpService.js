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