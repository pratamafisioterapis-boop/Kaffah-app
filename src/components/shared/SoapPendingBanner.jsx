import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSoapFirstSettings } from '@/hooks/useSoapFirst';
import { isSoapFirstActiveOn, todayWita } from '@/lib/soapFirst';
import { visibleInterval } from '@/lib/visibleInterval';

const fmtClock = (v) => {
  try { return new Date(v).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' }); } catch { return '-'; }
};

/**
 * Daftar sesi hari ini yang SOAP-nya belum diisi (klinik dengan alur SOAP sebelum pembayaran).
 * Terapis: sesi miliknya. Admin: semua terapis, supaya bisa mengingatkan.
 */
const SoapPendingBanner = ({ therapistId = null, role = 'therapist' }) => {
  const { settings } = useSoapFirstSettings();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const today = todayWita();
  const active = isSoapFirstActiveOn(settings, today);

  const load = useCallback(async () => {
    if (!active) { setItems([]); return; }
    let q = supabase
      .from('daily_recaps')
      .select('id, patient_id, actual_patient_id, full_name, guest_name, therapist_name, therapist_id, actual_patients:patients!actual_patient_id(full_name), appointment:appointments!appointment_id(appointment_date, duration_minutes, status)')
      .eq('recap_date', today)
      .is('soap_completed_at', null);
    if (therapistId) q = q.eq('therapist_id', therapistId);
    const { data } = await q.limit(100);
    const now = Date.now();
    const list = (data || [])
      .filter((r) => r.appointment && ['confirmed', 'rescheduled'].includes(r.appointment.status) && new Date(r.appointment.appointment_date).getTime() <= now)
      .sort((a, b) => new Date(a.appointment.appointment_date) - new Date(b.appointment.appointment_date));
    setItems(list);
  }, [active, today, therapistId]);

  useEffect(() => {
    load();
    if (!active) return undefined;
    return visibleInterval(load, 60000);
  }, [load, active]);

  if (!active || items.length === 0) return null;

  return (
    <div className="space-y-2 rounded-[16px] border border-[#F2A93B]/45 bg-[#FDF0D8] p-3.5">
      <div className="flex items-center gap-2.5 text-sm font-bold text-[#10242F]">
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#F2A93B] text-[#3A2504]"><AlertTriangle className="h-[18px] w-[18px]" /></span>
        {role === 'admin'
          ? `${items.length} sesi hari ini belum ada SOAP — pembayaran terkunci. Mohon ingatkan terapis.`
          : `${items.length} SOAP menunggu diisi — isi sebelum pasien membayar.`}
      </div>
      <div className="space-y-1">
        {items.map((r) => {
          // Sesi yang memakai paket orang lain: patient_id = pemilik paket, actual_patient_id = pasien
          // yang benar-benar diterapi. Tampilkan dan buka SOAP atas nama pasien sebenarnya.
          const name = r.actual_patients?.full_name || r.full_name || r.guest_name || 'Pasien';
          const soapPatientId = r.actual_patient_id || r.patient_id;
          const canOpen = role === 'therapist' && soapPatientId;
          return (
            <button
              key={r.id}
              type="button"
              disabled={!canOpen}
              onClick={() => canOpen && navigate(`/therapist/records/new/${soapPatientId}?date=${today}&dailyRecapId=${r.id}`)}
              className={`w-full flex items-center justify-between rounded-xl bg-white px-3 py-2 text-left text-sm border border-[#F2A93B]/40 ${canOpen ? 'hover:bg-[#FDF0D8]' : 'cursor-default'}`}
            >
              <span className="font-medium text-slate-800">{name}</span>
              <span className="text-xs text-slate-500">
                {fmtClock(r.appointment.appointment_date)}{role === 'admin' ? ` · ${r.therapist_name || '-'}` : ''}{canOpen ? ' · Isi SOAP' : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SoapPendingBanner;
