import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { getCachedClinicId } from '@/lib/api';
import { Loader2, PauseCircle, PlayCircle, RefreshCcw, Search, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const COLS =
  'id, wa_id, contact_name, last_preview, last_message_at, ai_paused, ai_handoff, ai_handoff_reason, ai_handoff_priority, ai_handoff_at';

const fmt = (iso) => (iso ? format(new Date(iso), 'd MMM HH:mm', { locale: idLocale }) : '-');
const display = (c) => c.contact_name || `+${c.wa_id}`;

/**
 * Kontrol per percakapan untuk asisten AI: daftar yang diserahkan ke admin (dengan tombol
 * "Kembalikan ke AI"), daftar yang dijeda, dan pencarian untuk menjeda chat tertentu.
 * Owner dan admin klinik sama-sama boleh (kebijakan database mengizinkan keduanya).
 */
const WhatsAppAiChats = () => {
  const { toast } = useToast();
  const [clinicId, setClinicId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [handoffs, setHandoffs] = useState([]);
  const [paused, setPaused] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (cid) => {
    if (!cid) return;
    setLoading(true);
    const [h, p] = await Promise.all([
      supabase.from('wa_inbox_conversations').select(COLS).eq('clinic_id', cid).eq('ai_handoff', true)
        .order('ai_handoff_at', { ascending: false }).limit(50),
      supabase.from('wa_inbox_conversations').select(COLS).eq('clinic_id', cid).eq('ai_paused', true)
        .order('last_message_at', { ascending: false }).limit(50),
    ]);
    setHandoffs(h.data || []);
    setPaused(p.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const cid = await getCachedClinicId(sessionData?.session?.user?.id);
      setClinicId(cid);
      await load(cid);
    })();
  }, [load]);

  const update = async (c, patch, okMessage) => {
    setBusyId(c.id);
    const { error } = await supabase.from('wa_inbox_conversations').update(patch).eq('id', c.id);
    setBusyId(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal memperbarui', description: error.message });
      return;
    }
    toast({ title: okMessage });
    await load(clinicId);
    if (query.trim()) await search(query);
  };

  const returnToAi = (c) =>
    update(
      c,
      { ai_handoff: false, ai_handoff_reason: null, ai_handoff_priority: null, ai_handoff_at: null },
      'Dikembalikan ke AI',
    );
  const pause = (c) => update(c, { ai_paused: true }, 'AI dijeda untuk chat ini');
  const resume = (c) => update(c, { ai_paused: false }, 'AI diaktifkan lagi untuk chat ini');

  const search = async (text) => {
    const q = (text ?? query).trim().replace(/[%,()]/g, '');
    if (q.length < 3 || !clinicId) {
      setResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase.from('wa_inbox_conversations').select(COLS).eq('clinic_id', clinicId)
      .or(`contact_name.ilike.%${q}%,wa_id.ilike.%${q.replace(/\D/g, '') || q}%`)
      .order('last_message_at', { ascending: false }).limit(10);
    setResults(data || []);
    setSearching(false);
  };

  const Row = ({ c, children, extra }) => (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3 border border-slate-200 rounded-app-sm px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800 truncate">{display(c)}</span>
          <span className="text-xs text-slate-500">+{c.wa_id}</span>
          {c.ai_handoff && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Diserahkan ke admin</Badge>
          )}
          {c.ai_handoff_priority === 'high' && (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Prioritas</Badge>
          )}
          {c.ai_paused && (
            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">AI dijeda</Badge>
          )}
        </div>
        {extra}
        {c.last_preview && <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">Terakhir: {c.last_preview}</div>}
      </div>
      <div className="flex flex-wrap gap-2 sm:shrink-0 [&>button]:flex-1 sm:[&>button]:flex-none">{children}</div>
    </div>
  );

  const Btn = ({ c, onClick, icon: Icon, children, variant = 'outline' }) => (
    <Button size="sm" variant={variant} disabled={busyId === c.id} onClick={() => onClick(c)}>
      {busyId === c.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Icon className="w-4 h-4 mr-1" />}
      {children}
    </Button>
  );

  return (
    <Card>
      <CardContent className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Kontrol per percakapan</h3>
            <p className="text-sm text-slate-500">
              Chat yang diserahkan AI perlu dibalas admin. AI diam di chat itu sampai Anda mengembalikannya.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => load(clinicId)} disabled={loading}>
            <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Muat ulang
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-700">Diserahkan ke admin ({handoffs.length})</h4>
          {handoffs.length === 0 && <p className="text-sm text-slate-500">Tidak ada chat yang menunggu admin.</p>}
          {handoffs.map((c) => (
            <Row
              key={c.id}
              c={c}
              extra={
                <div className="text-xs text-amber-700 mt-0.5">
                  {c.ai_handoff_reason || 'Tanpa alasan'} · {fmt(c.ai_handoff_at)}
                </div>
              }
            >
              <Btn c={c} onClick={returnToAi} icon={UserCheck}>Kembalikan ke AI</Btn>
              {!c.ai_paused && <Btn c={c} onClick={pause} icon={PauseCircle}>Jeda AI</Btn>}
            </Row>
          ))}
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-700">AI dijeda ({paused.length})</h4>
          {paused.length === 0 && <p className="text-sm text-slate-500">Belum ada chat yang dijeda.</p>}
          {paused.map((c) => (
            <Row key={c.id} c={c}>
              <Btn c={c} onClick={resume} icon={PlayCircle}>Aktifkan AI lagi</Btn>
            </Row>
          ))}
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-700">Jeda AI untuk chat tertentu</h4>
          <div className="flex gap-2">
            <Input
              className="text-base sm:text-sm"
              placeholder="Cari nama atau nomor (min. 3 karakter)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
            />
            <Button variant="outline" onClick={() => search()} disabled={searching}>
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
          {results.map((c) => (
            <Row key={c.id} c={c}>
              {c.ai_paused
                ? <Btn c={c} onClick={resume} icon={PlayCircle}>Aktifkan AI lagi</Btn>
                : <Btn c={c} onClick={pause} icon={PauseCircle}>Jeda AI</Btn>}
            </Row>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default WhatsAppAiChats;
