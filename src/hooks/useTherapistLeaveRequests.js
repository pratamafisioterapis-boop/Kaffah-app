import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { getLeaveRequests } from '@/lib/api';

// Setting per klinik (diatur Super Admin): terapis boleh mengajukan izin
// yang harus disetujui owner / terapis kepala. Default mati.
export const useTherapistLeaveRequestEnabled = () => {
  const { userDetails } = useAuth();
  const clinicId = userDetails?.clinic_id;
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(!clinicId);

  useEffect(() => {
    if (!clinicId) { setEnabled(false); setLoaded(true); return; }
    let active = true;
    supabase.from('clinics').select('therapist_leave_request_enabled').eq('id', clinicId).single()
      .then(({ data }) => {
        if (!active) return;
        setEnabled(data?.therapist_leave_request_enabled === true);
        setLoaded(true);
      });
    return () => { active = false; };
  }, [clinicId]);

  return { enabled, loaded };
};

// Jumlah pengajuan izin berstatus pending (untuk badge). Hanya bermakna bagi
// peninjau; RLS membatasi baris untuk peran lain.
export const usePendingLeaveRequestCount = (active = true) => {
  const [count, setCount] = useState(0);
  const refresh = useCallback(async () => {
    if (!active) { setCount(0); return; }
    const { data } = await getLeaveRequests({ status: 'pending' });
    setCount(data.length);
  }, [active]);
  useEffect(() => { refresh(); }, [refresh]);
  return { count, refresh };
};
