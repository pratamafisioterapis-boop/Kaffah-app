import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import DictationButton from './DictationButton';
import { STATUS_LABEL, STATUS_TONE, fmtWhen } from './csShared';

// Percakapan satu tiket. `asCs` = tampilan Super Admin (membalas sebagai CS, langsung ke tabel).
const TicketThread = ({ ticket, asCs = false, onChanged }) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const closed = ['selesai', 'ditolak', 'dibatalkan'].includes(ticket.status);

  const load = useCallback(async () => {
    const { data } = await supabase.from('clinara_cs_messages').select('*').eq('ticket_id', ticket.id).order('created_at');
    setMessages(data || []);
  }, [ticket.id]);

  useEffect(() => { setMessages(null); load(); }, [load, ticket.status]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages]);

  const send = async () => {
    const body = text.trim();
    if (body.length < 3 || sending) return;
    setSending(true);
    try {
      if (asCs) {
        const { error } = await supabase.from('clinara_cs_messages').insert({ ticket_id: ticket.id, sender: 'cs', body });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.functions.invoke('clinara-cs', { body: { action: 'message', ticket_id: ticket.id, body } });
        if (error || data?.error) throw new Error(data?.error || error.message);
      }
      setText('');
      await load();
      onChanged?.();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Pesan gagal dikirim', description: e.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[ticket.status]}`}>{STATUS_LABEL[ticket.status]}</span>
        {ticket.pr_url && <a className="inline-flex items-center gap-1 text-blue-600 hover:underline" href={ticket.pr_url} target="_blank" rel="noreferrer">PR <ExternalLink className="h-3 w-3" /></a>}
        {ticket.preview_url && <a className="inline-flex items-center gap-1 text-blue-600 hover:underline" href={ticket.preview_url} target="_blank" rel="noreferrer">Preview <ExternalLink className="h-3 w-3" /></a>}
      </div>
      {ticket.plan && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm whitespace-pre-wrap">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">Rencana</p>{ticket.plan}
        </div>
      )}
      <div className="max-h-[40vh] space-y-2 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3">
        {messages === null ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" /> : messages.map((m) => {
          const mine = asCs ? m.sender === 'cs' : m.sender === 'staff';
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${mine ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200'}`}>
                {m.body}
                <p className={`mt-1 text-[10px] ${mine ? 'text-blue-100' : 'text-gray-400'}`}>{m.sender === 'cs' ? 'CS Clinara' : 'Staf'} · {fmtWhen(m.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {(!closed || asCs) && (
        <div className="flex items-end gap-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={asCs ? 'Balas sebagai CS…' : 'Tambahkan keterangan…'} className="min-h-0 flex-1 text-base" />
          {!asCs && <DictationButton onText={(t) => setText((b) => (b.trim() ? `${b.trimEnd()} ${t}` : t))} disabled={sending} />}
          <Button onClick={send} disabled={sending || text.trim().length < 3} aria-label="Kirim">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
};

export default TicketThread;
