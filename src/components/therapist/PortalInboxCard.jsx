import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, ClipboardList, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { usePortalEnabled } from '@/hooks/usePortalEnabled';
import { fetchTherapistPatientIds } from '@/lib/portalScope';

// Ringkasan di dashboard terapis: chat dan keluhan baru dari aplikasi pasien (Clinara) untuk pasien terapis ini.
// Hanya tampil bila klinik mengaktifkan fitur Clinara pasien. Detail dan balasan ada di /therapist/clinara-pasien.
const PortalInboxCard = ({ therapistId }) => {
  const enabled = usePortalEnabled();
  const [counts, setCounts] = useState(null); // { messages, feedback }

  const load = useCallback(async () => {
    const scope = await fetchTherapistPatientIds(therapistId);
    if (!scope) return;
    const [m, f] = await Promise.all([
      supabase.from('patient_portal_messages').select('patient_id').eq('sender', 'patient').is('read_at', null).limit(1000),
      supabase.from('patient_portal_feedback').select('patient_id').eq('status', 'new').limit(500),
    ]);
    if (m.error || f.error) return;
    setCounts({
      messages: (m.data || []).filter((r) => scope.has(r.patient_id)).length,
      feedback: (f.data || []).filter((r) => scope.has(r.patient_id)).length,
    });
  }, [therapistId]);

  useEffect(() => {
    if (!enabled) return undefined;
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [enabled, load]);

  if (!enabled || !counts) return null;
  const total = counts.messages + counts.feedback;

  return (
    <Link to="/therapist/clinara-pasien" className="block h-full rounded-[18px] border border-app-border bg-white p-4 transition hover:-translate-y-0.5 hover:border-app-accent/40 lg:p-5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-extrabold text-app-ink">Pesan pasien</h3>
          <p className="text-sm text-slate-500">{total === 0 ? 'Tidak ada yang baru dari aplikasi pasien.' : 'Dari aplikasi pasien (Clinara). Ketuk untuk membalas.'}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${counts.messages ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
          <MessageCircle className="h-4 w-4" /> {counts.messages}
        </span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${counts.feedback ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
          <ClipboardList className="h-4 w-4" /> {counts.feedback}
        </span>
        <ChevronRight className="h-5 w-5 text-slate-400" />
      </div>
    </Link>
  );
};

export default PortalInboxCard;
