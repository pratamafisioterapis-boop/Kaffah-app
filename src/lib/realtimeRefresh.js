import { getKnownClinicId, invalidateSlotsCache } from '@/lib/api';

// Handler untuk supabase `postgres_changes`: perubahan datang dari SEMUA klinik
// (tabel dipakai bersama), jadi abaikan baris klinik lain, gabungkan beruntun
// dalam satu jeda, dan buang cache slot sebelum memuat ulang.
// Event DELETE tidak membawa clinic_id, jadi tetap dianggap relevan.
export const createRealtimeRefresh = (refresh, delay = 1500) => {
  let timer;
  const handler = (payload) => {
    const rowClinic = payload?.new?.clinic_id;
    const myClinic = getKnownClinicId();
    if (rowClinic && myClinic && rowClinic !== myClinic) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      invalidateSlotsCache();
      refresh();
    }, delay);
  };
  handler.cancel = () => clearTimeout(timer);
  return handler;
};
