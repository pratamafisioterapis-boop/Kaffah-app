import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSoapFirstSettings } from '@/hooks/useSoapFirst';
import { isSoapFirstActiveOn, todayWita } from '@/lib/soapFirst';

const fmt = (v) => {
  try { return new Date(v).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' }); } catch { return '-'; }
};

/**
 * Pencocokan harian: sesi yang sudah lewat tetapi belum punya invoice (belum direkap/ditagih).
 * Untuk klinik dengan alur SOAP sebelum pembayaran; melengkapi kartu "Missing Recaps".
 */
const UnpaidSessionsCard = ({ days = 7 }) => {
  const { settings } = useSoapFirstSettings();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const today = todayWita();
  const active = !!settings?.enabled;

  const load = useCallback(async () => {
    if (!active) { setItems([]); return; }
    setLoading(true);
    try {
      const from = new Date(Date.now() + 8 * 3600 * 1000 - days * 86400000).toISOString().slice(0, 10);
      const startDate = from < settings.start_date ? settings.start_date : from;
      const { data } = await supabase
        .from('daily_recaps')
        .select('id, recap_date, full_name, guest_name, therapist_name, payment_method, invoice_created_at, package_tracking_id, amount_original, amount, soap_completed_at, appointment:appointments!appointment_id(appointment_date, duration_minutes, status)')
        .gte('recap_date', startDate)
        .lte('recap_date', today)
        .order('recap_date', { ascending: false })
        .limit(300);
      const now = Date.now();
      const list = (data || []).filter((r) => {
        const a = r.appointment;
        if (!a || !['confirmed', 'rescheduled'].includes(a.status)) return false;
        if (new Date(a.appointment_date).getTime() + (a.duration_minutes || 0) * 60000 > now) return false;
        const isFollowup = !!r.package_tracking_id && !(Number(r.amount_original ?? r.amount ?? 0) > 0);
        if (isFollowup) return false;
        const paid = !!r.invoice_created_at || (r.payment_method && r.payment_method !== 'Package' && Number(r.amount) > 0);
        return !paid;
      });
      setItems(list);
    } finally {
      setLoading(false);
    }
  }, [active, days, settings, today]);

  useEffect(() => { load(); }, [load]);

  if (!active || (items.length === 0 && !loading)) return null;

  return (
    <div className="rounded-app-lg border border-orange-300 bg-orange-50 p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-orange-900">
        <AlertCircle className="h-4 w-4" />
        {items.length} sesi sudah lewat tetapi belum ada invoice
        <button type="button" onClick={load} aria-label="Muat ulang" className="ml-auto text-orange-700"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>
      <div className="max-h-56 overflow-y-auto space-y-1">
        {items.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-app-sm bg-white px-3 py-2 text-sm border border-orange-200">
            <span className="font-medium text-slate-800">{r.full_name || r.guest_name || 'Pasien'}</span>
            <span className="text-xs text-slate-500">
              {fmt(r.appointment.appointment_date)} · {r.therapist_name || '-'} · {r.soap_completed_at ? 'SOAP selesai' : 'SOAP belum'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UnpaidSessionsCard;
