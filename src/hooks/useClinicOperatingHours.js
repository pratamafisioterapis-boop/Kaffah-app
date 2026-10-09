import { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

// Jam buka klinik per hari yang diatur owner di Settings (clinics.operating_hours).
// null = belum diatur, pemanggil memakai jam bawaan (lihat clinicHoursOn).
export const useClinicOperatingHours = (clinicId) => {
  const [hours, setHours] = useState(null);
  const [loaded, setLoaded] = useState(!clinicId);

  useEffect(() => {
    if (!clinicId) { setHours(null); setLoaded(true); return undefined; }
    let active = true;
    supabase.from('clinics').select('operating_hours').eq('id', clinicId).single()
      .then(({ data }) => {
        if (!active) return;
        setHours(data?.operating_hours || null);
        setLoaded(true);
      });
    return () => { active = false; };
  }, [clinicId]);

  return { hours, loaded };
};
