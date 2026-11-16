import React, { useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { KAFFAH_CLINIC_ID } from '@/lib/clinicIds';
import { computeWorkload, fetchRecapsForWorkload } from '@/lib/therapistWorkload';

// Catatan kecil di halaman booking (khusus Kaffah): terapis dengan kunjungan
// paling sedikit bulan ini, sebagai petunjuk saat membagi pasien baru.
const WorkloadHint = () => {
  const { userDetails } = useAuth();
  const clinicId = userDetails?.clinic_id;
  const [low, setLow] = useState(null);

  useEffect(() => {
    if (clinicId !== KAFFAH_CLINIC_ID) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
        const end = format(new Date(), 'yyyy-MM-dd');
        const [recaps, { data: thr }] = await Promise.all([
          fetchRecapsForWorkload(supabase, clinicId, start, end),
          supabase.from('physiotherapists').select('id, name, is_active').eq('clinic_id', clinicId),
        ]);
        if (cancelled) return;
        const w = computeWorkload(recaps, thr || []);
        const names = w.rows
          .filter((r) => r.status === 'low' || r.status === 'low_alert')
          .slice(-2).reverse()
          .map((r) => r.name.split(',')[0].trim());
        setLow(names);
      } catch { /* petunjuk opsional, abaikan error */ }
    })();
    return () => { cancelled = true; };
  }, [clinicId]);

  if (!low || low.length === 0) return null;
  return (
    <div className="flex items-start gap-2 rounded-app-sm border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
      <Scale className="mt-0.5 h-4 w-4 shrink-0" />
      <span>Pemerataan bulan ini: <b>{low.join(', ')}</b> kunjungannya masih di bawah rata-rata tim. Prioritaskan untuk pasien baru bila jadwalnya cocok.</span>
    </div>
  );
};

export default WorkloadHint;
