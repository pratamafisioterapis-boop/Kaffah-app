import { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

// Setting per klinik (diatur Super Admin): siapa yang mengisi Medical Records.
// 'admin' = perilaku lama (default), 'therapist' = terapis yang mengisi.
export const useMedicalRecordsFilledBy = () => {
  const { userDetails } = useAuth();
  const clinicId = userDetails?.clinic_id;
  const [filledBy, setFilledBy] = useState('admin');
  const [loaded, setLoaded] = useState(!clinicId);

  useEffect(() => {
    if (!clinicId) { setFilledBy('admin'); setLoaded(true); return; }
    let active = true;
    supabase.from('clinics').select('medical_records_filled_by').eq('id', clinicId).single()
      .then(({ data }) => {
        if (!active) return;
        setFilledBy(data?.medical_records_filled_by === 'therapist' ? 'therapist' : 'admin');
        setLoaded(true);
      });
    return () => { active = false; };
  }, [clinicId]);

  return { filledBy, loaded };
};
