import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Send, ArrowLeft, MessageCircle, ClipboardList, Check } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { fetchTherapistPatientIds } from '@/lib/portalScope';

// Kotak masuk staf untuk aplikasi pasien Clinara: membalas chat dan menandai keluhan yang sudah ditinjau.
// Dipakai oleh halaman admin, owner, dan terapis. Akses data dibatasi RLS per klinik.
// Skema: supabase/manual/9_portal_pasien_clinara.sql
const fmtTime = (iso) =>
  new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(':', '.');
const nameOf = (p) => p?.nickname || p?.full_name || 'Pasien';

const PatientPortalInboxContent = ({ therapistId = null }) => {
  const { userDetails, user } = useAuth();
  const { toast } = useToast();
  const clinicId = userDetails?.clinic_id;

  const [tab, setTab] = useState('pesan');
  const [messages, setMessages] = useState([]); // terbaru dulu
  const [feedback, setFeedback] = useState([]);
  const [patients, setPatients] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // patient_id
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [onlyNew, setOnlyNew] = useState(true);
  const boxRef = useRef(null);
  const [scope, setScope] = useState(null); // terapis: id pasien miliknya; owner/admin: null (seluruh klinik)

  useEffect(() => {
    if (!therapistId) return;
    fetchTherapistPatientIds(therapistId).then((ids) => setScope(ids || new Set()));
  }, [therapistId]);

  const load = useCallback(async () => {
    let mq = supabase.from('patient_portal_messages')
      .select('id, patient_id, sender, body, created_at, read_at').order('created_at', { ascending: false }).limit(1000);
    let fq = supabase.from('patient_portal_feedback')
      .select('id, patient_id, vas, tags, message, status, created_at').order('created_at', { ascending: false }).limit(300);
    if (clinicId) { mq = mq.eq('clinic_id', clinicId); fq = fq.eq('clinic_id', clinicId); }
    const [m, f] = await Promise.all([mq, fq]);
    if (m.error || f.error) {
      toast({ variant: 'destructive', title: 'Gagal memuat data pasien', description: (m.error || f.error).message });
      setLoading(false);
      return;
    }
    const mine = (r) => !scope || scope.has(r.patient_id);
    const msgs = (m.data || []).filter(mine);
    const fbs = (f.data || []).filter(mine);
    setMessages(msgs);
    setFeedback(fbs);
    const ids = [...new Set([...msgs, ...fbs].map((r) => r.patient_id))];
    if (ids.length) {
      const { data } = await supabase.from('patients').select('id, full_name, nickname').in('id', ids.slice(0, 300));
      setPatients(Object.fromEntries((data || []).map((p) => [p.id, p])));
    }
    setLoading(false);
  }, [clinicId, toast, scope]);

  useEffect(() => {
    if (therapistId && !scope) return undefined; // tunggu daftar pasien terapis
    load();
    const poll = setInterval(load, 20000);
    const channel = supabase.channel('portal-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_portal_messages' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_portal_feedback' }, load)
      .subscribe();
    return () => { clearInterval(poll); supabase.removeChannel(channel); };
  }, [load]);

  const threads = useMemo(() => {
    const map = new Map();
    messages.forEach((m) => {
      const t = map.get(m.patient_id) || { patient_id: m.patient_id, last: m, unread: 0 };
      if (m.sender === 'patient' && !m.read_at) t.unread += 1;
      map.set(m.patient_id, t);
    });
    return [...map.values()];
  }, [messages]);

  const thread = useMemo(
    () => (selected ? messages.filter((m) => m.patient_id === selected).slice().reverse() : []),
    [messages, selected],
  );

  // Buka percakapan: tandai pesan pasien terbaca.
  const openThread = async (patientId) => {
    setSelected(patientId);
    const hasUnread = messages.some((m) => m.patient_id === patientId && m.sender === 'patient' && !m.read_at);
    if (hasUnread) {
      await supabase.from('patient_portal_messages').update({ read_at: new Date().toISOString() })
        .eq('patient_id', patientId).eq('sender', 'patient').is('read_at', null);
      load();
    }
  };

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [thread.length, selected]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !selected) return;
    setSending(true);
    const { error } = await supabase.from('patient_portal_messages')
      .insert({ clinic_id: clinicId, patient_id: selected, sender: 'therapist', body });
    setSending(false);
    if (error) { toast({ variant: 'destructive', title: 'Pesan gagal dikirim', description: error.message }); return; }
    setText('');
    load();
  };

  const markReviewed = async (id) => {
    const { error } = await supabase.from('patient_portal_feedback')
      .update({ status: 'reviewed', reviewed_by: user?.id || null, reviewed_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast({ variant: 'destructive', title: 'Gagal memperbarui', description: error.message }); return; }
    toast({ title: 'Keluhan ditandai sudah ditinjau' });
    load();
  };

  const unreadTotal = threads.reduce((a, t) => a + t.unread, 0);
  const newFeedback = feedback.filter((f) => f.status === 'new').length;
  const shownFeedback = onlyNew ? feedback.filter((f) => f.status === 'new') : feedback;

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Pesan dan Keluhan Pasien</h1>
        <p className="text-sm text-slate-500 mt-1">Chat dan keluhan dari aplikasi pasien. Pasien menerima balasan di aplikasinya.</p>
      </div>

      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1" role="tablist">
        {[['pesan', 'Pesan', MessageCircle, unreadTotal], ['keluhan', 'Keluhan', ClipboardList, newFeedback]].map(([k, label, Icon, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn('flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              tab === k ? 'bg-app-accent text-white' : 'text-slate-600 hover:bg-slate-50')}>
            <Icon className="h-4 w-4" /> {label}
            {n > 0 && <span className={cn('rounded-full px-2 text-xs', tab === k ? 'bg-white/25' : 'bg-red-500 text-white')}>{n}</span>}
          </button>
        ))}
      </div>

      {tab === 'pesan' ? (
        <div className="grid gap-4 md:grid-cols-[320px_minmax(0,1fr)]">
          <div className={cn('rounded-2xl border border-slate-200 bg-white overflow-hidden', selected && 'hidden md:block')}>
            {threads.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">Belum ada percakapan. Pesan dari pasien akan muncul di sini.</p>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
                {threads.map((t) => (
                  <li key={t.patient_id}>
                    <button onClick={() => openThread(t.patient_id)}
                      className={cn('w-full text-left px-4 py-3 hover:bg-slate-50', selected === t.patient_id && 'bg-sky-50')}>
                      <div className="flex items-center gap-2">
                        <b className="flex-1 min-w-0 truncate text-slate-900">{nameOf(patients[t.patient_id])}</b>
                        {t.unread > 0 && <span className="rounded-full bg-red-500 px-2 text-xs text-white">{t.unread}</span>}
                      </div>
                      <p className="truncate text-sm text-slate-500">{t.last.sender === 'therapist' ? 'Anda: ' : ''}{t.last.body}</p>
                      <p className="text-xs text-slate-400">{fmtTime(t.last.created_at)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={cn('rounded-2xl border border-slate-200 bg-white flex flex-col min-h-[420px]', !selected && 'hidden md:flex')}>
            {selected ? (
              <>
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                  <Button variant="ghost" size="sm" className="md:hidden px-2" onClick={() => setSelected(null)} aria-label="Kembali"><ArrowLeft className="h-4 w-4" /></Button>
                  <b className="text-slate-900">{nameOf(patients[selected])}</b>
                </div>
                <div ref={boxRef} className="flex-1 space-y-2 overflow-y-auto p-4 max-h-[440px]">
                  {thread.map((m) => (
                    <div key={m.id} className={cn('max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words',
                      m.sender === 'therapist' ? 'ml-auto bg-app-accent text-white' : 'bg-slate-100 text-slate-900')}>
                      {m.body}
                      <span className="block text-[10px] opacity-70 mt-1">{fmtTime(m.created_at)}</span>
                    </div>
                  ))}
                </div>
                <form onSubmit={send} className="flex gap-2 border-t border-slate-100 p-3">
                  <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis balasan" maxLength={2000} aria-label="Balasan" />
                  <Button type="submit" disabled={sending || !text.trim()}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
                </form>
              </>
            ) : (
              <p className="m-auto p-6 text-sm text-slate-500">Pilih percakapan di sebelah kiri.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} /> Hanya yang belum ditinjau
          </label>
          {shownFeedback.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              {onlyNew ? 'Tidak ada keluhan baru.' : 'Belum ada keluhan dari pasien.'}
            </div>
          )}
          {shownFeedback.map((f) => (
            <div key={f.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <b className="text-slate-900">{nameOf(patients[f.patient_id])}</b>
                <Badge className={cn('border-transparent', f.vas >= 6 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800')}>Nyeri {f.vas}/10</Badge>
                <span className="text-xs text-slate-400">{fmtTime(f.created_at)}</span>
                <span className="flex-1" />
                {f.status === 'reviewed'
                  ? <Badge className="border-transparent bg-emerald-100 text-emerald-800"><Check className="mr-1 h-3 w-3" /> Ditinjau</Badge>
                  : <Button size="sm" onClick={() => markReviewed(f.id)}>Tandai ditinjau</Button>}
                <Button size="sm" variant="outline" onClick={() => { setTab('pesan'); openThread(f.patient_id); }}>Balas lewat chat</Button>
              </div>
              {f.tags?.length > 0 && <p className="mt-2 text-sm text-slate-600">{f.tags.join(', ')}</p>}
              {f.message && <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap break-words">{f.message}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PatientPortalInboxContent;
