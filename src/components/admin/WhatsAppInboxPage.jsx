import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Send, Search, MessageCircle, Check, CheckCheck, AlertCircle, Clock, UserCheck, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import {
  getWaInboxProvider, sendInboxText, markInboxRead, waSendTemplate,
} from '@/lib/waCloud';

const WINDOW_MS = 24 * 60 * 60 * 1000;
const windowOpen = (conv) =>
  !!conv?.last_inbound_at && Date.now() - new Date(conv.last_inbound_at).getTime() < WINDOW_MS;

const timeLabel = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
};

const StatusIcon = ({ status }) => {
  if (status === 'read') return <CheckCheck className="w-3.5 h-3.5 text-sky-500" />;
  if (status === 'delivered') return <CheckCheck className="w-3.5 h-3.5 text-slate-400" />;
  if (status === 'sent') return <Check className="w-3.5 h-3.5 text-slate-400" />;
  if (status === 'failed') return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
  return <Clock className="w-3.5 h-3.5 text-slate-300" />;
};

const Media = ({ msg }) => {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    if (!msg.media_path) return undefined;
    supabase.storage.from('wa-media').createSignedUrl(msg.media_path, 3600).then(({ data }) => {
      if (alive) setUrl(data?.signedUrl || null);
    });
    return () => { alive = false; };
  }, [msg.media_path]);

  if (!msg.media_path || !url) return null;
  const mime = msg.media_mime || '';
  if (mime.startsWith('image/')) return <img src={url} alt="" className="rounded-lg max-h-64 mb-1" />;
  if (mime.startsWith('audio/')) return <audio controls src={url} className="mb-1 max-w-full" />;
  if (mime.startsWith('video/')) return <video controls src={url} className="rounded-lg max-h-64 mb-1" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-sky-600 underline text-xs flex items-center gap-1 mb-1">
      <FileText className="w-3 h-3" /> Buka berkas
    </a>
  );
};

const TemplateComposer = ({ conv, templates, onSent }) => {
  const [name, setName] = useState('');
  const [params, setParams] = useState([]);
  const [sending, setSending] = useState(false);
  const tpl = templates.find((t) => t.name === name);
  const bodyText = tpl?.components?.find((c) => c.type === 'BODY')?.text || '';
  const varCount = useMemo(() => {
    const nums = [...bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    return nums.length ? Math.max(...nums) : 0;
  }, [bodyText]);

  useEffect(() => { setParams(Array(varCount).fill('')); }, [name, varCount]);

  const preview = bodyText.replace(/\{\{(\d+)\}\}/g, (_, n) => params[n - 1] || `{{${n}}}`);
  const ready = tpl && params.length === varCount && params.every((p) => p.trim());

  const send = async () => {
    setSending(true);
    try {
      await waSendTemplate(conv.wa_id, tpl.name, params.map((p) => p.trim()));
      setName('');
      onSent?.();
    } catch (e) {
      toast({ title: 'Gagal mengirim', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
        Lebih dari 24 jam sejak pasien membalas. WhatsApp hanya mengizinkan <b>template yang sudah disetujui</b>.
      </p>
      <select
        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
        value={name}
        onChange={(e) => setName(e.target.value)}
      >
        <option value="">Pilih template…</option>
        {templates.map((t) => <option key={`${t.name}-${t.language}`} value={t.name}>{t.name}</option>)}
      </select>
      {varCount > 0 && params.map((p, i) => (
        <Input key={i} value={p} placeholder={`Isi {{${i + 1}}}`}
          onChange={(e) => setParams((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))} />
      ))}
      {tpl && <p className="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-md p-2">{preview}</p>}
      <Button onClick={send} disabled={!ready || sending} className="w-full">
        {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
        Kirim template
      </Button>
    </div>
  );
};

const WhatsAppInboxPage = () => {
  const [provider, setProvider] = useState(undefined); // undefined = memuat, null = tidak aktif
  const [convs, setConvs] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const activeIdRef = useRef(null);
  activeIdRef.current = activeId;

  const active = convs.find((c) => c.id === activeId) || null;

  const loadConvs = useCallback(async () => {
    const { data } = await supabase
      .from('wa_conversations')
      .select('*, patient:patients(id, full_name)')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(200);
    setConvs(data || []);
  }, []);

  const loadMessages = useCallback(async (id) => {
    const { data } = await supabase
      .from('wa_messages').select('*').eq('conversation_id', id)
      .order('created_at', { ascending: true }).limit(500);
    setMessages(data || []);
  }, []);

  useEffect(() => {
    getWaInboxProvider().then(setProvider);
    loadConvs();
  }, [loadConvs]);

  // Template Meta hanya relevan untuk provider Cloud API langsung.
  useEffect(() => {
    if (provider !== 'cloud') return;
    supabase.from('wa_meta_templates').select('name, language, components')
      .eq('status', 'APPROVED').then(({ data }) => setTemplates(data || []));
  }, [provider]);

  // Realtime: pesan baru / status berubah muncul tanpa refresh. RLS tetap berlaku.
  useEffect(() => {
    const ch = supabase.channel('wa-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_messages' }, (payload) => {
        const row = payload.new;
        if (row?.conversation_id === activeIdRef.current) loadMessages(row.conversation_id);
        loadConvs();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_conversations' }, () => loadConvs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadConvs, loadMessages]);

  useEffect(() => {
    if (!activeId) return;
    loadMessages(activeId);
    markInboxRead(provider, activeId).catch(() => {});
  }, [activeId, loadMessages, provider]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length, activeId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return convs;
    return convs.filter((c) =>
      (c.contact_name || '').toLowerCase().includes(q)
      || (c.patient?.full_name || '').toLowerCase().includes(q)
      || c.wa_id.includes(q.replace(/\D/g, '') || '§'));
  }, [convs, search]);

  const sendText = async () => {
    const body = draft.trim();
    if (!body || !active) return;
    setSending(true);
    try {
      await sendInboxText(provider, active.wa_id, body);
      setDraft('');
    } catch (e) {
      toast({ title: 'Gagal mengirim', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  if (provider === undefined) {
    return <div className="p-8 text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Memuat…</div>;
  }

  if (!provider) {
    return (
      <div className="p-8 max-w-xl">
        <h1 className="text-xl font-bold text-slate-800 mb-2">WhatsApp Inbox</h1>
        <p className="text-slate-600 text-sm">
          Inbox WhatsApp belum diaktifkan untuk klinik ini.
        </p>
      </div>
    );
  }

  return (
    <>
      <Helmet><title>WhatsApp Inbox</title></Helmet>
      <div className="flex h-[calc(100vh-8rem)] min-h-[480px] bg-white border border-slate-200 rounded-app overflow-hidden">
        {/* Daftar percakapan */}
        <aside className={`${active ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-slate-200`}>
          <div className="p-3 border-b border-slate-200 relative">
            <Search className="w-4 h-4 absolute left-6 top-6 text-slate-400" />
            <Input className="pl-8" placeholder="Cari nama / nomor" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="p-6 text-sm text-slate-500 text-center">
                Belum ada pesan. Pesan masuk dari pasien akan muncul di sini.
              </p>
            )}
            {filtered.map((c) => (
              <button key={c.id} onClick={() => setActiveId(c.id)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${c.id === activeId ? 'bg-green-50' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-800 truncate">
                    {c.patient?.full_name || c.contact_name || `+${c.wa_id}`}
                  </span>
                  <span className="text-[11px] text-slate-400 shrink-0">{timeLabel(c.last_message_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-xs text-slate-500 truncate">{c.last_preview || '—'}</span>
                  {c.unread_count > 0 && (
                    <span className="bg-green-600 text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shrink-0">
                      {c.unread_count}
                    </span>
                  )}
                </div>
                {!c.patient_id && <Badge variant="outline" className="mt-1 text-[10px] py-0">Kontak baru</Badge>}
              </button>
            ))}
          </div>
        </aside>

        {/* Percakapan */}
        <section className={`${active ? 'flex' : 'hidden md:flex'} flex-col flex-1 min-w-0`}>
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
              <MessageCircle className="w-10 h-10" />
              <p className="text-sm">Pilih percakapan</p>
            </div>
          ) : (
            <>
              <header className="px-4 py-3 border-b border-slate-200 flex items-center gap-3">
                <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setActiveId(null)}>←</Button>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate flex items-center gap-1.5">
                    {active.patient?.full_name || active.contact_name || `+${active.wa_id}`}
                    {active.patient_id && <UserCheck className="w-4 h-4 text-green-600" title="Terhubung ke data pasien" />}
                  </p>
                  <p className="text-xs text-slate-500">+{active.wa_id}{active.contact_name && active.patient ? ` · ${active.contact_name}` : ''}</p>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm shadow-sm ${m.direction === 'out' ? 'bg-green-100' : 'bg-white'}`}>
                      <Media msg={m} />
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      {m.status === 'failed' && m.error_message && (
                        <p className="text-[11px] text-red-600 mt-1">{m.error_message}</p>
                      )}
                      <div className="flex items-center justify-end gap-1 mt-0.5 text-[10px] text-slate-400">
                        {m.template_name && <span>template</span>}
                        <span>{timeLabel(m.created_at)}</span>
                        {m.direction === 'out' && <StatusIcon status={m.status} />}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <footer className="p-3 border-t border-slate-200">
                {windowOpen(active) ? (
                  <div className="flex gap-2 items-end">
                    <Textarea rows={2} value={draft} placeholder="Tulis balasan…"
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }} />
                    <Button onClick={sendText} disabled={sending || !draft.trim()}>
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                ) : provider === 'watzap' ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    Lebih dari 24 jam sejak pasien membalas, WhatsApp hanya mengizinkan <b>template yang disetujui</b>.
                    Kirim template lewat menu Follow Up; balasan bebas bisa lagi setelah pasien membalas.
                  </p>
                ) : (
                  <TemplateComposer conv={active} templates={templates} onSent={() => loadMessages(active.id)} />
                )}
              </footer>
            </>
          )}
        </section>
      </div>
    </>
  );
};

export default WhatsAppInboxPage;
