import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  UploadCloud, CheckCircle2, AlertTriangle, QrCode, Loader2, Trash2, Link2, Unlink,
  ChevronLeft, ChevronRight, ChevronDown, Clock, FileText, User, Hourglass,
} from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { KAFFAH_CLINIC_ID } from '@/lib/clinicIds';
import { confirmAction } from '@/lib/confirmAction';
import { parseQrisReportPdf } from '@/utils/bsiQrisReportParser';
import { autoMatchQris, qrisPortionOfRecap } from '@/utils/qrisMatcher';

// Catatan: komentar ini hanya untuk mengubah hash aset build (bukan perubahan fungsi).
const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const todayStr = () => format(new Date(), 'yyyy-MM-dd');
const shiftDate = (d, delta) => format(addDays(parseISO(d), delta), 'yyyy-MM-dd');
const fmtLong = (d) => { try { return format(parseISO(d), 'EEEE, d MMMM yyyy', { locale: localeId }); } catch { return d; } };
const fmtClock = (v) => { try { return v ? format(new Date(v), 'HH:mm') : null; } catch { return null; } };
const toHHmm = (v) => {
  if (!v) return null;
  const m = String(v).match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return fmtClock(v);
};
// Nama file BSI: "..._261103_213315.pdf" = dibuat 3 Nov 2026 21:33:15.
const parseGeneratedAt = (name) => {
  const m = String(name || '').match(/_(\d{2})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.pdf$/i);
  if (!m) return null;
  const d = new Date(2000 + +m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return Number.isNaN(d.getTime()) ? null : d;
};

const getIssues = (parsed) => {
  const issues = [];
  const { meta, summary, transactions } = parsed;
  if (meta.merchantName && !/KAFFAH/i.test(meta.merchantName)) issues.push('Nama merchant di laporan bukan Kaffah Physiotherapy.');
  if (meta.periodStart && meta.periodEnd && meta.periodStart !== meta.periodEnd) issues.push('Periode laporan lebih dari satu hari. Disarankan mengunggah laporan per hari.');
  if (summary) {
    if (summary.count !== transactions.length) issues.push(`Jumlah transaksi terbaca (${transactions.length}) berbeda dari ringkasan laporan (${summary.count}).`);
    const sum = transactions.reduce((s, t) => s + t.amount, 0);
    if (Math.round(sum) !== Math.round(summary.totalAmount)) issues.push(`Total nominal terbaca (${formatRp(sum)}) berbeda dari ringkasan laporan (${formatRp(summary.totalAmount)}).`);
  }
  return issues;
};

const STATUS = {
  matched: { label: 'Cocok', cls: 'bg-green-100 text-green-700 border-green-200' },
  pending: { label: 'Menunggu laporan', cls: 'bg-sky-100 text-sky-700 border-sky-200' },
  missing: { label: 'Tidak ada di bank', cls: 'bg-red-100 text-red-700 border-red-200' },
};

const AdminQrisReconciliation = () => {
  const { toast } = useToast();
  const { user, userDetails } = useAuth();
  const clinicId = userDetails?.clinic_id || null;
  const isKaffah = clinicId === KAFFAH_CLINIC_ID;
  const fileInputRef = useRef(null);

  const [date, setDate] = useState(todayStr());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false); // membaca/menyimpan PDF
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState(null); // { fileName, parsed, issues } menunggu konfirmasi
  const [day, setDay] = useState({ uploads: [], transactions: [], portions: [], userNames: {} });
  const [openAdmins, setOpenAdmins] = useState({});

  // --- Data ------------------------------------------------------------------
  const loadQrisPortions = useCallback(async (d) => {
    const { data: options } = await supabase
      .from('operational_options').select('id, label').eq('clinic_id', clinicId).eq('category', 'payment_method');
    const qrisIds = new Set((options || []).filter((o) => /^\s*qris\s*$/i.test(o.label || '')).map((o) => String(o.id)));
    const isQrisMethod = (m) => !!m && (qrisIds.has(String(m)) || /^\s*qris\s*$/i.test(String(m)));

    const { data: recaps, error } = await supabase
      .from('daily_recaps')
      .select('id, revenue_date, amount, payment_method, patient_id, actual_patient_id, full_name, guest_name, start_time, end_time, created_at, cashier_id, created_by, status, payment_splits:daily_recap_payment_splits(payment_method, amount)')
      .eq('clinic_id', clinicId).eq('revenue_date', d).or('status.is.null,status.neq.cancelled');
    if (error) throw error;

    const patientIds = [...new Set((recaps || []).flatMap((r) => [r.patient_id, r.actual_patient_id]).filter(Boolean))];
    const patientMap = {};
    if (patientIds.length) {
      const { data: pts } = await supabase.from('patients').select('id, full_name').in('id', patientIds).eq('clinic_id', clinicId);
      (pts || []).forEach((p) => { patientMap[p.id] = p.full_name; });
    }
    // Cadangan penanggung jawab: admin yang mengisi TTV recap (bila recap dibuat owner/non-admin).
    const vitalByRecap = {};
    const recapIds = (recaps || []).map((r) => r.id);
    if (recapIds.length) {
      const { data: vitals } = await supabase.from('recap_vital_signs')
        .select('recap_id, recorded_by, created_at').in('recap_id', recapIds).not('recorded_by', 'is', null).order('created_at');
      (vitals || []).forEach((v) => { if (!vitalByRecap[v.recap_id]) vitalByRecap[v.recap_id] = v.recorded_by; });
    }
    const staffIds = [...new Set([
      ...(recaps || []).flatMap((r) => [r.cashier_id, r.created_by]),
      ...Object.values(vitalByRecap),
    ].filter(Boolean))];
    const staff = {};
    if (staffIds.length) {
      const { data: us } = await supabase.from('users').select('id, full_name, role').in('id', staffIds);
      (us || []).forEach((u) => { staff[u.id] = u; });
    }

    return (recaps || []).map((r) => {
      // Penanggung jawab = kasir (admin yang pertama kali menyimpan rekap); data lama pakai pembuat bila rolenya admin.
      const creatorIsAdmin = ['admin', 'clinic_admin'].includes(staff[r.created_by]?.role);
      const vitalBy = vitalByRecap[r.id];
      const vitalIsAdmin = ['admin', 'clinic_admin'].includes(staff[vitalBy]?.role);
      const cashierId = r.cashier_id || (creatorIsAdmin ? r.created_by : null) || (vitalIsAdmin ? vitalBy : null);
      const payAt = r.end_time || r.start_time || r.created_at;
      return {
        recapId: r.id,
        date: r.revenue_date,
        amount: qrisPortionOfRecap(r, isQrisMethod),
        name: patientMap[r.actual_patient_id] || patientMap[r.patient_id] || r.full_name || r.guest_name || '-',
        time: toHHmm(r.start_time),
        payAt: payAt ? new Date(payAt) : null,
        cashierId: cashierId || 'none',
        cashierName: cashierId ? (staff[cashierId]?.full_name || 'Admin') : 'Belum ada kasir',
      };
    }).filter((p) => p.amount > 0);
  }, [clinicId]);

  const persistMatches = useCallback(async (matches) => {
    const now = new Date().toISOString();
    await Promise.all(matches.map((m) => supabase.from('qris_report_transactions')
      .update({ matched_recap_id: m.recapId, match_method: 'auto', matched_at: now, matched_by: user?.id || null })
      .eq('id', m.transactionId).eq('clinic_id', clinicId)));
  }, [clinicId, user?.id]);

  const loadDay = useCallback(async (d) => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const [{ data: ups, error: e1 }, { data: trx, error: e2 }, portions] = await Promise.all([
        supabase.from('qris_report_uploads').select('*').eq('clinic_id', clinicId).eq('report_date', d).order('created_at'),
        supabase.from('qris_report_transactions').select('*').eq('clinic_id', clinicId).eq('trx_date', d).order('trx_time'),
        loadQrisPortions(d),
      ]);
      if (e1 || e2) throw e1 || e2;
      let transactions = trx || [];

      // Cocokkan otomatis yang belum berpasangan (mis. admin baru melengkapi recap setelah PDF diunggah).
      const used = new Set(transactions.map((t) => t.matched_recap_id).filter(Boolean));
      const { matches } = autoMatchQris(transactions.filter((t) => !t.matched_recap_id), portions.filter((p) => !used.has(p.recapId)));
      if (matches.length) {
        await persistMatches(matches);
        const byTx = Object.fromEntries(matches.map((m) => [m.transactionId, m.recapId]));
        transactions = transactions.map((t) => (byTx[t.id] ? { ...t, matched_recap_id: byTx[t.id], match_method: 'auto' } : t));
      }

      const uploaderIds = [...new Set((ups || []).map((u) => u.uploaded_by).filter(Boolean))];
      const userNames = {};
      if (uploaderIds.length) {
        const { data: us } = await supabase.from('users').select('id, full_name').in('id', uploaderIds);
        (us || []).forEach((u) => { userNames[u.id] = u.full_name; });
      }
      setDay({ uploads: ups || [], transactions, portions, userNames });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Gagal memuat data', description: e.message });
    } finally {
      setLoading(false);
    }
  }, [clinicId, loadQrisPortions, persistMatches, toast]);

  useEffect(() => { if (isKaffah) loadDay(date); }, [date, isKaffah, loadDay]);

  // --- Upload ----------------------------------------------------------------
  const saveParsed = async (parsed, fileName) => {
    setBusy(true);
    try {
      const reportDate = parsed.meta.periodStart || parsed.transactions[0]?.dateStr;
      if (!reportDate) throw new Error('Tanggal laporan tidak terbaca.');

      // Transaksi yang RRN-nya sudah tersimpan (mis. dari PDF admin pagi) dilewati.
      const rrns = parsed.transactions.map((t) => t.rrn).filter(Boolean);
      const { data: existing } = rrns.length
        ? await supabase.from('qris_report_transactions').select('rrn').eq('clinic_id', clinicId).in('rrn', rrns)
        : { data: [] };
      const existingRrn = new Set((existing || []).map((e) => e.rrn));

      // Transaksi tanpa RRN (mis. dari PDF versi lain) dideteksi lewat kunci cadangan
      // tanggal+jam+nominal+nama+issuer, supaya PDF yang tumpang tindih tidak menggandakan transaksi.
      const keyOf = (d, tm, amt, nm, iss) => [d, String(tm || '').slice(0, 5), Math.round(Number(amt)), String(nm || '').trim().toUpperCase(), String(iss || '').trim().toUpperCase()].join('|');
      const noRrn = parsed.transactions.filter((t) => !t.rrn);
      const existingKeys = new Set();
      if (noRrn.length) {
        const dates = [...new Set(noRrn.map((t) => t.dateStr))];
        const { data: sameDay } = await supabase.from('qris_report_transactions')
          .select('trx_date, trx_time, amount, customer_name, issuer').eq('clinic_id', clinicId).in('trx_date', dates);
        (sameDay || []).forEach((e) => existingKeys.add(keyOf(e.trx_date, e.trx_time, e.amount, e.customer_name, e.issuer)));
      }
      const seenInFile = new Set();
      const fresh = parsed.transactions.filter((t) => {
        if (t.rrn) return !existingRrn.has(t.rrn);
        const k = keyOf(t.dateStr, t.timeStr, t.amount, t.customerName, t.issuer);
        if (existingKeys.has(k) && !seenInFile.has(k)) { seenInFile.add(k); return false; }
        return true;
      });

      if (fresh.length) {
        const generatedAt = parseGeneratedAt(fileName);
        const { data: upload, error: upErr } = await supabase.from('qris_report_uploads').insert({
          clinic_id: clinicId,
          report_date: reportDate,
          file_name: fileName,
          mid: parsed.meta.mid,
          mpan: parsed.meta.mpan,
          total_count: parsed.transactions.length,
          new_count: fresh.length,
          total_amount: parsed.transactions.reduce((s, t) => s + t.amount, 0),
          total_net: parsed.transactions.reduce((s, t) => s + t.netAmount, 0),
          report_generated_at: generatedAt ? generatedAt.toISOString() : null,
          uploaded_by: user?.id || null,
        }).select('id').single();
        if (upErr) throw upErr;

        const { error: insErr } = await supabase.from('qris_report_transactions').insert(fresh.map((t) => ({
          upload_id: upload.id, clinic_id: clinicId, trx_date: t.dateStr, trx_time: t.timeStr, issuer: t.issuer,
          customer_name: t.customerName, ref_no: t.refNo, rrn: t.rrn, amount: t.amount, mdr: t.mdr, net_amount: t.netAmount,
        })));
        if (insErr) throw insErr;
      }

      toast({
        title: fresh.length ? `Laporan tersimpan: ${fresh.length} transaksi baru` : 'Tidak ada transaksi baru',
        description: fresh.length
          ? (parsed.transactions.length > fresh.length ? `${parsed.transactions.length - fresh.length} transaksi lain sudah ada dari unggahan sebelumnya.` : undefined)
          : 'Semua transaksi di PDF ini sudah pernah diunggah.',
      });
      setPendingFile(null);
      if (reportDate === date) await loadDay(reportDate); else setDate(reportDate);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!/\.pdf$/i.test(file.name)) {
      toast({ variant: 'destructive', title: 'File harus PDF', description: 'Unggah "Laporan Transaksi" QRIS dari BSI Merchant.' });
      return;
    }
    setBusy(true);
    try {
      const parsed = await parseQrisReportPdf(file);
      if (!parsed.transactions.length) throw new Error('Tidak ada transaksi yang terbaca dari PDF ini.');
      const issues = getIssues(parsed);
      // Tidak ada keanehan -> langsung simpan (satu langkah). Ada keanehan -> minta konfirmasi dulu.
      if (issues.length === 0) { await saveParsed(parsed, file.name); return; }
      setPendingFile({ fileName: file.name, parsed, issues });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Gagal membaca PDF', description: e.message });
    } finally {
      setBusy(false);
    }
  };

  // --- Aksi manual -----------------------------------------------------------
  const setMatch = async (transactionId, recapId) => {
    const patch = recapId
      ? { matched_recap_id: recapId, match_method: 'manual', matched_at: new Date().toISOString(), matched_by: user?.id || null }
      : { matched_recap_id: null, match_method: null, matched_at: null, matched_by: null };
    const { error } = await supabase.from('qris_report_transactions').update(patch).eq('id', transactionId).eq('clinic_id', clinicId);
    if (error) { toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message }); return; }
    loadDay(date);
  };

  const deleteUpload = async (u) => {
    if (!await confirmAction(`Hapus unggahan jam ${fmtClock(u.created_at)} (${u.new_count} transaksi baru) beserta hasil pencocokannya?`)) return;
    const { error } = await supabase.from('qris_report_uploads').delete().eq('id', u.id).eq('clinic_id', clinicId);
    if (error) { toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message }); return; }
    loadDay(date);
  };

  // --- Turunan tampilan ------------------------------------------------------
  const view = useMemo(() => {
    const { uploads, transactions, portions } = day;
    const trxByRecap = Object.fromEntries(transactions.filter((t) => t.matched_recap_id).map((t) => [t.matched_recap_id, t]));
    const cutoff = uploads.length
      ? new Date(Math.max(...uploads.map((u) => new Date(u.report_generated_at || u.created_at).getTime())))
      : null;
    const rows = portions.map((p) => {
      const trx = trxByRecap[p.recapId];
      const status = trx ? 'matched' : (!cutoff || (p.payAt && p.payAt > cutoff)) ? 'pending' : 'missing';
      return { ...p, trx, status };
    });
    const unmatchedTrx = transactions.filter((t) => !t.matched_recap_id);
    const freeRows = rows.filter((r) => !r.trx);

    const groups = {};
    rows.forEach((r) => {
      (groups[r.cashierId] ||= { id: r.cashierId, name: r.cashierName, items: [] }).items.push(r);
    });
    const adminGroups = Object.values(groups).map((g) => ({
      ...g,
      count: (s) => g.items.filter((i) => i.status === s).length,
    })).sort((a, b) => b.count('missing') - a.count('missing') || a.name.localeCompare(b.name));

    const bankTotal = transactions.reduce((s, t) => s + Number(t.amount), 0);
    const expectedTotal = rows.filter((r) => r.status !== 'pending').reduce((s, r) => s + r.amount, 0);
    const missing = rows.filter((r) => r.status === 'missing').length;
    const pending = rows.filter((r) => r.status === 'pending').length;
    const problems = unmatchedTrx.length + missing;
    return { rows, unmatchedTrx, freeRows, adminGroups, bankTotal, expectedTotal, missing, pending, problems, cutoff };
  }, [day]);

  if (!isKaffah) {
    return <div className="p-6 text-sm text-slate-600">Fitur rekonsiliasi QRIS harian hanya tersedia untuk Kaffah Physiotherapy.</div>;
  }

  const hasData = day.transactions.length > 0 || day.portions.length > 0;
  let hero;
  if (!hasData && !day.uploads.length) {
    hero = { tone: 'slate', icon: QrCode, title: 'Belum ada data QRIS untuk tanggal ini', text: 'Unggah PDF Laporan Transaksi dari BSI Merchant untuk mulai mencocokkan.' };
  } else if (view.problems > 0) {
    hero = { tone: 'amber', icon: AlertTriangle, title: `${view.problems} hal perlu dicek`, text: 'Selesaikan daftar "Perlu dicek" di bawah. Tiap admin hanya perlu memeriksa pasiennya sendiri.' };
  } else if (view.pending > 0) {
    hero = { tone: 'sky', icon: Hourglass, title: `Menunggu laporan berikutnya (${view.pending} pembayaran)`, text: view.cutoff ? `Laporan terakhir dibuat jam ${fmtClock(view.cutoff)}. Pembayaran sesudah jam itu akan dicek saat PDF berikutnya diunggah.` : 'Belum ada PDF diunggah.' };
  } else {
    hero = { tone: 'green', icon: CheckCircle2, title: 'Semua QRIS cocok', text: `${day.transactions.length} transaksi di bank sudah sesuai dengan recap.` };
  }
  const tones = {
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    sky: 'bg-sky-50 border-sky-200 text-sky-800',
    green: 'bg-green-50 border-green-200 text-green-800',
  };
  const HeroIcon = hero.icon;

  return (
    <div
      className="space-y-5 p-4 md:p-6 max-w-4xl mx-auto"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
    >
      <Helmet><title>Rekonsiliasi QRIS</title></Helmet>
      <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />

      {dragOver && (
        <div className="fixed inset-0 z-50 bg-emerald-600/10 border-4 border-dashed border-emerald-500 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-xl px-6 py-4 shadow-lg font-semibold text-emerald-700 flex items-center gap-2"><UploadCloud className="w-5 h-5" /> Lepas PDF di sini</div>
        </div>
      )}

      {/* Header: navigasi tanggal + unggah */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" onClick={() => setDate(shiftDate(date, -1))} aria-label="Hari sebelumnya"><ChevronLeft className="w-4 h-4" /></Button>
          <label className="relative cursor-pointer">
            <span className="block px-3 py-1.5 text-lg font-bold text-slate-900 hover:bg-slate-100 rounded-md">{fmtLong(date)}</span>
            <input type="date" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full" />
          </label>
          <Button size="icon" variant="outline" onClick={() => setDate(shiftDate(date, 1))} disabled={date >= todayStr()} aria-label="Hari berikutnya"><ChevronRight className="w-4 h-4" /></Button>
          {date !== todayStr() && <Button size="sm" variant="ghost" onClick={() => setDate(todayStr())}>Hari ini</Button>}
        </div>
        <Button onClick={() => fileInputRef.current?.click()} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />} Unggah PDF
        </Button>
      </div>

      {/* Konfirmasi bila PDF punya keanehan */}
      {pendingFile && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900"><FileText className="w-4 h-4" /> {pendingFile.fileName}</div>
          <ul className="text-sm text-amber-800 space-y-1">
            {pendingFile.issues.map((i) => <li key={i} className="flex gap-1.5"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {i}</li>)}
          </ul>
          <div className="flex gap-2">
            <Button onClick={() => saveParsed(pendingFile.parsed, pendingFile.fileName)} disabled={busy}>Tetap simpan</Button>
            <Button variant="outline" onClick={() => setPendingFile(null)} disabled={busy}>Batal</Button>
          </div>
        </div>
      )}

      {/* Status utama */}
      <div className={`rounded-xl border p-4 flex gap-3 ${tones[hero.tone]}`}>
        <HeroIcon className="w-6 h-6 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base">{hero.title}</div>
          <div className="text-sm opacity-90">{hero.text}</div>
          {hasData && (
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs opacity-90">
              <span>Bank: <b>{formatRp(view.bankTotal)}</b> ({day.transactions.length} trx)</span>
              <span>Recap QRIS: <b>{formatRp(view.expectedTotal)}</b>{view.pending > 0 ? ` (+${view.pending} menunggu)` : ''}</span>
              <span>Selisih: <b>{formatRp(view.bankTotal - view.expectedTotal)}</b></span>
            </div>
          )}
        </div>
      </div>

      {loading && <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Memuat...</div>}

      {/* Perlu dicek */}
      {!loading && view.problems > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Perlu dicek</h2>
          {view.unmatchedTrx.map((t) => {
            const cands = view.freeRows.filter((p) => Math.round(p.amount) === Math.round(t.amount));
            return (
              <div key={t.id} className="rounded-xl border border-red-200 bg-white p-3 shadow-sm">
                <div className="flex flex-wrap justify-between gap-1 text-sm">
                  <div><b>{formatRp(t.amount)}</b> masuk di bank, belum ada pasiennya</div>
                  <div className="text-slate-500">{t.customer_name} · {t.issuer} · {t.trx_time}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 items-center">
                  {cands.length === 0
                    ? <span className="text-xs text-slate-500">Tidak ada pembayaran QRIS bernominal sama di Daily Recap. Cek apakah pasien salah dicatat cash/transfer, atau recap belum diisi.</span>
                    : <>
                        <span className="text-xs text-slate-500">Ini pembayaran siapa?</span>
                        {cands.map((p) => (
                          <Button key={p.recapId} size="sm" variant="outline" onClick={() => setMatch(t.id, p.recapId)} className="gap-1">
                            <Link2 className="w-3.5 h-3.5" /> {p.name} <span className="text-slate-400">· {p.cashierName}</span>
                          </Button>
                        ))}
                      </>}
                </div>
              </div>
            );
          })}
          {view.rows.filter((r) => r.status === 'missing').map((r) => (
            <div key={r.recapId} className="rounded-xl border border-red-200 bg-white p-3 shadow-sm flex flex-wrap justify-between gap-1 text-sm">
              <div><b>{r.name}</b> dicatat QRIS {formatRp(r.amount)}, tapi tidak ada di laporan bank</div>
              <div className="text-slate-500 flex items-center gap-1"><User className="w-3.5 h-3.5" /> {r.cashierName}</div>
            </div>
          ))}
          {view.missing > 0 && <p className="text-xs text-slate-500">Kemungkinan: metode bayar salah dicatat (sebenarnya cash/transfer), nominal salah ketik, atau pembayaran belum masuk.</p>}
        </section>
      )}

      {/* Per admin */}
      {!loading && view.adminGroups.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Per admin (penanggung jawab pasien)</h2>
          {view.adminGroups.map((g) => {
            const m = g.count('matched'), p = g.count('pending'), x = g.count('missing');
            const open = openAdmins[g.id] ?? x > 0;
            return (
              <div key={g.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <button type="button" onClick={() => setOpenAdmins((s) => ({ ...s, [g.id]: !open }))} className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-slate-50">
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-semibold truncate">{g.name}</span>
                    <span className="text-xs text-slate-500">{g.items.length} pasien QRIS</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {m > 0 && <Badge className={STATUS.matched.cls}>{m} cocok</Badge>}
                    {p > 0 && <Badge className={STATUS.pending.cls}>{p} menunggu</Badge>}
                    {x > 0 && <Badge className={STATUS.missing.cls}>{x} bermasalah</Badge>}
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {open && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {g.items.map((r) => (
                      <div key={r.recapId} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{r.name}</div>
                          <div className="text-xs text-slate-400 truncate">
                            {r.trx ? `${r.trx.customer_name} · ${r.trx.issuer} · ${r.trx.trx_time}${r.trx.match_method === 'manual' ? ' · manual' : ''}` : (r.time ? `Sesi ${r.time}` : '')}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-semibold">{formatRp(r.amount)}</span>
                          <Badge className={STATUS[r.status].cls}>{STATUS[r.status].label}</Badge>
                          {r.trx && <Button size="icon" variant="ghost" className="h-7 w-7" title="Lepas pencocokan" onClick={() => setMatch(r.trx.id, null)}><Unlink className="w-3.5 h-3.5" /></Button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Riwayat unggahan */}
      {day.uploads.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Riwayat unggahan</h2>
          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            {day.uploads.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">
                    <b>{fmtClock(u.created_at)}</b> oleh {day.userNames[u.uploaded_by] || 'admin'} · {u.new_count} transaksi baru
                    {u.report_generated_at ? <span className="text-slate-400"> · laporan jam {fmtClock(u.report_generated_at)}</span> : null}
                  </span>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" title="Hapus unggahan ini" onClick={() => deleteUpload(u)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tempat unggah bila hari ini belum ada PDF */}
      {!loading && !day.uploads.length && !pendingFile && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-slate-300 hover:border-emerald-400 rounded-xl p-6 text-center text-slate-600 transition-colors"
        >
          <UploadCloud className="w-7 h-7 mx-auto text-emerald-600 mb-1" />
          <div className="font-medium">Klik atau seret PDF Laporan Transaksi ke halaman ini</div>
          <div className="text-xs text-slate-400">BSI Merchant › Laporan Transaksi (PDF). Boleh diunggah beberapa kali sehari, data yang sama tidak akan dobel.</div>
        </button>
      )}
    </div>
  );
};

export default AdminQrisReconciliation;
