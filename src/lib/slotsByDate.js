// RPC get_available_slots_with_status_by_date adalah query DB terberat
// (±65 rb panggilan di produksi). Widget dashboard yang menampilkan angka
// ringkasan boleh memakai hasil sampai 30 detik lalu, dan permintaan serentak
// untuk tanggal+klinik yang sama digabung. JANGAN dipakai untuk grid booking /
// form appointment yang harus real-time (tetap panggil supabase.rpc langsung).
import { supabase } from '@/lib/customSupabaseClient';

const TTL_MS = 30_000;
const cache = new Map(); // key -> { at, promise }

export const fetchSlotsByDateCached = (date, clinicId) => {
  const key = `${date}|${clinicId || ''}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const promise = supabase
    .rpc('get_available_slots_with_status_by_date', { p_date: date, p_clinic_id: clinicId })
    .then((res) => {
      if (res.error) cache.delete(key); // jangan cache kegagalan
      return res;
    }, (err) => { cache.delete(key); throw err; });
  cache.set(key, { at: Date.now(), promise });
  return promise;
};

export const clearSlotsByDateCache = () => cache.clear();
