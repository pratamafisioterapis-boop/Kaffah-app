import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { PageHead, Panel, Spinner } from '@/components/superadmin/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import TicketThread from '@/components/clinara-cs/TicketThread';
import { STATUS_LABEL, STATUS_TONE, fmtWhen } from '@/components/clinara-cs/csShared';

// Antrean tiket CS dari semua klinik (saat ini Praxis). Persetujuan utama lewat Telegram (/cs).
const SuperAdminCsTickets = () => {
  const [tickets, setTickets] = useState(null);
  const [clinics, setClinics] = useState({});
  const [openId, setOpenId] = useState(null);
  const [filter, setFilter] = useState('terbuka');

  const load = useCallback(async () => {
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase.from('clinara_cs_tickets').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('clinics').select('id, name'),
    ]);
    setTickets(t || []);
    setClinics(Object.fromEntries((c || []).map((x) => [x.id, x.name])));
  }, []);
  useEffect(() => { load(); }, [load]);

  const closed = (s) => ['selesai', 'ditolak', 'dibatalkan'].includes(s);
  const shown = (tickets || []).filter((t) => (filter === 'terbuka' ? !closed(t.status) : filter === 'semua' ? true : closed(t.status)));
  const open = tickets?.find((t) => t.id === openId);

  return (
    <div className="space-y-4">
      <PageHead
        title="Tiket CS Klinik"
        description="Permintaan perubahan dari klinik. Setujui lewat Telegram: balas “ok” / “ga” pada notifikasi, atau /cs."
      />
      <div className="flex gap-2">
        {['terbuka', 'selesai', 'semua'].map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-sm ${filter === f ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600'}`}>
            {f === 'terbuka' ? 'Terbuka' : f === 'selesai' ? 'Tertutup' : 'Semua'}
          </button>
        ))}
      </div>
      {tickets === null ? <Spinner /> : (
        <Panel>
          {shown.length === 0 ? <p className="p-6 text-center text-sm text-gray-500">Tidak ada tiket.</p> : (
            <ul className="divide-y divide-gray-100">
              {shown.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => setOpenId(t.id)} className="flex w-full items-center justify-between gap-3 p-4 text-left active:bg-gray-50">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">#{t.id} · {t.subject}</span>
                      <span className="text-xs text-gray-500">{clinics[t.clinic_id] || 'Klinik'} · {t.requester_name} · {fmtWhen(t.created_at)}{t.category ? ` · jalur ${t.category}` : ''}</span>
                    </span>
                    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent>
          {open && (<>
            <DialogHeader><DialogTitle>#{open.id} · {open.subject}</DialogTitle></DialogHeader>
            <TicketThread ticket={open} asCs onChanged={load} />
          </>)}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminCsTickets;
