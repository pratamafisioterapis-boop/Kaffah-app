import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, CalendarClock, XCircle, HelpCircle, RefreshCcw } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { getCachedClinicId } from '@/lib/api';

const todayWITA = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());

const formatJamWITA = (iso) => {
  if (!iso) return '--:--';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(iso)).replace('.', ':');
  } catch {
    return '--:--';
  }
};

const STATS = [
  { key: 'hadir', label: 'Hadir', icon: CheckCircle2, color: 'bg-emerald-500' },
  { key: 'reschedule', label: 'Reschedule', icon: CalendarClock, color: 'bg-amber-500' },
  { key: 'cancel', label: 'Cancel', icon: XCircle, color: 'bg-red-500' },
  { key: 'none', label: 'Tanpa Konfirmasi', icon: HelpCircle, color: 'bg-slate-500', clickable: true },
];

/**
 * Ringkasan balasan tombol pasien pada reminder terapi hari ini
 * (Hadir / Reschedule / Cancel / Tanpa konfirmasi). Dipakai di dashboard
 * admin dan owner. "Tanpa konfirmasi" bisa diklik untuk melihat daftar pasien.
 */
const ReminderConfirmationWidget = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const clinicId = await getCachedClinicId(sessionData?.session?.user?.id);
      if (!clinicId) { setRows([]); return; }

      const { data: queue, error: qErr } = await supabase
        .from('follow_up_queue')
        .select('id, patient_reply, source_id, source_table, guest_name, patient:patients(full_name, nickname)')
        .eq('clinic_id', clinicId)
        .eq('follow_up_type', 'therapy_reminder')
        .in('status', ['completed', 'sent'])
        .eq('scheduled_date', todayWITA());
      if (qErr) throw qErr;

      const apptIds = [...new Set((queue || [])
        .filter((q) => q.source_table === 'appointments' && q.source_id)
        .map((q) => q.source_id))];
      let apptMap = {};
      if (apptIds.length) {
        const { data: appts, error: aErr } = await supabase
          .from('appointments')
          .select('id, appointment_date, guest_name')
          .in('id', apptIds);
        if (aErr) throw aErr;
        apptMap = Object.fromEntries((appts || []).map((a) => [a.id, a]));
      }

      setRows((queue || []).map((q) => {
        const appt = apptMap[q.source_id];
        return {
          id: q.id,
          reply: q.patient_reply || 'none',
          name: q.patient?.full_name || q.guest_name || appt?.guest_name || q.patient?.nickname || 'Pasien',
          time: appt?.appointment_date || null,
        };
      }));
    } catch (err) {
      console.error('Error loading reminder confirmations:', err);
      setError('Gagal memuat status konfirmasi reminder');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c = { hadir: 0, reschedule: 0, cancel: 0, none: 0 };
    rows.forEach((r) => { c[r.reply] = (c[r.reply] || 0) + 1; });
    return c;
  }, [rows]);

  const unconfirmed = useMemo(
    () => rows.filter((r) => r.reply === 'none')
      .sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    [rows]
  );

  if (error) {
    return (
      <Card className="bg-red-50 border-red-200">
        <CardContent className="flex items-center justify-between p-4">
          <span className="text-sm font-medium text-red-700">{error}</span>
          <button type="button" onClick={load} className="flex items-center text-sm text-red-700 hover:underline">
            <RefreshCcw className="h-3 w-3 mr-2" />Coba lagi
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-slate-800 tracking-tight">Konfirmasi Reminder Hari Ini</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STATS.map(({ key, label, icon: Icon, color, clickable }) => {
          const body = (
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0 text-left">
                <div className="text-sm font-medium text-slate-600">{label}</div>
                {loading ? (
                  <div className="h-8 w-12 bg-slate-100 animate-pulse rounded mt-1" />
                ) : (
                  <div className="text-2xl font-bold text-slate-900">{counts[key].toLocaleString('id-ID')}</div>
                )}
                {clickable && !loading && counts[key] > 0 && (
                  <div className="text-xs text-blue-600 mt-0.5">Lihat daftar</div>
                )}
              </div>
              <div className={`p-2 rounded-full ${color} shrink-0`}>
                <Icon className="h-4 w-4 text-white" />
              </div>
            </CardContent>
          );
          return clickable ? (
            <button
              key={key}
              type="button"
              onClick={() => setOpen(true)}
              disabled={loading}
              className="text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Card className="shadow-sm border-slate-200 hover:shadow-md hover:border-slate-300 transition-[box-shadow,border-color] cursor-pointer">{body}</Card>
            </button>
          ) : (
            <Card key={key} className="shadow-sm border-slate-200">{body}</Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tanpa Konfirmasi ({unconfirmed.length})</DialogTitle>
            <DialogDescription>
              Pasien yang sudah dikirimi reminder hari ini tetapi belum membalas.
            </DialogDescription>
          </DialogHeader>
          {unconfirmed.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Semua pasien sudah mengonfirmasi.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {unconfirmed.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-sm font-medium text-slate-800 truncate">{r.name}</span>
                  <span className="text-sm font-semibold text-slate-600 tabular-nums shrink-0">{formatJamWITA(r.time)}</span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReminderConfirmationWidget;
