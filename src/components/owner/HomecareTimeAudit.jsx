import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const PROBLEM_LABEL = {
  kosong: 'Belum dipilih',
  tidak_sesuai_shift: 'Tidak sesuai jadwal terapis',
  rekap_tidak_sinkron: 'Rekap belum sinkron',
};

const VALUE_LABEL = { dalam: 'Dalam jam kerja', luar: 'Luar jam kerja' };

// Peringatan sebelum menghitung gaji: homecare yang waktunya (dalam/luar jam kerja) kosong,
// tidak cocok dengan jadwal aktif terapis, atau rekapnya belum mengikuti. Kosong jika klinik
// tidak memakai SOAP-first atau semuanya sudah benar.
const HomecareTimeAudit = ({ startDate, endDate }) => {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!startDate || !endDate) { setRows([]); return undefined; }
    let cancelled = false;
    supabase.rpc('homecare_time_audit', { p_start: startDate, p_end: endDate })
      .then(({ data, error }) => { if (!cancelled) setRows(error ? [] : (data || [])); });
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  if (!rows.length) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
      <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        {rows.length} homecare perlu dicek sebelum hitung gaji
      </div>
      <p className="text-xs text-amber-700">
        Waktu homecare menentukan tipe pasien dan insentif. Perbaiki di appointment / rekap harian, lalu hitung ulang.
      </p>
      <ul className="text-xs text-amber-900 space-y-1 max-h-48 overflow-y-auto">
        {rows.map((r) => (
          <li key={r.appointment_id} className="flex flex-wrap gap-x-2">
            <span className="font-medium">{format(new Date(r.appt_at), 'EEE d MMM HH:mm', { locale: idLocale })}</span>
            <span>{r.therapist_name}</span>
            <span>· {r.patient_name || '-'}</span>
            <span className="font-semibold">
              · {PROBLEM_LABEL[r.problem] || r.problem}
              {r.problem === 'tidak_sesuai_shift' && ` (${VALUE_LABEL[r.current_value]} → seharusnya ${VALUE_LABEL[r.expected_value]})`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default HomecareTimeAudit;
