import { supabase } from '@/lib/customSupabaseClient';
import { generateFollowUpQueue, getFollowUpQueue, sendFollowUpWhatsApp } from '@/lib/api';
import { format } from 'date-fns';

// ─── Konstanta Toleransi Waktu ────────────────────────────────────────────────
// Cron bisa terlambat beberapa menit, jadi beri toleransi ±5 menit
const TIME_TOLERANCE_MINUTES = 5;

/**
 * Cek apakah jam sekarang cocok dengan jam config (dengan toleransi)
 * @param {string} configTime - format "HH:mm", misal "09:00"
 * @returns {boolean}
 */
const isTimeMatch = (configTime) => {
  if (!configTime) return false;

  const now = new Date();
  const [configHour, configMinute] = configTime.split(':').map(Number);

  const configDate = new Date();
  configDate.setHours(configHour, configMinute, 0, 0);

  const diffMinutes = Math.abs((now - configDate) / 1000 / 60);
  return diffMinutes <= TIME_TOLERANCE_MINUTES;
};

/**
 * Fetch semua config WA yang aktif dari database
 * @returns {Promise<Array>}
 */
const getActiveConfigs = async () => {
  const { data, error } = await supabase
    .from('wa_schedule_config')
    .select('*')
    .eq('is_enabled', true);

  if (error) {
    console.error('[Scheduler] Gagal fetch config:', error);
    return [];
  }

  return data || [];
};

/**
 * Tentukan apakah kategori ini perlu dijalankan sekarang berdasarkan config-nya
 * @param {object} config - row dari wa_schedule_config
 * @returns {boolean}
 */
const shouldRunNow = (config) => {
  const { timing_type, timing_value } = config;

  switch (timing_type) {
    case 'immediate':
      // Selalu jalankan (booking confirmation, dll)
      return true;

    case 'custom_time': {
      // Jalankan hanya kalau jam sekarang cocok dengan timing_value.time
      const scheduledTime = timing_value?.time;
      const match = isTimeMatch(scheduledTime);
      if (!match) {
        console.log(
          `[Scheduler] "${config.category}" dijadwalkan jam ${scheduledTime}, sekarang ${format(new Date(), 'HH:mm')} — SKIP`
        );
      }
      return match;
    }

    case 'custom_days': {
      // Untuk follow_up: timing_value.days (kirim N hari setelah kunjungan)
      // Untuk expiry: timing_value.days_before (array, [7, 3, 1])
      // Logic pengecekan hari dilakukan di generateFollowUpQueue di backend
      // Di sini cukup pastikan ini bukan jam aneh (idealnya pagi hari)
      const scheduledTime = timing_value?.time || '08:00'; // default pagi
      return isTimeMatch(scheduledTime);
    }

    case 'multiple': {
      // Sama dengan custom_days tapi bisa multi-hari
      const scheduledTime = timing_value?.time || '08:00';
      return isTimeMatch(scheduledTime);
    }

    default:
      return false;
  }
};

/**
 * Trigger daily generation jobs — sekarang respek config dari DB
 * Dipanggil oleh Cron Job setiap 5-10 menit (atau setiap jam)
 */
export const runDailyWhatsAppAutomation = async () => {
  console.log(`🔄 [Scheduler] Running WhatsApp Automation check — ${format(new Date(), 'dd/MM/yyyy HH:mm')}`);

  const configs = await getActiveConfigs();

  if (configs.length === 0) {
    console.log('📭 [Scheduler] Tidak ada kategori WA yang aktif.');
    return { success: true, ran: [] };
  }

  const results = [];

  for (const config of configs) {
    const run = shouldRunNow(config);

    if (!run) {
      // Sudah di-log di shouldRunNow, skip
      continue;
    }

    console.log(`🚀 [Scheduler] Menjalankan kategori: "${config.category}"`);

    try {
      await generateFollowUpQueue(config.category);
      results.push({ category: config.category, status: 'success' });
      console.log(`✅ [Scheduler] "${config.category}" selesai.`);
    } catch (error) {
      console.error(`❌ [Scheduler] "${config.category}" gagal:`, error);
      results.push({ category: config.category, status: 'failed', error: error.message });
    }
  }

  console.log(`✅ [Scheduler] Selesai. Kategori yang dijalankan: ${results.length}`);
  return { success: true, ran: results };
};

/**
 * Process Pending Queue — kirim pesan yang sudah jatuh tempo
 * Dipanggil terpisah, bisa setiap menit oleh Cron
 */
export const processPendingQueue = async () => {
  console.log('📨 [Scheduler] Processing Pending WhatsApp Queue...');

  try {
    const allowedTypes = [
  'reschedule_appointment',
  'therapy_reminder',
  'reminder_therapist_h10',
  'cancel_appointment',
  'booking_appointment',
  'booking_appointment_therapist'
];

const { data: queue } = await getFollowUpQueue('pending');

const filteredQueue = (queue || []).filter(item =>
  allowedTypes.includes(item.follow_up_type)
);

    if (!queue || queue.length === 0) {
      console.log('📭 [Scheduler] Tidak ada pesan pending.');
      return;
    }

    const now = new Date();

    // Filter item yang sudah jatuh tempo
    const dueItems = queue.filter(item => {
      const scheduled = new Date(`${item.scheduled_date}T${item.scheduled_time || '00:00:00'}`);
      return scheduled <= now;
    });

    if (dueItems.length === 0) {
      console.log(`📭 [Scheduler] ${queue.length} pesan pending tapi belum jatuh tempo.`);
      return;
    }

    console.log(`🚀 [Scheduler] Mengirim ${dueItems.length} pesan...`);

    for (const item of dueItems) {
      try {
        await sendFollowUpWhatsApp(item.id);
        console.log(`✅ Terkirim: ${item.id} → ${item.phone_number}`);
      } catch (err) {
        console.error(`❌ Gagal kirim item ${item.id}:`, err);
      }
    }

    console.log('✅ [Scheduler] Queue Processing Complete');
  } catch (error) {
    console.error('❌ [Scheduler] Queue Processing Failed:', error);
  }
};