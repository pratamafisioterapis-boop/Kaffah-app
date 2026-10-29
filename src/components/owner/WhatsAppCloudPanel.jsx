import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw, Trash2, Send, Plug, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import {
  getWaCloudAccount, waSaveAccount, waAccountStatus, waToggleAccount,
  waSyncTemplates, waCreateTemplate, waDeleteTemplate,
  waCreateBroadcast, waProcessBroadcast, waCancelBroadcast,
} from '@/lib/waCloud';

const fail = (title, e) => toast({ title, description: e.message, variant: 'destructive' });

const STATUS_STYLE = {
  APPROVED: 'bg-green-100 text-green-700',
  PENDING: 'bg-amber-100 text-amber-700',
  REJECTED: 'bg-red-100 text-red-700',
  PAUSED: 'bg-slate-200 text-slate-700',
  DISABLED: 'bg-slate-200 text-slate-700',
};

// ───────────────────────── Koneksi ─────────────────────────
const ConnectionTab = () => {
  const [acc, setAcc] = useState(undefined);
  const [form, setForm] = useState({ waba_id: '', phone_number_id: '', access_token: '' });
  const [busy, setBusy] = useState(false);
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/wa-webhook`;

  const load = useCallback(async () => {
    try {
      const a = await getWaCloudAccount();
      setAcc(a);
      if (a) setForm((f) => ({ ...f, waba_id: a.waba_id, phone_number_id: a.phone_number_id }));
    } catch (_) { setAcc(null); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      const r = await waSaveAccount(form);
      toast({
        title: 'Terhubung',
        description: r.subscribed
          ? `${r.verified_name || ''} ${r.display_phone || ''}`
          : 'Terhubung, tetapi gagal mendaftarkan webhook otomatis. Daftarkan manual di Meta.',
      });
      setForm((f) => ({ ...f, access_token: '' }));
      await load();
    } catch (e) { fail('Gagal menghubungkan', e); } finally { setBusy(false); }
  };

  const refresh = async () => {
    setBusy(true);
    try {
      const r = await waAccountStatus();
      toast({ title: r.connected ? 'Koneksi sehat' : 'Koneksi bermasalah', description: r.error, variant: r.connected ? 'default' : 'destructive' });
      await load();
    } catch (e) { fail('Gagal memeriksa', e); } finally { setBusy(false); }
  };

  if (acc === undefined) return <Loader2 className="w-5 h-5 animate-spin text-slate-400" />;

  const nameOk = acc?.name_status === 'APPROVED';
  return (
    <div className="space-y-5 max-w-2xl">
      {acc && (
        <div className="border border-slate-200 rounded-app p-4 space-y-2 bg-slate-50">
          <div className="flex items-center justify-between">
            <p className="font-medium text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              {acc.verified_name || 'Terhubung'} · {acc.display_phone}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Aktif</span>
              <Switch checked={acc.enabled}
                onCheckedChange={async (v) => { try { await waToggleAccount(v); await load(); } catch (e) { fail('Gagal', e); } }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Kualitas: {acc.quality_rating || '-'}</Badge>
            <Badge variant="outline" className={nameOk ? '' : 'border-amber-400 text-amber-700'}>
              Nama tampilan: {acc.name_status || '-'}
            </Badge>
          </div>
          {!nameOk && (
            <p className="text-xs text-amber-700 flex gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Nama tampilan belum disetujui Meta; batas pengiriman bisa lebih rendah dan nama klinik belum tampil ke pasien.
            </p>
          )}
          <Button size="sm" variant="outline" onClick={refresh} disabled={busy}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Periksa koneksi
          </Button>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <Label>WhatsApp Business Account ID (WABA ID)</Label>
          <Input inputMode="numeric" value={form.waba_id} onChange={(e) => setForm({ ...form, waba_id: e.target.value })} />
        </div>
        <div>
          <Label>Phone Number ID</Label>
          <Input inputMode="numeric" value={form.phone_number_id} onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })} />
        </div>
        <div>
          <Label>Access Token (System User, permanen)</Label>
          <Input type="password" autoComplete="off" value={form.access_token}
            placeholder={acc ? 'Kosongkan bila tidak diganti' : 'EAAG…'}
            onChange={(e) => setForm({ ...form, access_token: e.target.value })} />
          <p className="text-xs text-slate-500 mt-1">
            Token disimpan terenkripsi di server dan tidak pernah ditampilkan lagi. Buat dari Meta Business Settings →
            System Users, izin <code>whatsapp_business_management</code> dan <code>whatsapp_business_messaging</code>.
          </p>
        </div>
        <Button onClick={save} disabled={busy || !form.waba_id || !form.phone_number_id}>
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plug className="w-4 h-4 mr-2" />}
          {acc ? 'Perbarui koneksi' : 'Hubungkan'}
        </Button>
      </div>

      <div className="border border-slate-200 rounded-app p-4 space-y-2">
        <p className="text-sm font-medium text-slate-800">Webhook (didaftarkan sekali di Meta)</p>
        <div className="flex gap-2">
          <Input readOnly value={webhookUrl} />
          <Button variant="outline" size="icon" onClick={() => navigator.clipboard?.writeText(webhookUrl)}><Copy className="w-4 h-4" /></Button>
        </div>
        <p className="text-xs text-slate-500">
          Meta App → WhatsApp → Configuration → Webhook. Isi Callback URL di atas dan Verify Token sesuai secret
          <code> META_WEBHOOK_VERIFY_TOKEN</code>, lalu subscribe field <code>messages</code>, <code>message_template_status_update</code>, dan untuk coexistence juga <code>smb_message_echoes</code>, <code>history</code>, <code>smb_app_state_sync</code>.
        </p>
      </div>
    </div>
  );
};

// ───────────────────────── Template ─────────────────────────
const TemplatesTab = () => {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: '', category: 'UTILITY', body: '', examples: '', footer_text: '' });

  const load = useCallback(async () => {
    const { data } = await supabase.from('wa_meta_templates').select('*').order('created_at', { ascending: false });
    setRows(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const sync = async () => {
    setBusy(true);
    try { const r = await waSyncTemplates(); toast({ title: `${r.synced} template disinkronkan` }); await load(); }
    catch (e) { fail('Gagal sinkron', e); } finally { setBusy(false); }
  };

  const create = async () => {
    setBusy(true);
    try {
      await waCreateTemplate({
        ...f,
        examples: f.examples.split('\n').map((s) => s.trim()).filter(Boolean),
      });
      toast({ title: 'Template diajukan ke Meta', description: 'Persetujuan biasanya beberapa menit sampai 24 jam.' });
      setF({ name: '', category: 'UTILITY', body: '', examples: '', footer_text: '' });
      await load();
    } catch (e) { fail('Gagal membuat template', e); } finally { setBusy(false); }
  };

  const remove = async (name) => {
    if (!window.confirm(`Hapus template "${name}" dari Meta? Semua bahasa dengan nama ini ikut terhapus.`)) return;
    try { await waDeleteTemplate(name); await load(); } catch (e) { fail('Gagal menghapus', e); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">Template wajib disetujui Meta sebelum bisa dipakai di luar jendela 24 jam.</p>
        <Button variant="outline" size="sm" onClick={sync} disabled={busy}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${busy ? 'animate-spin' : ''}`} /> Sinkronkan dari Meta
        </Button>
      </div>

      <div className="grid gap-3">
        {rows.length === 0 && <p className="text-sm text-slate-500">Belum ada template.</p>}
        {rows.map((t) => (
          <div key={t.id} className="border border-slate-200 rounded-app p-3 bg-white">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-sm font-medium truncate">{t.name}</span>
                <Badge className={STATUS_STYLE[t.status] || ''}>{t.status}</Badge>
                <span className="text-xs text-slate-400">{t.category} · {t.language}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(t.name)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
            </div>
            <p className="text-xs text-slate-600 mt-1.5 whitespace-pre-wrap">{t.components?.find((c) => c.type === 'BODY')?.text}</p>
            {t.rejected_reason && <p className="text-xs text-red-600 mt-1">Ditolak: {t.rejected_reason}</p>}
          </div>
        ))}
      </div>

      <div className="border border-slate-200 rounded-app p-4 space-y-3 max-w-2xl">
        <p className="font-medium text-slate-800 text-sm">Ajukan template baru</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Nama (huruf kecil, angka, _)</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} placeholder="pengingat_terapi" />
          </div>
          <div>
            <Label>Kategori</Label>
            <select className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white" value={f.category}
              onChange={(e) => setF({ ...f, category: e.target.value })}>
              <option value="UTILITY">Utility (pengingat, konfirmasi)</option>
              <option value="MARKETING">Marketing (promo, sapaan)</option>
            </select>
          </div>
        </div>
        <div>
          <Label>Isi pesan — variabel pakai {'{{1}}'}, {'{{2}}'}, …</Label>
          <Textarea rows={5} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })}
            placeholder={'Halo {{1}}, mengingatkan jadwal terapi Anda pada {{2}} pukul {{3}}.'} />
        </div>
        <div>
          <Label>Contoh isi variabel (satu per baris, urut)</Label>
          <Textarea rows={3} value={f.examples} onChange={(e) => setF({ ...f, examples: e.target.value })}
            placeholder={'Ibu Sari\nSelasa, 3 November\n10.00'} />
        </div>
        <div>
          <Label>Footer (opsional)</Label>
          <Input value={f.footer_text} onChange={(e) => setF({ ...f, footer_text: e.target.value })} />
        </div>
        <Button onClick={create} disabled={busy || !f.name || !f.body}>
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />} Ajukan ke Meta
        </Button>
      </div>
    </div>
  );
};

// ───────────────────────── Broadcast ─────────────────────────
const BroadcastTab = () => {
  const [templates, setTemplates] = useState([]);
  const [list, setList] = useState([]);
  const [name, setName] = useState('');
  const [tpl, setTpl] = useState('');
  const [raw, setRaw] = useState('');
  const [running, setRunning] = useState(null); // {id, remaining, total}
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: t }, { data: b }] = await Promise.all([
      supabase.from('wa_meta_templates').select('name, language, components').eq('status', 'APPROVED'),
      supabase.from('wa_broadcasts').select('*').order('created_at', { ascending: false }).limit(10),
    ]);
    setTemplates(t || []);
    setList(b || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadPatients = async () => {
    const { data, error } = await supabase.from('patients').select('id, full_name, nickname, phone').not('phone', 'is', null).limit(2000);
    if (error) { fail('Gagal memuat pasien', error); return; }
    setRaw((data || []).filter((p) => (p.phone || '').replace(/\D/g, '').length >= 9)
      .map((p) => `${p.phone}, ${p.nickname || p.full_name}`).join('\n'));
  };

  const parseRecipients = () => raw.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [phone, ...params] = l.split(',').map((s) => s.trim());
    return { phone, params };
  });

  const loop = async (id, total) => {
    let remaining = total;
    setRunning({ id, remaining, total });
    try {
      while (remaining > 0) {
        const r = await waProcessBroadcast(id, 30);
        remaining = r.remaining;
        setRunning({ id, remaining, total });
        if (r.status && r.status !== 'running') break;
      }
      toast({ title: 'Broadcast selesai' });
    } catch (e) { fail('Broadcast berhenti', e); }
    setRunning(null);
    load();
  };

  const start = async () => {
    const recipients = parseRecipients();
    if (!window.confirm(`Kirim "${tpl}" ke ${recipients.length} nomor?`)) return;
    setBusy(true);
    try {
      const r = await waCreateBroadcast({ name, template: tpl, language: 'id', recipients });
      setRaw(''); setName('');
      loop(r.broadcast_id, r.total);
    } catch (e) { fail('Gagal membuat broadcast', e); } finally { setBusy(false); }
  };

  const tplBody = templates.find((t) => t.name === tpl)?.components?.find((c) => c.type === 'BODY')?.text || '';

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>Nama broadcast</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div>
            <Label>Template (APPROVED)</Label>
            <select className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white" value={tpl} onChange={(e) => setTpl(e.target.value)}>
              <option value="">Pilih…</option>
              {templates.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </div>
        </div>
        {tplBody && <p className="text-xs text-slate-600 bg-slate-50 rounded-md p-2 whitespace-pre-wrap">{tplBody}</p>}
        <div>
          <div className="flex items-center justify-between">
            <Label>Penerima — satu per baris: <code>nomor, isi {'{{1}}'}, isi {'{{2}}'}</code></Label>
            <Button variant="link" size="sm" onClick={loadPatients}>Isi dari data pasien</Button>
          </div>
          <Textarea rows={8} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={'08123456789, Ibu Sari'} />
          <p className="text-xs text-slate-500 mt-1">{parseRecipients().length} baris. Nomor ganda otomatis digabung.</p>
        </div>
        <Button onClick={start} disabled={busy || !!running || !tpl || !name || !raw.trim()}>
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />} Kirim broadcast
        </Button>
        {running && (
          <div className="text-sm text-slate-700 flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin" /> Terkirim {running.total - running.remaining} / {running.total}
            <Button size="sm" variant="outline" onClick={() => waCancelBroadcast(running.id)}>Batalkan</Button>
          </div>
        )}
        <p className="text-xs text-slate-500">
          Biarkan halaman ini terbuka sampai selesai. Batas harian Meta berlaku per nomor (mulai 250 pasien unik/hari
          untuk bisnis yang belum terverifikasi).
        </p>
      </div>

      <div className="space-y-2">
        <p className="font-medium text-sm text-slate-800">Riwayat</p>
        {list.map((b) => <BroadcastRow key={b.id} b={b} onResume={() => loop(b.id, b.total)} />)}
      </div>
    </div>
  );
};

const BroadcastRow = ({ b, onResume }) => {
  const [stat, setStat] = useState(null);
  useEffect(() => {
    supabase.from('wa_broadcast_recipients').select('status').eq('broadcast_id', b.id).limit(5000)
      .then(({ data }) => {
        const c = { pending: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
        (data || []).forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
        setStat(c);
      });
  }, [b.id, b.status]);
  return (
    <div className="border border-slate-200 rounded-app p-3 text-sm flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium truncate">{b.name} <span className="text-xs text-slate-400 font-normal">· {b.template_name}</span></p>
        {stat && (
          <p className="text-xs text-slate-500">
            {b.total} penerima · terkirim {stat.sent + stat.delivered + stat.read} · dibaca {stat.read} · gagal {stat.failed} · menunggu {stat.pending}
          </p>
        )}
      </div>
      {b.status === 'running' && stat?.pending > 0
        ? <Button size="sm" variant="outline" onClick={onResume}>Lanjutkan</Button>
        : <Badge variant="outline">{b.status}</Badge>}
    </div>
  );
};

const WhatsAppCloudPanel = () => (
  <div className="bg-white p-6 rounded-app border border-slate-200 shadow-sm">
    <div className="mb-4">
      <h3 className="text-lg font-bold text-slate-800">WhatsApp Cloud API (langsung ke Meta)</h3>
      <p className="text-sm text-slate-500">Koneksi resmi tanpa vendor perantara: inbox, template, dan broadcast.</p>
    </div>
    <Tabs defaultValue="connection">
      <TabsList className="mb-4">
        <TabsTrigger value="connection">Koneksi</TabsTrigger>
        <TabsTrigger value="templates">Template</TabsTrigger>
        <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
      </TabsList>
      <TabsContent value="connection"><ConnectionTab /></TabsContent>
      <TabsContent value="templates"><TemplatesTab /></TabsContent>
      <TabsContent value="broadcast"><BroadcastTab /></TabsContent>
    </Tabs>
  </div>
);

export default WhatsAppCloudPanel;
