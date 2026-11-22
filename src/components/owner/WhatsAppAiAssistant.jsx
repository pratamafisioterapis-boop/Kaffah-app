import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { getCachedClinicId } from '@/lib/api';
import { confirmAction } from '@/lib/confirmAction';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import WhatsAppAiChats from './WhatsAppAiChats';
import { Bot, Loader2, RefreshCcw, Save, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

// 0 = Minggu ... 6 = Sabtu (sama dengan penyimpanan di database)
const DAYS = [
  { key: '1', label: 'Senin' },
  { key: '2', label: 'Selasa' },
  { key: '3', label: 'Rabu' },
  { key: '4', label: 'Kamis' },
  { key: '5', label: 'Jumat' },
  { key: '6', label: 'Sabtu' },
  { key: '0', label: 'Minggu' },
];

const MODES = [
  { value: 'both', label: 'Jam buka + jam tutup', hint: 'Jam buka: AI membalas bila admin diam. Jam tutup: AI membalas langsung.' },
  { value: 'closed_only', label: 'Hanya saat jam tutup', hint: 'AI tidak menyentuh chat selama klinik buka.' },
  { value: 'silent_only', label: 'Aktif terus (tanpa jam tertentu)', hint: 'AI membalas kapan pun, bila admin tidak menjawab dalam waktu tunggu sejak pesan pasien terakhir. Bila admin sudah menjawab, AI diam sampai pasien membalas lagi.' },
];

const OUTCOME = {
  replied: { label: 'Terkirim', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  simulated: { label: 'Simulasi', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  handoff: { label: 'Ke admin', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  skipped: { label: 'Dilewati', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
  error: { label: 'Error', cls: 'bg-red-50 text-red-700 border-red-200' },
  processing: { label: 'Diproses', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
};

const normalizePhone = (raw) => {
  let p = String(raw || '').replace(/\D/g, '');
  if (p.startsWith('0')) p = `62${p.slice(1)}`;
  else if (p.startsWith('8')) p = `62${p}`;
  return p;
};

const WhatsAppAiAssistant = () => {
  const { toast } = useToast();
  const { userDetails } = useAuth();
  // Hanya owner (dan super admin) yang boleh mengubah; admin hanya melihat.
  const canEdit = ['owner', 'super_admin'].includes(userDetails?.role);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clinicId, setClinicId] = useState(null);
  const [row, setRow] = useState(null);
  const [form, setForm] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const toForm = (r) => ({
    enabled: !!r.enabled,
    mode: r.mode || 'simulate',
    ai_mode: r.ai_mode || 'both',
    delayMinutes: Math.round((r.delay_seconds ?? 300) / 60),
    delay2Minutes: Math.round((r.delay2_seconds ?? 120) / 60),
    delay3Minutes: Math.round((r.delay3_seconds ?? 60) / 60),
    closedDelayMinutes: Math.round((r.closed_delay_seconds ?? 0) / 60),
    hours: r.business_hours || {},
    testPhones: (r.test_phones || []).join('\n'),
    ignoredPhones: (r.ignored_phones || []).join('\n'),
  });

  const fetchLogs = useCallback(async (cid) => {
    if (!cid) return;
    setLogsLoading(true);
    const { data } = await supabase
      .from('wa_ai_logs')
      .select('id, created_at, mode, outcome, skip_reason, reply_text, handoff_reason, handoff_priority, error_message')
      .eq('clinic_id', cid)
      .order('created_at', { ascending: false })
      .limit(30);
    setLogs(data || []);
    setLogsLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const cid = await getCachedClinicId(sessionData?.session?.user?.id);
      setClinicId(cid);
      if (cid) {
        const { data } = await supabase.from('wa_ai_settings').select('*').eq('clinic_id', cid).maybeSingle();
        if (data) {
          setRow(data);
          setForm(toForm(data));
        }
        await fetchLogs(cid);
      }
      setLoading(false);
    })();
  }, [fetchLogs]);

  const dirty = useMemo(() => !!row && !!form && JSON.stringify(toForm(row)) !== JSON.stringify(form), [row, form]);

  const setHour = (key, idx, value) => {
    setForm((f) => {
      const cur = f.hours[key] || ['09:00', '17:00'];
      const next = [...cur];
      next[idx] = value;
      return { ...f, hours: { ...f.hours, [key]: next } };
    });
  };
  const setClosedDay = (key, closed) =>
    setForm((f) => ({ ...f, hours: { ...f.hours, [key]: closed ? null : ['09:00', '17:00'] } }));

  const handleSave = async () => {
    if (!canEdit || !form || !row) return;

    // Hati-hati dengan dua perubahan yang berdampak langsung ke pasien.
    if (form.enabled && form.mode === 'live' && !(row.enabled && row.mode === 'live')) {
      const ok = await confirmAction(
        'AI akan MENGIRIM balasan WhatsApp sungguhan dan MEMBUAT booking di aplikasi. Pastikan simulasi sudah sesuai. Lanjutkan?',
      );
      if (!ok) return;
    }
    const phones = form.testPhones.split(/[\n,;]+/).map(normalizePhone).filter((p) => p.length >= 9);
    const ignored = [...new Set(form.ignoredPhones.split(/[\n,;]+/).map(normalizePhone).filter((p) => p.length >= 9))];
    if (form.enabled && form.mode === 'live' && phones.length === 0) {
      const ok = await confirmAction(
        'Daftar nomor uji kosong, artinya AI akan melayani SEMUA pasien. Lanjutkan?',
      );
      if (!ok) return;
    }

    setSaving(true);
    const patch = {
      enabled: form.enabled,
      mode: form.mode,
      ai_mode: form.ai_mode,
      delay_seconds: Math.min(3600, Math.max(0, Math.round(Number(form.delayMinutes) || 0) * 60)),
      delay2_seconds: Math.min(3600, Math.max(60, Math.round(Number(form.delay2Minutes) || 0) * 60)),
      delay3_seconds: Math.min(3600, Math.max(60, Math.round(Number(form.delay3Minutes) || 0) * 60)),
      closed_delay_seconds: Math.min(3600, Math.max(0, Math.round(Number(form.closedDelayMinutes) || 0) * 60)),
      business_hours: form.hours,
      test_phones: phones,
      ignored_phones: ignored,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('wa_ai_settings')
      .update(patch)
      .eq('clinic_id', clinicId)
      .select('*')
      .maybeSingle();
    setSaving(false);
    if (error || !data) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error?.message || 'Pengaturan tidak ditemukan.' });
      return;
    }
    setRow(data);
    setForm(toForm(data));
    toast({ title: 'Pengaturan AI tersimpan' });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!row || !form) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-slate-600">
          Pengaturan Asisten AI belum tersedia untuk klinik ini. Hubungi pengembang untuk mengaktifkan fitur ini.
        </CardContent>
      </Card>
    );
  }

  const modeInfo = MODES.find((m) => m.value === form.ai_mode);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
            <div className="flex items-start gap-3">
              <Bot className="w-6 h-6 text-indigo-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800">Asisten AI Balasan WhatsApp</h3>
                <p className="text-sm text-slate-500">
                  Membalas pertanyaan jadwal, harga, dan lokasi, serta membuat booking. Kasus berisiko, home care, dan
                  komplain selalu diserahkan ke admin.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-2 shrink-0 rounded-app-sm bg-slate-50 border border-slate-200 px-3 py-2 sm:bg-transparent sm:border-0 sm:p-0">
              <Label htmlFor="ai-enabled" className="text-sm">{form.enabled ? 'Aktif' : 'Mati'}</Label>
              <Switch
                id="ai-enabled"
                checked={form.enabled}
                disabled={!canEdit}
                onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
              />
            </div>
          </div>

          {!canEdit && (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-app-sm px-3 py-2">
              <ShieldAlert className="w-4 h-4" /> Hanya owner yang dapat mengubah pengaturan ini.
            </div>
          )}

          {canEdit && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-app-sm border border-indigo-200 bg-indigo-50 px-3 py-3">
              <div className="text-sm text-indigo-900">
                <div className="font-semibold">Pengaturan cepat: aktif terus, tunggu admin 3 → 2 → 1 menit</div>
                <div className="text-xs text-indigo-700">
                  Live, tanpa batas jam, semua pasien. Setelah menekan tombol, klik &quot;Simpan pengaturan&quot;.
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() =>
                  setForm((f) => ({ ...f, enabled: true, mode: 'live', ai_mode: 'silent_only', delayMinutes: 3, delay2Minutes: 2, delay3Minutes: 1, testPhones: '' }))
                }
              >
                Terapkan
              </Button>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Mode kerja</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { v: 'review', t: 'Review Telegram', d: 'Draf balasan untuk SETIAP pesan pasien dikirim ke Telegram owner. Tidak ada pesan ke pasien dan tidak ada booking.' },
                  { v: 'simulate', t: 'Simulasi', d: 'Hanya mencatat rencana balasan di riwayat. Tidak ada pesan terkirim.' },
                  { v: 'live', t: 'Live', d: 'Mengirim balasan dan membuat booking sungguhan.' },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setForm((f) => ({ ...f, mode: o.v }))}
                    className={`text-left rounded-app-sm border px-3 py-2 transition ${
                      form.mode === o.v ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white'
                    } disabled:opacity-60`}
                  >
                    <div className="text-sm font-semibold text-slate-800">{o.t}</div>
                    <div className="text-xs text-slate-500">{o.d}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-mode">Kapan AI membalas</Label>
              <select
                id="ai-mode"
                value={form.ai_mode}
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, ai_mode: e.target.value }))}
                className="w-full rounded-app-sm border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm"
              >
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500">{modeInfo?.hint}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-delay">Tunggu admin (menit) sejak pesan pasien terakhir</Label>
              <Input
                id="ai-delay"
                type="number"
                min={0}
                max={60}
                value={form.delayMinutes}
                disabled={!canEdit || form.ai_mode === 'closed_only'}
                onChange={(e) => setForm((f) => ({ ...f, delayMinutes: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-delay2">Tunggu admin (menit) setelah AI membalas sekali</Label>
              <Input
                id="ai-delay2"
                type="number"
                min={1}
                max={60}
                value={form.delay2Minutes}
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, delay2Minutes: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-delay3">Tunggu admin (menit) setelah AI membalas dua kali atau lebih</Label>
              <Input
                id="ai-delay3"
                type="number"
                min={1}
                max={60}
                value={form.delay3Minutes}
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, delay3Minutes: e.target.value }))}
              />
              <p className="text-xs text-slate-500">Balasan admin mengulang hitungan dari menit pertama.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-closed-delay">Jeda saat jam tutup (menit, 0 = langsung)</Label>
              <Input
                id="ai-closed-delay"
                type="number"
                min={0}
                max={60}
                value={form.closedDelayMinutes}
                disabled={!canEdit || form.ai_mode === 'silent_only'}
                onChange={(e) => setForm((f) => ({ ...f, closedDelayMinutes: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Jam operasional klinik (WITA)</Label>
            <p className="text-xs text-slate-500">Di luar jam ini dihitung sebagai jam tutup.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {DAYS.map((d) => {
                const h = form.hours[d.key];
                return (
                  <div key={d.key} className="flex flex-wrap items-center gap-2 border border-slate-200 rounded-app-sm px-3 py-2">
                    <span className="w-16 text-sm font-medium text-slate-700">{d.label}</span>
                    <Input
                      type="time"
                      className="w-28 flex-1 min-w-[6.5rem] sm:flex-none"
                      value={h ? h[0] : ''}
                      disabled={!canEdit || !h}
                      onChange={(e) => setHour(d.key, 0, e.target.value)}
                    />
                    <span className="text-slate-400">–</span>
                    <Input
                      type="time"
                      className="w-28 flex-1 min-w-[6.5rem] sm:flex-none"
                      value={h ? h[1] : ''}
                      disabled={!canEdit || !h}
                      onChange={(e) => setHour(d.key, 1, e.target.value)}
                    />
                    <label className="ml-auto flex items-center gap-1 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        checked={!h}
                        disabled={!canEdit}
                        onChange={(e) => setClosedDay(d.key, e.target.checked)}
                      />
                      Tutup
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-phones">Nomor uji (satu per baris)</Label>
            <Textarea
              id="ai-phones"
              rows={3}
              placeholder="0812xxxxxxx"
              value={form.testPhones}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, testPhones: e.target.value }))}
            />
            <p className="text-xs text-slate-500">
              Bila diisi, AI HANYA melayani nomor-nomor ini (masa uji). Kosongkan untuk melayani semua pasien.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-ignored">Nomor yang dikecualikan (satu per baris)</Label>
            <Textarea
              id="ai-ignored"
              rows={3}
              placeholder="0812xxxxxxx"
              value={form.ignoredPhones}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, ignoredPhones: e.target.value }))}
            />
            <p className="text-xs text-slate-500">
              AI tidak pernah membalas dan tidak membuat draf untuk nomor-nomor ini (mis. nomor admin sendiri).
            </p>
          </div>

          {canEdit && (
            <div className="flex justify-end sticky bottom-3 z-10">
              <Button className="w-full sm:w-auto shadow-md" onClick={handleSave} disabled={!dirty || saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Simpan pengaturan
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <WhatsAppAiChats />

      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base sm:text-lg font-bold text-slate-800">Riwayat balasan AI</h3>
            <Button variant="outline" size="sm" onClick={() => fetchLogs(clinicId)} disabled={logsLoading}>
              <RefreshCcw className={`w-4 h-4 mr-2 ${logsLoading ? 'animate-spin' : ''}`} /> Muat ulang
            </Button>
          </div>
          <div className="-mx-1 overflow-x-auto"><Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Isi / alasan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-slate-500 py-8">
                    Belum ada aktivitas AI.
                  </TableCell>
                </TableRow>
              )}
              {logs.map((l) => {
                const o = OUTCOME[l.outcome] || OUTCOME.processing;
                const detail = l.reply_text || l.handoff_reason || l.skip_reason || l.error_message || '';
                return (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-xs text-slate-600">
                      {format(new Date(l.created_at), 'd MMM HH:mm', { locale: idLocale })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={o.cls}>{o.label}</Badge>
                      {l.mode === 'review' && (
                        <Badge variant="outline" className="ml-1 bg-violet-50 text-violet-700 border-violet-200">Telegram</Badge>
                      )}
                      {l.handoff_priority === 'high' && (
                        <Badge variant="outline" className="ml-1 bg-red-50 text-red-700 border-red-200">Prioritas</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-700 max-w-xl">
                      <div className="line-clamp-3 whitespace-pre-line">{detail}</div>
                      {l.handoff_reason && l.reply_text && (
                        <div className="text-xs text-amber-700 mt-1">Diserahkan: {l.handoff_reason}</div>
                      )}
                      {l.skip_reason && l.error_message && (
                        <div className="text-xs text-slate-500 mt-1">{l.skip_reason}: {l.error_message}</div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table></div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppAiAssistant;
