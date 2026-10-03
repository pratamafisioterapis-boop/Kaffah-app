import { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

// Setting per klinik (diatur Super Admin): format Assessment pada SOAP.
// 'icf' = perilaku lama (default), 'diagnosis' = Assessment berisi diagnosa.
export const useAssessmentMode = () => {
  const { userDetails } = useAuth();
  const clinicId = userDetails?.clinic_id;
  const [mode, setMode] = useState('icf');
  const [loaded, setLoaded] = useState(!clinicId);

  useEffect(() => {
    if (!clinicId) { setMode('icf'); setLoaded(true); return; }
    let active = true;
    supabase.from('clinics').select('assessment_mode').eq('id', clinicId).single()
      .then(({ data }) => {
        if (!active) return;
        setMode(data?.assessment_mode === 'diagnosis' ? 'diagnosis' : 'icf');
        setLoaded(true);
      });
    return () => { active = false; };
  }, [clinicId]);

  return { mode, loaded };
};
