// Satu sumber data baris klinik untuk komponen yang tampil bersamaan saat dashboard dibuka
// (AuthContext: nama klinik, ThemeContext: design_style, DashboardLayout: logo + fitur).
// Sebelumnya masing-masing memanggil `clinics` dengan kolom berbeda, sehingga URL-nya
// berbeda dan dedupeFetch tidak bisa menggabungkannya (5 panggilan per muat dashboard).
// Permintaan serentak untuk klinik yang sama digabung, hasilnya dipakai ulang 3 detik.
import { supabase } from '@/lib/customSupabaseClient';

const COLUMNS =
  'name, logo_url, stamp_url, address, phone, design_style, disabled_features_by_role, patient_portal_enabled';
const TTL_MS = 3000;
const cache = new Map(); // clinicId -> { at, promise }

export const fetchClinicRow = (clinicId) => {
  const hit = cache.get(clinicId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const promise = Promise.resolve(
    supabase.from('clinics').select(COLUMNS).eq('id', clinicId).single()
  ).then(
    (res) => {
      if (res.error) cache.delete(clinicId); // jangan simpan kegagalan
      return res;
    },
    (err) => { cache.delete(clinicId); throw err; }
  );
  cache.set(clinicId, { at: Date.now(), promise });
  return promise;
};

export const invalidateClinicRow = (clinicId) => {
  if (clinicId) cache.delete(clinicId); else cache.clear();
};
