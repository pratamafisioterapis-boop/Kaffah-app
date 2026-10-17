import { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

// True bila Super Admin mengaktifkan fitur "Link Clinara ke pasien" untuk klinik pengguna.
// Selama kolom/skemanya belum ada (atau fitur mati), hasilnya false dan tombolnya tidak tampil.
export const usePortalEnabled = () => {
  const { userDetails } = useAuth();
  const clinicId = userDetails?.clinic_id;
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!clinicId) { setEnabled(false); return undefined; }
    let alive = true;
    supabase.from('clinics').select('patient_portal_enabled').eq('id', clinicId).maybeSingle()
      .then(({ data }) => { if (alive) setEnabled(data?.patient_portal_enabled === true); });
    return () => { alive = false; };
  }, [clinicId]);

  return enabled;
};
