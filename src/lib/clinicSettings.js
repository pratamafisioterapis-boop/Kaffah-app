import { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

// Pengaturan per klinik (tabel clinic_settings, diubah lewat tiket CS Clinara).
// Satu fetch per klinik dibagi untuk semua pemakai hook; gagal/kosong = nilai bawaan.
const cache = new Map(); // clinicId -> Promise<Record<string, any>>

const load = (clinicId) => {
  if (!cache.has(clinicId)) {
    cache.set(
      clinicId,
      supabase
        .from('clinic_settings')
        .select('key, value')
        .eq('clinic_id', clinicId)
        .then(({ data }) => Object.fromEntries((data || []).map((r) => [r.key, r.value])))
        .catch(() => ({})),
    );
  }
  return cache.get(clinicId);
};

export const useClinicSetting = (key, fallback = null) => {
  const { userDetails } = useAuth();
  const clinicId = userDetails?.clinic_id;
  const [value, setValue] = useState(fallback);

  useEffect(() => {
    let active = true;
    if (!clinicId) return undefined;
    load(clinicId).then((s) => { if (active && s[key] !== undefined) setValue(s[key]); });
    return () => { active = false; };
  }, [clinicId, key]);

  return value;
};
