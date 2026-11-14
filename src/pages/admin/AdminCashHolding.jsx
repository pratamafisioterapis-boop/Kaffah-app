import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Wallet, Loader2, Check, X, Upload, Eye, Undo2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { KAFFAH_CLINIC_ID } from '@/lib/clinicIds';
import { confirmAction } from '@/lib/confirmAction';

const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const todayStr = () => format(new Date(), 'yyyy-MM-dd');
const fmtDate = (d) => { try { return format(parseISO(d), 'd MMM yyyy', { locale: localeId }); } catch { return d || '-'; } };
const daysSince = (d) => { try { return Math.floor((Date.now() - parseISO(d).getTime()) / 86400000); } catch { return 0; } };
const STALE_DAYS = 2;
// Penanda setoran yang dicatat manual tanpa foto (pencatatan awal).
const NO_PROOF = 'tanpa-foto';

const STATUS = {
  pending: { label: 'Menunggu konfirmasi', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  confirmed: { label: 'Dikonfirmasi', cls: 'bg-green-100 text-green-700 border-green-200' },
  rejected: { label: 'Ditolak', cls: 'bg-red-100 text-red-700 border-red-200' },
  cancelled: { label: 'Dibatalkan', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const Stat = ({ label, value, tone = 'text-slate-900', hint }) => (
  <div className="rounded-xl border bg-white p-4">
    <p className="text-xs text-slate-500">{label}</p>
    <p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
    {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
  </div>
);

const AdminCashHolding = () => {
  const { userDetails } = useAuth();
  const { toast } = useToast();
  const role = userDetails?.role;
  const isAdmin = role === 'admin';
  const isKaffah = userDetails?.clinic_id === KAFFAH_CLINIC_ID;

  const [loading, setLoading] = useState(true);
  const [holdings, setHoldings] = useState([]);
  const [handovers, setHandovers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [custodianId, setCustodianId] = useState(null);
  const [petty, setPetty] = useState(null);
  const [pettyExpenses, setPettyExpenses] = useState([]);
  const [names, setNames] = useState({});
  const [detail, setDetail] = useState([]);
  const [patientNames, setPatientNames] = useState({});
  const [showDetail, setShowDetail] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  const emptyForm = { toType: 'admin', toUser: '', amount: '', replenish: '', date: todayStr(), note: '', file: null };
  const [form, setForm] = useState(emptyForm);

  const me = holdings.find((h) => h.user_id === userDetails?.id);
  const myBalance = Number(me?.balance || 0);

  const load = useCallback(async () => {
    if (!userDetails?.id) return;
    setLoading(true);
    try {
      const [h, ho, ad, cfg, pt, pe] = await Promise.all([
        supabase.rpc('get_cash_holdings'),
        supabase.from('cash_handovers').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('users').select('id, full_name, is_active').eq('clinic_id', userDetails.clinic_id).eq('role', 'admin'),
        supabase.from('cash_ledger_config').select('custodian_user_id').eq('clinic_id', userDetails.clinic_id).maybeSingle(),
        supabase.rpc('get_petty_cash'),
        supabase.from('admin_expenses').select('id, transaction_date, amount, sub_category, description, created_at').eq('paid_from_petty', true).order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(8),
      ]);
      setPetty(pt.error ? null : (pt.data?.[0] || null));
      setPettyExpenses(pe.error ? [] : (pe.data || []));
      if (h.error) throw h.error;
      if (ho.error) throw ho.error;
      setHoldings(h.data || []);
      setHandovers(ho.data || []);
      
      const adminList = ad.data || [];
      setAdmins(adminList);
      const cid = cfg.data?.custodian_user_id || null;
      // pemegang kas utama yang sudah nonaktif dianggap belum ditandai
      setCustodianId(cid && adminList.some((x) => x.id === cid && x.is_active !== false) ? cid : null);
      setNames(Object.fromEntries(adminList.map((a) => [a.id, a.full_name])));
    } catch (e) {
      toast({ title: 'Gagal memuat data cash', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [userDetails?.id, userDetails?.clinic_id, toast]);

  useEffect(() => { load(); }, [load]);

  const loadDetail = useCallback(async () => {
    if (!isAdmin || !userDetails?.id) return;
    const { data, error } = await supabase.rpc('get_cash_received_detail', { p_user: userDetails.id });
    if (error) { toast({ title: 'Gagal memuat rincian', description: error.message, variant: 'destructive' }); return; }
    setDetail(data || []);
    const ids = [...new Set((data || []).map((d) => d.patient_id).filter(Boolean))];
    if (ids.length) {
      const { data: pts } = await supabase.from('patients').select('id, full_name').in('id', ids);
      setPatientNames(Object.fromEntries((pts || []).map((p) => [p.id, p.full_name])));
    }
  }, [isAdmin, userDetails?.id, toast]);

  useEffect(() => { if (showDetail) loadDetail(); }, [showDetail, loadDetail]);

  const nameOf = (id) => names[id] || holdings.find((h) => h.user_id === id)?.full_name || 'Admin';
  // Admin nonaktif tidak muncul sebagai penerima. Bila pemegang kas utama sudah ditandai,
  // hanya dia penerima setoran antar admin.
  const activeAdmins = admins.filter((a) => a.is_active !== false);
  const otherAdmins = activeAdmins.filter((a) => a.id !== userDetails?.id && (!custodianId || a.id === custodianId));
  const iAmCustodian = !!custodianId && custodianId === userDetails?.id;
  const canToAdmin = otherAdmins.length > 0;
  const canToFinance = !custodianId || iAmCustodian;

  const incomingPending = useMemo(
    () => handovers.filter((x) => x.status === 'pending' && x.to_user_id === userDetails?.id),
    [handovers, userDetails?.id]
  );
  const visibleHandovers = useMemo(
    () => (isAdmin ? handovers.filter((x) => x.from_user_id === userDetails?.id || x.to_user_id === userDetails?.id) : handovers),
    [handovers, isAdmin, userDetails?.id]
  );

  const pettyNeeded = Number(petty?.needed || 0);
  // Default isi ulang kas kecil: sebesar yang dibutuhkan (maks. cash pendapatan yang dipegang);
  // nominal setor = sisa cash pendapatan setelah isi ulang.
  const defaultsFor = (toType) => {
    const bal = Math.max(0, Math.round(myBalance));
    const repl = toType === 'finance' ? Math.min(Math.round(pettyNeeded), bal) : 0;
    return { amount: bal > 0 ? String(bal - repl) : '', replenish: repl > 0 ? String(repl) : '' };
  };

  const openDialog = () => {
    const last = (() => { try { return localStorage.getItem('cashHandoverLastTo') || ''; } catch { return ''; } })();
    const preset = otherAdmins.find((a) => a.id === last)?.id || (otherAdmins.length === 1 ? otherAdmins[0].id : '');
    const type = canToAdmin ? 'admin' : 'finance';
    setForm({ ...emptyForm, toType: type, toUser: preset, ...defaultsFor(type) });
    setDialogOpen(true);
  };

  const submit = async () => {
    const amount = parseFloat(form.amount) || 0;
    const repl = form.toType === 'finance' ? (parseFloat(form.replenish) || 0) : 0;
    if (amount < 0 || repl < 0 || amount + repl <= 0) return toast({ title: 'Nominal belum diisi', variant: 'destructive' });
    if (form.toType === 'admin' && amount <= 0) return toast({ title: 'Nominal belum diisi', variant: 'destructive' });
    if (repl > pettyNeeded) return toast({ title: 'Isi ulang kas kecil melebihi yang dibutuhkan', description: `Dibutuhkan ${formatRp(pettyNeeded)}`, variant: 'destructive' });
    if (amount + repl > myBalance) return toast({ title: 'Total melebihi cash pendapatan yang dipegang', description: `Saldo Anda ${formatRp(myBalance)}`, variant: 'destructive' });
    if (form.toType === 'admin' && !form.toUser) return toast({ title: 'Pilih admin penerima', variant: 'destructive' });
    if (!form.file) return toast({ title: 'Foto bukti wajib untuk setiap setoran', variant: 'destructive' });

    setBusy(true);
    try {
      let proofPath = null;
      if (form.file) {
        const ext = (form.file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        proofPath = `${userDetails.clinic_id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('payment-proofs').upload(proofPath, form.file, { contentType: form.file.type });
        if (upErr) throw new Error(`Gagal mengunggah bukti: ${upErr.message}`);
      }
      const { error } = await supabase.rpc('create_cash_handover', {
        p_to_type: form.toType,
        p_to_user: form.toType === 'admin' ? form.toUser : null,
        p_amount: amount,
        p_petty_replenish: repl,
        p_date: form.date,
        p_note: form.note || null,
        p_proof: proofPath,
      });
      if (error) throw error;
      if (form.toType === 'admin') { try { localStorage.setItem('cashHandoverLastTo', form.toUser); } catch { /* abaikan */ } }
      toast({ title: form.toType === 'admin' ? 'Setoran terkirim, menunggu konfirmasi penerima' : 'Setoran ke keuangan tercatat' });
      setDialogOpen(false);
      load();
      if (showDetail) loadDetail();
    } catch (e) {
      toast({ title: 'Gagal menyimpan setoran', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const saveCustodian = async (value) => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc('set_cash_custodian', { p_user: value === 'none' ? null : value });
      if (error) throw error;
      toast({ title: value === 'none' ? 'Penanda pemegang kas utama dihapus' : 'Pemegang kas utama disimpan' });
      load();
    } catch (e) {
      toast({ title: 'Gagal menyimpan pemegang kas utama', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (id, action, reason) => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc('resolve_cash_handover', { p_id: id, p_action: action, p_reason: reason || null });
      if (error) throw error;
      toast({ title: action === 'confirm' ? 'Setoran dikonfirmasi' : action === 'reject' ? 'Setoran ditolak' : 'Setoran dibatalkan' });
      setRejectTarget(null);
      setRejectReason('');
      load();
    } catch (e) {
      toast({ title: 'Gagal memproses setoran', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (x) => {
    if (!(await confirmAction(`Konfirmasi sudah menerima ${formatRp(x.amount)} dari ${nameOf(x.from_user_id)}? Pastikan uang fisik sudah dihitung.`))) return;
    resolve(x.id, 'confirm');
  };
  const cancel = async (x) => {
    if (!(await confirmAction(`Batalkan setoran ${formatRp(x.amount)}? Saldo Anda akan kembali.`))) return;
    resolve(x.id, 'cancel');
  };

  const viewProof = async (path) => {
    const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 600);
    if (error || !data?.signedUrl) return toast({ title: 'Gagal membuka bukti', variant: 'destructive' });
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  if (!isKaffah) {
    return <div className="p-6 text-sm text-slate-500">Fitur ini hanya tersedia untuk Kaffah Physiotherapy.</div>;
  }

  const pendingTotal = handovers.filter((x) => x.status === 'pending').reduce((s, x) => s + Number(x.amount || 0), 0);
  const myPendingOut = handovers
    .filter((x) => x.status === 'pending' && x.from_user_id === userDetails?.id)
    .reduce((s, x) => s + Number(x.amount || 0), 0);
  const totalHeld = holdings.reduce((s, h) => s + Number(h.balance || 0), 0);
  const totalToFinance = holdings.reduce((s, h) => s + Number(h.to_finance || 0), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <Helmet><title>Cash Dipegang | Kaffah</title></Helmet>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900"><Wallet className="h-5 w-5" /> Cash Dipegang Admin</h1>
          <p className="text-sm text-slate-500">Cash dari pembayaran pasien yang belum disetor ke keuangan. Cash tips terapis tidak dihitung.</p>
        </div>
        {isAdmin && (
          <Button onClick={openDialog} disabled={loading || myBalance <= 0 || (!canToAdmin && !canToFinance)}>
            <Wallet className="mr-2 h-4 w-4" /> Setor Cash
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : holdings.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-slate-500">Pencatatan cash belum aktif untuk klinik ini.</div>
      ) : (
        <>
          {petty && (
            <section className="rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold"><Wallet className="h-4 w-4" /> Kas Kecil</h2>
                  <p className="text-xs text-slate-500">
                    Modal dari keuangan untuk pembelian cash. Setelah setor pendapatan, kas kecil kembali ke {formatRp(petty.plafon)}; pembelian tadi dipotong dari setoran.
                  </p>
                </div>
                {Number(petty.balance) < Number(petty.plafon) / 3 && (
                  <Badge variant="outline" className="border-red-300 text-red-700"><AlertTriangle className="mr-1 h-3 w-3" />Sisa kas kecil menipis</Badge>
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <Stat label="Sisa kas kecil" value={formatRp(petty.balance)} tone={Number(petty.balance) < 0 ? 'text-red-600' : 'text-emerald-700'} />
                <Stat label="Plafon" value={formatRp(petty.plafon)} />
                <Stat label="Belum diganti dari setoran" value={formatRp(petty.needed)} tone={pettyNeeded > 0 ? 'text-amber-700' : 'text-slate-900'} />
              </div>
              {pettyExpenses.length > 0 && (
                <div className="mt-3 divide-y rounded-lg border text-sm">
                  {pettyExpenses.map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="min-w-0 truncate">{fmtDate(e.transaction_date)} · {e.sub_category || 'Pengeluaran'}{e.description ? ` · ${e.description}` : ''}</span>
                      <span className="shrink-0 tabular-nums text-red-600">-{formatRp(e.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {isAdmin ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Cash yang saya pegang" value={formatRp(myBalance)} tone={myBalance < 0 ? 'text-red-600' : 'text-emerald-700'} hint={myBalance < 0 ? 'Negatif: cek rekap yang direvisi' : (myPendingOut > 0 ? `Belum termasuk ${formatRp(myPendingOut)} yang menunggu konfirmasi penerima` : undefined)} />
              <Stat label="Diterima dari pasien" value={formatRp(me?.cash_received)} />
              <Stat label="Diterima dari admin lain" value={formatRp(me?.handover_in)} />
              <Stat label="Sudah saya setor" value={formatRp(me?.handover_out)} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Stat label="Total cash di tangan admin" value={formatRp(totalHeld)} tone="text-emerald-700" />
              <Stat label="Sudah disetor ke keuangan" value={formatRp(totalToFinance)} />
              <Stat label="Dalam proses setor (pending)" value={formatRp(pendingTotal)} tone="text-amber-700" hint="Sudah keluar dari pengirim, belum dikonfirmasi penerima" />
            </div>
          )}

          {role === 'owner' && (
            <section className="rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Pemegang kas utama (Admin 1)</h2>
                  <p className="text-xs text-slate-500">Admin lain hanya bisa setor ke akun ini. Setoran ke keuangan juga hanya oleh akun ini. Admin nonaktif tidak bisa dipilih.</p>
                </div>
                <Select value={custodianId || 'none'} onValueChange={saveCustodian} disabled={busy}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Belum ditandai (semua admin)</SelectItem>
                    {activeAdmins.map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </section>
          )}

          {!isAdmin && (
            <section className="rounded-xl border bg-white">
              <h2 className="border-b px-4 py-3 text-sm font-semibold">Saldo per admin</h2>
              <div className="divide-y">
                {holdings.map((h) => {
                  const age = h.oldest_cash_date && Number(h.balance) > 0 ? daysSince(h.oldest_cash_date) : 0;
                  return (
                    <div key={h.user_id ?? 'none'} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                      <div>
                        <p className="font-medium">
                          {h.full_name || 'Tanpa kasir tercatat'}
                          {h.is_custodian && <Badge variant="outline" className="ml-2 border-emerald-300 text-emerald-700">Pemegang kas utama</Badge>}
                          {h.user_id && h.is_active === false && <Badge variant="outline" className="ml-2 border-slate-300 text-slate-500">Nonaktif</Badge>}
                        </p>
                        <p className="text-xs text-slate-500">
                          Terima {formatRp(h.cash_received)} · dari admin {formatRp(h.handover_in)} · disetor {formatRp(h.handover_out)}
                          {Number(h.pending_in) > 0 && ` · menunggu konfirmasi ${formatRp(h.pending_in)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {h.is_active === false && Number(h.balance) !== 0 && <Badge variant="outline" className="border-red-300 text-red-700"><AlertTriangle className="mr-1 h-3 w-3" />akun nonaktif masih pegang uang</Badge>}
                        {age > STALE_DAYS && <Badge variant="outline" className="border-amber-300 text-amber-700"><AlertTriangle className="mr-1 h-3 w-3" />cash tertua {age} hari</Badge>}
                        <span className={`font-semibold tabular-nums ${Number(h.balance) < 0 ? 'text-red-600' : ''}`}>{formatRp(h.balance)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {isAdmin && incomingPending.length > 0 && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h2 className="mb-2 text-sm font-semibold text-amber-800">Setoran masuk menunggu konfirmasi Anda</h2>
              <div className="space-y-2">
                {incomingPending.map((x) => (
                  <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 text-sm">
                    <div>
                      <p className="font-medium">{nameOf(x.from_user_id)} · {formatRp(x.amount)}</p>
                      <p className="text-xs text-slate-500">{fmtDate(x.handover_date)}{x.note ? ` · ${x.note}` : ''}</p>
                    </div>
                    <div className="flex gap-2">
                      {x.proof_path && x.proof_path !== NO_PROOF && <Button size="sm" variant="outline" onClick={() => viewProof(x.proof_path)}><Eye className="mr-1 h-3.5 w-3.5" />Bukti</Button>}
                      <Button size="sm" disabled={busy} onClick={() => confirm(x)}><Check className="mr-1 h-3.5 w-3.5" />Konfirmasi</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setRejectTarget(x)}><X className="mr-1 h-3.5 w-3.5" />Tolak</Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {isAdmin && (
            <section className="rounded-xl border bg-white">
              <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold" onClick={() => setShowDetail((v) => !v)}>
                <span>Rincian cash yang saya terima dari pasien</span>
                <span className="text-xs font-normal text-slate-500">{showDetail ? 'Sembunyikan' : 'Tampilkan'}</span>
              </button>
              {showDetail && (
                <div className="overflow-x-auto border-t">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs text-slate-500">
                      <tr><th className="px-4 py-2">Tanggal</th><th className="px-4 py-2">Pasien</th><th className="px-4 py-2 text-right">Cash</th><th className="px-4 py-2 text-right">Tips (ke terapis)</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {detail.length === 0 && <tr><td colSpan={4} className="px-4 py-4 text-center text-slate-400">Belum ada cash masuk.</td></tr>}
                      {detail.map((d) => (
                        <tr key={d.recap_id}>
                          <td className="px-4 py-2">{fmtDate(d.cash_date)}</td>
                          <td className="px-4 py-2">{patientNames[d.patient_id] || '-'}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{formatRp(d.cash_amount)}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-slate-400">{Number(d.tips_excluded) > 0 ? formatRp(d.tips_excluded) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          <section className="rounded-xl border bg-white">
            <h2 className="border-b px-4 py-3 text-sm font-semibold">Riwayat setoran</h2>
            <div className="divide-y">
              {visibleHandovers.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">Belum ada setoran.</p>}
              {visibleHandovers.map((x) => {
                const st = STATUS[x.status] || STATUS.pending;
                const mineOut = x.from_user_id === userDetails?.id;
                return (
                  <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">
                        {nameOf(x.from_user_id)} → {x.to_type === 'finance' ? 'Tim Keuangan' : nameOf(x.to_user_id)} · {formatRp(x.amount)}{Number(x.petty_replenish) > 0 && ` + isi ulang kas kecil ${formatRp(x.petty_replenish)}`}
                      </p>
                      <p className="text-xs text-slate-500">
                        {fmtDate(x.handover_date)}{x.note ? ` · ${x.note}` : ''}{x.reject_reason ? ` · Ditolak: ${x.reject_reason}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                      {x.proof_path && x.proof_path !== NO_PROOF && <Button size="sm" variant="ghost" onClick={() => viewProof(x.proof_path)}><Eye className="h-4 w-4" /></Button>}
                      {isAdmin && mineOut && x.status === 'pending' && (
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => cancel(x)}><Undo2 className="mr-1 h-3.5 w-3.5" />Batalkan</Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Setor Cash</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Cash yang Anda pegang: <b>{formatRp(myBalance)}</b></p>

            <div className="space-y-1.5">
              <Label>Setor ke</Label>
              <Select value={form.toType} onValueChange={(v) => setForm((f) => ({ ...f, toType: v, ...defaultsFor(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {canToAdmin && <SelectItem value="admin">Pemegang kas utama (perlu konfirmasi)</SelectItem>}
                  {canToFinance && <SelectItem value="finance">Tim Keuangan (langsung tercatat)</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {form.toType === 'admin' && (
              <div className="space-y-1.5">
                <Label>{custodianId ? 'Penerima (pemegang kas utama)' : 'Admin penerima'}</Label>
                <Select value={form.toUser} onValueChange={(v) => setForm((f) => ({ ...f, toUser: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih admin" /></SelectTrigger>
                  <SelectContent>
                    {otherAdmins.map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{form.toType === 'finance' ? 'Disetor ke keuangan (Rp)' : 'Nominal (Rp)'}</Label>
                <Input type="number" inputMode="numeric" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Tanggal</Label>
                <Input type="date" value={form.date} max={todayStr()} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
            </div>

            {form.toType === 'finance' && pettyNeeded > 0 && (
              <div className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50 p-3">
                <Label>Isi ulang kas kecil dari pendapatan (Rp)</Label>
                <Input type="number" inputMode="numeric" value={form.replenish} onChange={(e) => setForm((f) => ({ ...f, replenish: e.target.value }))} />
                <p className="text-xs text-slate-600">
                  Pembelian dari kas kecil yang belum diganti: <b>{formatRp(pettyNeeded)}</b>. Uang ini tidak disetor, tetap Anda pegang agar kas kecil kembali {formatRp(petty?.plafon)}.
                  Total keluar dari cash pendapatan: <b>{formatRp((parseFloat(form.amount) || 0) + (parseFloat(form.replenish) || 0))}</b> dari {formatRp(myBalance)}.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Foto bukti <span className="text-red-500">*</span></Label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-slate-600">
                <Upload className="h-4 w-4" />
                <span className="truncate">{form.file ? form.file.name : 'Pilih foto / screenshot'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))} />
              </label>
            </div>

            <div className="space-y-1.5">
              <Label>Catatan (opsional)</Label>
              <Textarea rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>Batal</Button>
            <Button onClick={submit} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Kirim Setoran</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectReason(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Tolak setoran</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Alasan (mis. nominal fisik berbeda)</Label>
            <Textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={busy}>Batal</Button>
            <Button variant="destructive" disabled={busy || !rejectReason.trim()} onClick={() => resolve(rejectTarget.id, 'reject', rejectReason)}>Tolak</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCashHolding;
