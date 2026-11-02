import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Check, X, ExternalLink, Settings2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

// Halaman staf Misi Kaffah: pengaturan program + antrean verifikasi bukti misi pasien.
// Dipakai halaman admin dan owner. Akses data dibatasi RLS per klinik.
// Skema: supabase/migrations/20261102100000_kaffah_misi_loyalty.sql
const MISSION_LABEL = {
  google_review: 'Ulasan Google',
  ig_follow: 'Follow Instagram',
  ig_story_tag: 'Story & tag Instagram',
};
const FILTERS = [['pending', 'Menunggu'], ['approved', 'Disetujui'], ['rejected', 'Ditolak']];
const nameOf = (p) => p?.nickname || p?.full_name || 'Pasien';
const fmt = (iso) =>
  new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(':', '.');

const SettingsCard = ({ clinicId }) => {
  const { toast } = useToast();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clinicId) return;
    supabase.from('loyalty_settings').select('*').eq('clinic_id', clinicId).maybeSingle()
      .then(({ data }) => setForm(data || { clinic_id: clinicId, enabled: false, google_review_url: '', instagram_url: '', instagram_handle: '' }));
  }, [clinicId]);

  if (!form) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    if (form.enabled && !form.google_review_url?.trim() && !form.instagram_url?.trim()) {
      toast({ variant: 'destructive', title: 'Isi tautan Google/Instagram dulu', description: 'Tautan dibutuhkan pasien untuk menyelesaikan misi.' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('loyalty_settings').upsert({
      clinic_id: clinicId,
      enabled: !!form.enabled,
      google_review_url: form.google_review_url?.trim() || null,
      instagram_url: form.instagram_url?.trim() || null,
      instagram_handle: form.instagram_handle?.trim().replace(/^@/, '') || null,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    toast(error ? { variant: 'destructive', title: 'Gagal menyimpan', description: error.message } : { title: 'Pengaturan disimpan' });
  };

  return (
    <section className="rounded-2xl border bg-white p-4 space-y-3">
      <div className="flex items-center gap-2 font-semibold"><Settings2 className="h-4 w-4" /> Pengaturan program</div>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Aktifkan Misi Kaffah di portal pasien</span>
        <Switch checked={!!form.enabled} onCheckedChange={(v) => set('enabled', v)} />
      </label>
      <div className="grid gap-3 md:grid-cols-3">
        <div><label className="text-xs text-muted-foreground">Tautan ulasan Google</label>
          <Input value={form.google_review_url || ''} onChange={(e) => set('google_review_url', e.target.value)} placeholder="https://g.page/r/.../review" /></div>
        <div><label className="text-xs text-muted-foreground">Tautan Instagram</label>
          <Input value={form.instagram_url || ''} onChange={(e) => set('instagram_url', e.target.value)} placeholder="https://instagram.com/kaffah..." /></div>
        <div><label className="text-xs text-muted-foreground">Username Instagram</label>
          <Input value={form.instagram_handle || ''} onChange={(e) => set('instagram_handle', e.target.value)} placeholder="@kaffah..." /></div>
      </div>
      <p className="text-xs text-muted-foreground">
        Ulasan Google dipersyaratkan jujur, rating apa pun. Jangan mensyaratkan bintang tertentu: Google melarangnya dan ulasan bisa dihapus.
      </p>
      <Button onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
    </section>
  );
};

const LoyaltyMissionsContent = () => {
  const { userDetails } = useAuth();
  const { toast } = useToast();
  const clinicId = userDetails?.clinic_id;
  const [filter, setFilter] = useState('pending');
  const [rows, setRows] = useState([]);
  const [proofs, setProofs] = useState({});
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState(null); // id misi yang sedang ditolak
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('loyalty_missions')
      .select('id, patient_id, mission_type, status, proof_path, reject_reason, submitted_at, patients(full_name, nickname)')
      .eq('clinic_id', clinicId).eq('status', filter)
      .order('submitted_at', { ascending: filter === 'pending' }).limit(100);
    if (error) { toast({ variant: 'destructive', title: 'Gagal memuat', description: error.message }); setLoading(false); return; }
    setRows(data || []);
    const paths = (data || []).map((r) => r.proof_path).filter(Boolean);
    if (paths.length) {
      const { data: signed } = await supabase.storage.from('loyalty-proofs').createSignedUrls(paths, 3600);
      setProofs(Object.fromEntries((signed || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl])));
    } else setProofs({});
    setLoading(false);
  }, [clinicId, filter, toast]);

  useEffect(() => { load(); }, [load]);

  const review = async (id, approve, why = null) => {
    setBusyId(id);
    const { error } = await supabase.rpc('loyalty_review_mission', { p_id: id, p_approve: approve, p_reason: why });
    setBusyId(null);
    if (error) { toast({ variant: 'destructive', title: 'Gagal', description: error.message }); return; }
    toast({ title: approve ? 'Misi disetujui' : 'Misi ditolak' });
    setRejecting(null); setReason('');
    load();
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold">Misi Kaffah</h1>
        <p className="text-sm text-muted-foreground">Verifikasi bukti misi pasien. Periksa tangkapan layar sebelum menyetujui.</p>
      </div>

      <SettingsCard clinicId={clinicId} />

      <div className="flex gap-2">
        {FILTERS.map(([k, label]) => (
          <Button key={k} size="sm" variant={filter === k ? 'default' : 'outline'} onClick={() => setFilter(k)}>{label}</Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Tidak ada misi di daftar ini.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <article key={r.id} className="rounded-2xl border bg-white p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{nameOf(r.patients)}</div>
                  <div className="text-xs text-muted-foreground">{fmt(r.submitted_at)}</div>
                </div>
                <Badge variant="secondary">{MISSION_LABEL[r.mission_type] || r.mission_type}</Badge>
              </div>
              {proofs[r.proof_path] ? (
                <a href={proofs[r.proof_path]} target="_blank" rel="noopener noreferrer" className="block">
                  <img src={proofs[r.proof_path]} alt={`Bukti ${MISSION_LABEL[r.mission_type]}`} loading="lazy"
                    className="max-h-72 w-full rounded-lg border object-contain bg-slate-50" />
                  <span className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600"><ExternalLink className="h-3 w-3" /> Buka ukuran penuh</span>
                </a>
              ) : <p className="text-xs text-muted-foreground">Bukti tidak tersedia.</p>}
              {r.status === 'rejected' && r.reject_reason && <p className="text-xs text-red-600">Ditolak: {r.reject_reason}</p>}
              {r.status === 'pending' && (rejecting === r.id ? (
                <div className="space-y-2">
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Alasan penolakan (wajib), mis. tangkapan layar kurang jelas" />
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" disabled={busyId === r.id || !reason.trim()} onClick={() => review(r.id, false, reason)}>Tolak</Button>
                    <Button size="sm" variant="outline" onClick={() => { setRejecting(null); setReason(''); }}>Batal</Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" disabled={busyId === r.id} onClick={() => review(r.id, true)}><Check className="mr-1 h-4 w-4" /> Setujui</Button>
                  <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => setRejecting(r.id)}><X className="mr-1 h-4 w-4" /> Tolak</Button>
                </div>
              ))}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default LoyaltyMissionsContent;
