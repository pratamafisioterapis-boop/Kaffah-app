import { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

// Setting per klinik (diatur Super Admin): terapis boleh mengajukan perubahan
// template SOAP (harus disetujui owner). Default mati.
export const useTherapistSoapTemplateEdit = () => {
  const { userDetails } = useAuth();
  const clinicId = userDetails?.clinic_id;
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(!clinicId);

  useEffect(() => {
    if (!clinicId) { setEnabled(false); setLoaded(true); return; }
    let active = true;
    supabase.from('clinics').select('therapist_soap_template_edit_enabled').eq('id', clinicId).single()
      .then(({ data }) => {
        if (!active) return;
        setEnabled(data?.therapist_soap_template_edit_enabled === true);
        setLoaded(true);
      });
    return () => { active = false; };
  }, [clinicId]);

  return { enabled, loaded };
};
