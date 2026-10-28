import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

// Cek jadwal aktif terapis (override > jadwal mingguan + extra shift) untuk jam appointment.
// Hanya petunjuk: pilihan dalam/luar jam kerja tetap harus dipilih admin.
export const useHomecareShift = (therapistId, appointmentISO, enabled) => {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!enabled || !therapistId || !appointmentISO) { setInfo(null); return undefined; }
    let cancelled = false;
    supabase.rpc('homecare_shift_check', { p_therapist_id: therapistId, p_at: appointmentISO })
      .then(({ data, error }) => { if (!cancelled) setInfo(error ? null : data); });
    return () => { cancelled = true; };
  }, [therapistId, appointmentISO, enabled]);

  return info;
};

const hhmm = (t) => (t ? String(t).substring(0, 5) : null);

export const homecareExpected = (info) => (info ? (info.inside ? 'dalam' : 'luar') : null);

const HomecareShiftHint = ({ info, value }) => {
  if (!info) return null;
  const expected = homecareExpected(info);
  const window = info.start && info.end ? `${hhmm(info.start)}–${hhmm(info.end)}` : null;
  const mismatch = value && value !== expected;

  return (
    <div className="space-y-0.5">
      <p className="text-[11px] text-slate-500">
        {window ? `Jadwal aktif terapis hari itu ${window}. ` : 'Terapis tidak punya jadwal aktif hari itu. '}
        Jam ini {info.inside ? 'di dalam' : 'di luar'} jadwal.
      </p>
      {mismatch && (
        <p className="text-[11px] font-semibold text-red-600">
          Pilihan tidak sesuai jadwal terapis (seharusnya {expected === 'dalam' ? 'Dalam' : 'Luar'} jam kerja). Periksa kembali.
        </p>
      )}
    </div>
  );
};

export default HomecareShiftHint;
