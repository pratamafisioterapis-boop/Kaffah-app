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
import { autoMatchQris, autoMatchSplits, findCombos, qrisPortionOfRecap, rankCandidates } from '@/utils/qrisMatcher';
import { fetchRecapHandlerEvents } from '@/lib/recapCashier';

// Catatan: komentar ini hanya untuk mengubah hash aset build (bukan perubahan fungsi).
const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const todayStr = () => format(new Date(), 'yyyy-MM-dd');
const shiftDate = (d, delta) => format(addDays(parseISO(d), delta), 'yyyy-MM-dd');
const fmtLong = (d) => { try { return format(parseISO(d), 'EEEE, d MMMM yyyy', { locale: localeId }); } catch { return d; } };
const fmtShort = (d) => { try { return format(parseISO(d), 'd MMM', { locale: localeId }); } catch { return d; } };
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
  partial: { label: 'Kurang', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
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
  const [multiPick, setMultiPick] = useState({}); // { [transactionId]: [recapId, ...] } pilihan manual beberapa pasien

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
    // Kasir sebenarnya = admin yang mengisi TTV atau mengubah pembayaran recap (bukan sekadar pembuat booking).
    const recapIds = (recaps || []).map((r) => r.id);
    const handlerEvents = await fetchRecapHandlerEvents(supabase, recapIds);
    const staffIds = [...new Set([
      ...(recaps || []).flatMap((r) => [r.cashier_id, r.created_by]),
      ...Object.values(handlerEvents).flat().map((e) => e.userId),
    ].filter(Boolean))];
    const staff = {};
    if (staffIds.length) {
      const { data: us } = await supabase.from('users').select('id, full_name, role').in('id', staffIds);
      (us || []).forEach((u) => { staff[u.id] = u; });
    }

    return (recaps || []).map((r) => {
      // Urutan: kasir tercatat -> admin pertama yang mengisi TTV/mengubah pembayaran -> pembuat recap bila admin.
      const isAdmin = (id) => ['admin', 'clinic_admin'].includes(staff[id]?.role);
      const handler = (handlerEvents[r.id] || []).find((e) => isAdmin(e.userId))?.userId || null;
      const cashierId = r.cashier_id || handler || (isAdmin(r.created_by) ? r.created_by : null);
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

  // Cocokkan otomatis transaksi yang belum berpasangan dengan recap pada hari yang sama.
  // Mengembalikan daftar transaksi dengan hasil pencocokan terbaru.
  const autoMatchDay = useCallback(async (transactions, portions) => {
    const used = new Set(transactions.flatMap((t) => [t.matched_recap_id, ...(t.extra_recap_ids || [])]).filter(Boolean));
    // Transaksi yang pernah dilepas manual (auto_match_blocked) tidak dicocokkan otomatis lagi.
    const freeTrx = transactions.filter((t) => !t.matched_recap_id && !t.auto_match_blocked);
    const freePortions = portions.filter((p) => !used.has(p.recapId));
    // Dahulukan pembayaran terpecah (satu recap = beberapa transaksi bank atas nama pasien itu).
    const splitMatches = autoMatchSplits(freeTrx, freePortions);
    const splitTx = new Set(splitMatches.map((m) => m.transactionId));
    const splitRecaps = new Set(splitMatches.map((m) => m.recapId));
    const { matches: amountMatches } = autoMatchQris(freeTrx.filter((t) => !splitTx.has(t.id)), freePortions.filter((p) => !splitRecaps.has(p.recapId)));
    const matches = [...splitMatches, ...amountMatches];
    if (!matches.length) return transactions;
    await persistMatches(matches);
    const byTx = Object.fromEntries(matches.map((m) => [m.transactionId, m.recapId]));
    return transactions.map((t) => (byTx[t.id] ? { ...t, matched_recap_id: byTx[t.id], match_method: 'auto' } : t));
  }, [persistMatches]);

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
      transactions = await autoMatchDay(transactions, portions);

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
  }, [clinicId, loadQrisPortions, autoMatchDay, toast]);

  useEffect(() => { if (isKaffah) loadDay(date); }, [date, isKaffah, loadDay]);

  // --- Upload ----------------------------------------------------------------
  const saveParsed = async (parsed, fileName) => {
    setBusy(true);
    try {
      const reportDate = parsed.meta.periodStart || parsed.transactions[0]?.dateStr;
      if (!reportDate) throw new Error('Tanggal laporan tidak terbaca.');

      // Transaksi yang RRN-nya sudah tersimpan (mis. dari PDF admin pagi) dilewati.
      const rrns = parsed.transactions.map((t) => t.rrn).filter(Boolean);
      // Dipecah per 100 agar URL tidak terlalu panjang untuk laporan sebulan.
      const existingRrn = new Set();
      for (let i = 0; i < rrns.length; i += 100) {
        const { data: existing, error: exErr } = await supabase.from('qris_report_transactions').select('rrn').eq('clinic_id', clinicId).in('rrn', rrns.slice(i, i + 100));
        if (exErr) throw exErr;
        (existing || []).forEach((e) => existingRrn.add(e.rrn));
      }

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

      // Satu catatan unggahan per tanggal transaksi, supaya tiap hari punya riwayat & batas waktu laporannya
      // sendiri (laporan 2 minggu / sebulan tampil benar di setiap harinya).
      const touchedDates = [];
      if (fresh.length) {
        const generatedAt = parseGeneratedAt(fileName);
        const byDate = {};
        parsed.transactions.forEach((t) => { (byDate[t.dateStr] ||= { all: [], fresh: [] }).all.push(t); });
        fresh.forEach((t) => byDate[t.dateStr].fresh.push(t));

        for (const d of Object.keys(byDate).sort()) {
          const g = byDate[d];
          if (!g.fresh.length) continue;
          const { data: upload, error: upErr } = await supabase.from('qris_report_uploads').insert({
            clinic_id: clinicId,
            report_date: d,
            file_name: fileName,
            mid: parsed.meta.mid,
            mpan: parsed.meta.mpan,
            total_count: g.all.length,
            new_count: g.fresh.length,
            total_amount: g.all.reduce((sum, t) => sum + t.amount, 0),
            total_net: g.all.reduce((sum, t) => sum + t.netAmount, 0),
            report_generated_at: generatedAt ? generatedAt.toISOString() : null,
            uploaded_by: user?.id || null,
          }).select('id').single();
          if (upErr) throw upErr;

          const { error: insErr } = await supabase.from('qris_report_transactions').insert(g.fresh.map((t) => ({
            upload_id: upload.id, clinic_id: clinicId, trx_date: t.dateStr, trx_time: t.timeStr, issuer: t.issuer,
            customer_name: t.customerName, ref_no: t.refNo, rrn: t.rrn, amount: t.amount, mdr: t.mdr, net_amount: t.netAmount,
          })));
          if (insErr) throw insErr;
          touchedDates.push(d);
        }
      }

      // Rentang beberapa hari: cocokkan semua harinya sekaligus, lalu laporkan hari yang masih perlu dicek.
      const unmatchedByDate = [];
      if (touchedDates.length > 1) {
        for (const d of touchedDates) {
          const [{ data: trx }, portions] = await Promise.all([
            supabase.from('qris_report_transactions').select('*').eq('clinic_id', clinicId).eq('trx_date', d).order('trx_time'),
            loadQrisPortions(d),
          ]);
          const after = await autoMatchDay(trx || [], portions);
          const n = after.filter((t) => !t.matched_recap_id).length;
          if (n) unmatchedByDate.push({ d, n });
        }
      }

      const parts = [];
      if (touchedDates.length > 1) parts.push(`${touchedDates.length} hari (${fmtShort(touchedDates[0])} – ${fmtShort(touchedDates[touchedDates.length - 1])}).`);
      if (parsed.transactions.length > fresh.length && fresh.length) parts.push(`${parsed.transactions.length - fresh.length} transaksi lain sudah ada dari unggahan sebelumnya.`);
      if (unmatchedByDate.length) parts.push(`Belum cocok: ${unmatchedByDate.map((u) => `${fmtShort(u.d)} (${u.n})`).join(', ')}.`);
      toast({
        title: fresh.length ? `Laporan tersimpan: ${fresh.length} transaksi baru` : 'Tidak ada transaksi baru',
        description: fresh.length ? (parts.join(' ') || undefined) : 'Semua transaksi di PDF ini sudah pernah diunggah.',
      });
      setPendingFile(null);
      // Tampilkan hari yang sedang dibuka bila termasuk dalam laporan; selain itu loncat ke hari paling awal yang perlu dicek
      // (atau hari terakhir di laporan).
      const target = touchedDates.includes(date) ? date
        : (unmatchedByDate[0]?.d || touchedDates[touchedDates.length - 1] || reportDate);
      if (target === date) await loadDay(target); else setDate(target);
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
  // recapId: satu id, array id (satu pembayaran untuk beberapa pasien), atau null untuk melepas.
  const setMatch = async (transactionId, recapId) => {
    const ids = [].concat(recapId || []);
    const patch = ids.length
      ? { matched_recap_id: ids[0], extra_recap_ids: ids.slice(1), auto_match_blocked: false, match_method: 'manual', matched_at: new Date().toISOString(), matched_by: user?.id || null }
      : { matched_recap_id: null, extra_recap_ids: [], auto_match_blocked: true, match_method: null, matched_at: null, matched_by: null };
    const { error } = await supabase.from('qris_report_transactions').update(patch).eq('id', transactionId).eq('clinic_id', clinicId);
    if (error) { toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message }); return; }
    setMultiPick((s) => { const { [transactionId]: _drop, ...rest } = s; return rest; });
    loadDay(date);
  };

  // Lepas semua transaksi bank dari satu pasien (bisa lebih dari satu bila dibayar terpecah).
  const unlinkRow = async (r) => {
    const { error } = await supabase.from('qris_report_transactions')
      .update({ matched_recap_id: null, extra_recap_ids: [], auto_match_blocked: true, match_method: null, matched_at: null, matched_by: null })
      .in('id', r.trxs.map((t) => t.id)).eq('clinic_id', clinicId);
    if (error) { toast({ variant: 'destructive', title: 'Gagal melepas', description: error.message }); return; }
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
    // Satu recap bisa punya beberapa transaksi bank (dibayar terpecah); satu transaksi bisa untuk beberapa recap.
    const trxsByRecap = {};
    transactions.forEach((t) => {
      if (!t.matched_recap_id) return;
      [t.matched_recap_id, ...(t.extra_recap_ids || [])].forEach((rid) => { (trxsByRecap[rid] ||= []).push(t); });
    });
    const cutoff = uploads.length
      ? new Date(Math.max(...uploads.map((u) => new Date(u.report_generated_at || u.created_at).getTime())))
      : null;
    const rows = portions.map((p) => {
      const trxs = trxsByRecap[p.recapId] || [];
      // Transaksi gabungan (beberapa pasien) dianggap menutup penuh tiap pasiennya.
      const covered = trxs.reduce((s, t) => s + ((t.extra_recap_ids || []).length ? p.amount : Number(t.amount)), 0);
      const status = trxs.length
        ? (Math.round(covered) >= Math.round(p.amount) ? 'matched' : 'partial')
        : (!cutoff || (p.payAt && p.payAt > cutoff)) ? 'pending' : 'missing';
      return { ...p, trxs, covered, status };
    });
    const unmatchedTrx = transactions.filter((t) => !t.matched_recap_id);
    // Pasien yang belum tertutup penuh; amount = sisa yang masih dicari di bank.
    const freeRows = rows.filter((r) => r.covered < r.amount).map((r) => ({ ...r, amount: r.amount - r.covered }));

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
    const partial = rows.filter((r) => r.status === 'partial').length;
    const pending = rows.filter((r) => r.status === 'pending').length;
    const problems = unmatchedTrx.length + missing + partial;
    return { rows, unmatchedTrx, freeRows, adminGroups, bankTotal, expectedTotal, missing, partial, pending, problems, cutoff };
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
            <span className="block px-2 sm:px-3 py-1.5 text-base sm:text-lg font-bold text-slate-900 hover:bg-slate-100 rounded-md leading-tight">{fmtLong(date)}</span>
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
            const sameAmount = view.freeRows.filter((p) => Math.round(p.amount) === Math.round(t.amount));
            const cands = rankCandidates(t, sameAmount);
            const others = view.freeRows.filter((p) => !sameAmount.includes(p));
            const combos = findCombos(t, view.freeRows);
            const picked = (multiPick[t.id] || []).map((rid) => view.freeRows.find((p) => p.recapId === rid)).filter(Boolean);
            const pickedSum = picked.reduce((s, p) => s + Math.round(p.amount), 0);
            const togglePick = (rid) => setMultiPick((s) => {
              const cur = s[t.id] || [];
              return { ...s, [t.id]: cur.includes(rid) ? cur.filter((x) => x !== rid) : [...cur, rid] };
            });
            const hintOf = (c) => {
              const parts = [];
              if (c.name > 0) parts.push('nama mirip');
              if (Number.isFinite(c.gap) && c.gap <= 180) parts.push(`selisih ${c.gap} mnt`);
              return parts.join(' · ');
            };
            return (
              <div key={t.id} className="rounded-xl border border-red-200 bg-white p-3 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-between gap-0.5 text-sm">
                  <div><b>{formatRp(t.amount)}</b> masuk di bank, belum ada pasiennya</div>
                  <div className="text-slate-500 break-words">{t.customer_name} · {t.issuer} · {t.trx_time}</div>
                </div>
                <div className="mt-2 space-y-2">
                  {cands.length === 0
                    ? <p className="text-xs text-slate-500">Tidak ada pembayaran QRIS bernominal sama di Daily Recap. Cek apakah pasien salah dicatat cash/transfer, atau recap belum diisi.</p>
                    : <>
                        <p className="text-xs text-slate-500">Ini pembayaran siapa? (diurutkan dari yang paling mirip nama dan jam akhir sesinya)</p>
                        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                          {cands.map((c, i) => (
                            <Button key={c.p.recapId} size="sm" variant="outline" onClick={() => setMatch(t.id, c.p.recapId)} className="gap-1.5 h-auto min-h-9 py-1.5 justify-start text-left whitespace-normal">
                              <Link2 className="w-3.5 h-3.5 shrink-0" />
                              <span className="min-w-0">
                                <span className="block break-words">{c.p.name}{i === 0 && hintOf(c) ? <span className="ml-1 text-emerald-600 text-xs">· {hintOf(c)}</span> : null}</span>
                                <span className="block text-xs text-slate-400 break-words">{c.p.cashierName}{i !== 0 && hintOf(c) ? ` · ${hintOf(c)}` : ''}</span>
                              </span>
                            </Button>
                          ))}
                        </div>
                      </>}
                  {combos.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-slate-500">Atau satu pembayaran untuk beberapa pasien (jumlahnya pas {formatRp(t.amount)}):</p>
                      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                        {combos.map((c) => (
                          <Button key={c.items.map((p) => p.recapId).join('+')} size="sm" variant="outline" onClick={() => setMatch(t.id, c.items.map((p) => p.recapId))} className="gap-1.5 h-auto min-h-9 py-1.5 justify-start text-left whitespace-normal border-emerald-300">
                            <Link2 className="w-3.5 h-3.5 shrink-0" />
                            <span className="min-w-0">
                              <span className="block break-words">{c.items.map((p) => p.name).join(' + ')}{c.name > 0 ? <span className="ml-1 text-emerald-600 text-xs">· nama mirip</span> : null}</span>
                              <span className="block text-xs text-slate-400 break-words">{c.items.map((p) => formatRp(p.amount)).join(' + ')}{c.sameAdmin ? ` · ${c.items[0].cashierName}` : ''}</span>
                            </span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {view.freeRows.length > 1 && (
                    <details className="text-sm" open={picked.length > 0}>
                      <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">Pilih beberapa pasien sendiri…</summary>
                      <div className="mt-2 rounded-md border border-slate-200 divide-y divide-slate-100 max-h-56 overflow-y-auto">
                        {view.freeRows.map((p) => (
                          <label key={p.recapId} className="flex items-center gap-2 px-2.5 py-2 cursor-pointer hover:bg-slate-50">
                            <input type="checkbox" checked={picked.some((x) => x.recapId === p.recapId)} onChange={() => togglePick(p.recapId)} />
                            <span className="flex-1 min-w-0 break-words">{p.name} <span className="text-xs text-slate-400">· {p.cashierName}</span></span>
                            <span className="tabular-nums">{formatRp(p.amount)}</span>
                          </label>
                        ))}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <span className={`text-xs ${pickedSum === Math.round(t.amount) ? 'text-emerald-600' : 'text-slate-500'}`}>
                          Terpilih {formatRp(pickedSum)} dari {formatRp(t.amount)}{pickedSum === Math.round(t.amount) ? ' · pas' : ''}
                        </span>
                        <Button
                          size="sm"
                          disabled={picked.length < 2}
                          onClick={async () => {
                            if (pickedSum !== Math.round(t.amount) && !await confirmAction(`Jumlah pasien terpilih ${formatRp(pickedSum)} berbeda dengan nominal bank ${formatRp(t.amount)}. Tetap cocokkan?`)) return;
                            setMatch(t.id, picked.map((p) => p.recapId));
                          }}
                        >Cocokkan {picked.length} pasien</Button>
                      </div>
                    </details>
                  )}
                  {others.length > 0 && (
                    <select
                      className="w-full sm:w-auto text-sm border border-slate-300 rounded-md bg-white px-2 py-2 text-slate-600"
                      value=""
                      aria-label="Pilih pasien lain secara manual"
                      onChange={async (e) => {
                        const p = others.find((o) => o.recapId === e.target.value);
                        if (!p) return;
                        if (await confirmAction(`Nominal bank ${formatRp(t.amount)} berbeda dengan recap ${p.name} (${formatRp(p.amount)}). Tetap cocokkan?`)) setMatch(t.id, p.recapId);
                      }}
                    >
                      <option value="">Pilih pasien lain…</option>
                      {others.map((p) => <option key={p.recapId} value={p.recapId}>{p.name} · {formatRp(p.amount)} · {p.cashierName}</option>)}
                    </select>
                  )}
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
          {view.rows.filter((r) => r.status === 'partial').map((r) => (
            <div key={r.recapId} className="rounded-xl border border-amber-200 bg-white p-3 shadow-sm flex flex-wrap justify-between gap-1 text-sm">
              <div><b>{r.name}</b> dicatat QRIS {formatRp(r.amount)}, baru ada {formatRp(r.covered)} di bank (kurang {formatRp(r.amount - r.covered)})</div>
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
            const m = g.count('matched'), p = g.count('pending'), x = g.count('missing') + g.count('partial');
            const open = openAdmins[g.id] ?? x > 0;
            return (
              <div key={g.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <button type="button" onClick={() => setOpenAdmins((s) => ({ ...s, [g.id]: !open }))} className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 text-left hover:bg-slate-50">
                  <div className="flex items-start gap-2 min-w-0">
                    <User className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                    <div className="min-w-0">
                      <div className="font-semibold break-words leading-snug">{g.name}</div>
                      <div className="text-xs text-slate-500">{g.items.length} pasien QRIS</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-1.5 pl-6 sm:pl-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {m > 0 && <Badge className={STATUS.matched.cls}>{m} cocok</Badge>}
                      {p > 0 && <Badge className={STATUS.pending.cls}>{p} menunggu</Badge>}
                      {x > 0 && <Badge className={STATUS.missing.cls}>{x} bermasalah</Badge>}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {open && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {g.items.map((r) => (
                      <div key={r.recapId} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3 px-3 py-2.5 text-sm">
                        <div className="min-w-0">
                          <div className="font-medium break-words leading-snug">{r.name}</div>
                          <div className="text-xs text-slate-400 break-words">
                            {r.trxs.length ? r.trxs.map((t) => `${t.customer_name} · ${t.issuer} · ${t.trx_time}${r.trxs.length > 1 ? ` · ${formatRp(t.amount)}` : ''}${t.match_method === 'manual' ? ' · manual' : ''}${(t.extra_recap_ids || []).length ? ` · satu pembayaran ${formatRp(t.amount)} untuk ${t.extra_recap_ids.length + 1} pasien` : ''}`).join(' + ') : (r.time ? `Sesi ${r.time}` : '')}
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                          <span className="font-semibold tabular-nums">{formatRp(r.amount)}</span>
                          <div className="flex items-center gap-1.5">
                            <Badge className={STATUS[r.status].cls}>{STATUS[r.status].label}</Badge>
                            {r.trxs.length > 0 && <Button size="icon" variant="ghost" className="h-8 w-8" title="Lepas pencocokan" aria-label="Lepas pencocokan" onClick={() => unlinkRow(r)}><Unlink className="w-4 h-4" /></Button>}
                          </div>
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
              <div key={u.id} className="flex items-start justify-between gap-2 px-3 py-2.5 text-sm">
                <div className="flex items-start gap-2 min-w-0">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="leading-snug"><b>{fmtClock(u.created_at)}</b> oleh {day.userNames[u.uploaded_by] || 'admin'}</div>
                    <div className="text-xs text-slate-500 break-words">
                      {u.new_count} transaksi baru
                      {u.report_generated_at ? <span className="text-slate-400"> · laporan jam {fmtClock(u.report_generated_at)}</span> : null}
                    </div>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-red-500" title="Hapus unggahan ini" aria-label="Hapus unggahan ini" onClick={() => deleteUpload(u)}><Trash2 className="w-4 h-4" /></Button>
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
          <div className="text-xs text-slate-400">BSI Merchant › Laporan Transaksi (PDF). Boleh satu hari atau rentang panjang (2 minggu, sebulan) dan boleh diunggah berulang; data yang sama tidak akan dobel.</div>
        </button>
      )}
    </div>
  );
};

export default AdminQrisReconciliation;
