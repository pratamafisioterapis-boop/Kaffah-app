import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { PRAXIS_CLINIC_ID } from '@/lib/clinicIds';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import PageHero from '@/components/shared/PageHero';
import TicketThread from './TicketThread';
import DictationButton from './DictationButton';
import { STATUS_LABEL, STATUS_TONE, fmtWhen } from './csShared';

// Halaman staf Praxis: ajukan permintaan perubahan aplikasi dan pantau statusnya.
const KINDS = [
  { value: 'perubahan', label: 'Perubahan / permintaan', hint: 'Jelaskan perubahan yang diinginkan, sedetail mungkin.' },
  { value: 'bug', label: 'Laporan bug', hint: 'Apa yang Anda lakukan, apa yang seharusnya terjadi, apa yang terjadi. Sertakan nomor RM pasien dan tanggalnya.', template: 'Yang saya lakukan:\n\nYang seharusnya terjadi:\n\nYang terjadi:\n\nNomor RM pasien / tanggal terkait:\n' },
  { value: 'data', label: 'Ubah data yang sudah terisi (khusus owner)', ownerOnly: true, hint: 'Sebutkan data yang salah (nomor RM, tanggal, jenis data) dan nilai yang benar. Perubahan hanya untuk data klinik Praxis dan bisa dikembalikan.', template: 'Data yang salah (nomor RM, tanggal, jenis data):\n\nSeharusnya menjadi:\n\nAlasan:\n' },
];

const ClinaraCsPage = () => {
  const { userDetails, role } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState('perubahan');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('clinara_cs_tickets').select('*').order('created_at', { ascending: false }).limit(100);
    setTickets(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  if (userDetails && userDetails.clinic_id !== PRAXIS_CLINIC_ID) {
    return <p className="p-6 text-sm text-gray-500">Fitur ini khusus klinik Praxis.</p>;
  }

  const submit = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('clinara-cs', { body: { action: 'create', kind, subject: subject.trim(), body: body.trim() } });
      if (error || data?.error) throw new Error(data?.error || error.message);
      toast({ title: 'Permintaan terkirim', description: `Tiket #${data.ticket_id} sudah diterima tim Clinara.` });
      setCreating(false); setSubject(''); setBody(''); setKind('perubahan');
      await load();
      setOpenId(data.ticket_id);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Gagal mengirim', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const open = tickets?.find((t) => t.id === openId);

  return (
    <div className="space-y-4">
      <PageHero
        title="Hubungi CS Clinara"
        description="Ajukan perubahan atau penyesuaian aplikasi untuk klinik Anda. Statusnya bisa dipantau di sini."
      />
      <Button onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" />Permintaan baru</Button>
      {tickets === null ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" /> : tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
          <MessageSquare className="mx-auto mb-2 h-6 w-6 text-gray-400" />Belum ada permintaan. Ketuk “Permintaan baru” untuk memulai.
        </div>
      ) : (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => setOpenId(t.id)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-left active:bg-gray-50">
                <span className="min-w-0">
                  <span className="block truncate font-medium">#{t.id} · {t.subject}</span>
                  <span className="text-xs text-gray-500">{t.kind === 'bug' ? 'Bug · ' : t.kind === 'data' ? 'Ubah data · ' : ''}{fmtWhen(t.created_at)}</span>
                </span>
                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[t.status]}`}>{STATUS_LABEL[t.status]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Permintaan baru</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              {KINDS.filter((k) => !k.ownerOnly || role === 'owner').map((k) => (
                <label key={k.value} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${kind === k.value ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}>
                  <input type="radio" name="cs-kind" checked={kind === k.value} onChange={() => { setKind(k.value); if (!body.trim() || KINDS.some((x) => x.template === body)) setBody(k.template || ''); }} />
                  {k.label}
                </label>
              ))}
            </div>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Judul singkat (mis. Ubah teks kwitansi)" maxLength={200} className="text-base" />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500">Bisa diketik, atau ucapkan lewat tombol Dikte.</span>
              <DictationButton onText={(t) => setBody((b) => (b.trim() ? `${b.trimEnd()} ${t}` : t))} />
            </div>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder={KINDS.find((k) => k.value === kind)?.hint} className="text-base" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Batal</Button>
            <Button onClick={submit} disabled={saving || body.trim().length < 3 || subject.trim().length < 3}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Kirim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent>
          {open && (<>
            <DialogHeader><DialogTitle>#{open.id} · {open.subject}</DialogTitle></DialogHeader>
            <TicketThread ticket={open} onChanged={load} />
          </>)}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClinaraCsPage;
