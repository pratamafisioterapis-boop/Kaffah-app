import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  UploadCloud, FileText, CheckCircle2, XCircle, AlertTriangle, QrCode,
  Loader2, Trash2, Link2, Unlink, RefreshCw, History,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { KAFFAH_CLINIC_ID } from '@/lib/clinicIds';
import { confirmAction } from '@/lib/confirmAction';
import { parseQrisReportPdf } from '@/utils/bsiQrisReportParser';
import { autoMatchQris, qrisPortionOfRecap } from '@/utils/qrisMatcher';

const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const fmtDate = (d) => {
  try { return format(parseISO(d), 'EEEE, d MMMM yyyy', { locale: localeId }); } catch { return d; }
};
const toHHmm = (v) => {
  if (!v) return null;
  const m = String(v).match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  try { return format(new Date(v), 'HH:mm'); } catch { return null; }
};

const AdminQrisReconciliation = () => {
  const { toast } = useToast();
  const { user, userDetails } = useAuth();
  const clinicId = userDetails?.clinic_id || null;
  const fileInputRef = useRef(null);

  const [uploads, setUploads] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null); // { fileName, meta, summary, transactions }
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detail, setDetail] = useState({ transactions: [], portions: [] });
  const [dragOver, setDragOver] = useState(false);

  const isKaffah = clinicId === KAFFAH_CLINIC_ID;

  const loadUploads = useCallback(async () => {
    if (!clinicId) return [];
    const { data, error } = await supabase
      .from('qris_report_uploads')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('report_date', { ascending: false })
      .limit(90);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal memuat riwayat laporan', description: error.message });
      return [];
    }
    setUploads(data || []);
    return data || [];
  }, [clinicId, toast]);

  // Pembayaran QRIS di recap pada tanggal tertentu, sebagai daftar "portion" siap cocok.
  const loadQrisPortions = useCallback(async (date) => {
    const { data: options } = await supabase
      .from('operational_options')
      .select('id, label')
      .eq('clinic_id', clinicId)
      .eq('category', 'payment_method');
    const qrisIds = new Set((options || []).filter((o) => /^\s*qris\s*$/i.test(o.label || '')).map((o) => String(o.id)));
    const isQrisMethod = (m) => !!m && (qrisIds.has(String(m)) || /^\s*qris\s*$/i.test(String(m)));

    const { data: recaps, error } = await supabase
      .from('daily_recaps')
      .select('id, revenue_date, amount, payment_method, patient_id, actual_patient_id, full_name, guest_name, start_time, status, payment_splits:daily_recap_payment_splits(payment_method, amount)')
      .eq('clinic_id', clinicId)
      .eq('revenue_date', date)
      .or('status.is.null,status.neq.cancelled');
    if (error) throw error;

    const patientIds = [...new Set((recaps || []).flatMap((r) => [r.patient_id, r.actual_patient_id]).filter(Boolean))];
    const patientMap = {};
    if (patientIds.length) {
      const { data: pts } = await supabase.from('patients').select('id, full_name').in('id', patientIds).eq('clinic_id', clinicId);
      (pts || []).forEach((p) => { patientMap[p.id] = p.full_name; });
    }

    return (recaps || [])
      .map((r) => ({
        recapId: r.id,
        date: r.revenue_date,
        amount: qrisPortionOfRecap(r, isQrisMethod),
        name: patientMap[r.actual_patient_id] || patientMap[r.patient_id] || r.full_name || r.guest_name || '-',
        time: toHHmm(r.start_time),
      }))
      .filter((p) => p.amount > 0);
  }, [clinicId]);

  const loadDetail = useCallback(async (date) => {
    if (!clinicId || !date) return;
    setLoadingDetail(true);
    try {
      const upload = (await supabase.from('qris_report_uploads').select('id').eq('clinic_id', clinicId).eq('report_date', date).maybeSingle()).data;
      const [{ data: trx, error }, portions] = await Promise.all([
        upload
          ? supabase.from('qris_report_transactions').select('*').eq('upload_id', upload.id).order('trx_time')
          : Promise.resolve({ data: [] }),
        loadQrisPortions(date),
      ]);
      if (error) throw error;
      setDetail({ transactions: trx || [], portions });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Gagal memuat detail', description: e.message });
    } finally {
      setLoadingDetail(false);
    }
  }, [clinicId, loadQrisPortions, toast]);

  useEffect(() => {
    if (!clinicId || !isKaffah) return;
    loadUploads().then((list) => { if (list.length && !selectedDate) setSelectedDate(list[0].report_date); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId, isKaffah]);

  useEffect(() => { if (selectedDate) loadDetail(selectedDate); }, [selectedDate, loadDetail]);

  // Cocokkan otomatis semua transaksi yang belum punya pasangan pada satu tanggal laporan.
  const runAutoMatch = useCallback(async (date) => {
    const upload = (await supabase.from('qris_report_uploads').select('id').eq('clinic_id', clinicId).eq('report_date', date).maybeSingle()).data;
    if (!upload) return 0;
    const { data: trx } = await supabase.from('qris_report_transactions').select('*').eq('upload_id', upload.id);
    const portions = await loadQrisPortions(date);
    const used = new Set((trx || []).map((t) => t.matched_recap_id).filter(Boolean));
    const pending = (trx || []).filter((t) => !t.matched_recap_id);
    const { matches } = autoMatchQris(pending, portions.filter((p) => !used.has(p.recapId)));
    for (const m of matches) {
      await supabase
        .from('qris_report_transactions')
        .update({ matched_recap_id: m.recapId, match_method: 'auto', matched_at: new Date().toISOString(), matched_by: user?.id || null })
        .eq('id', m.transactionId)
        .eq('clinic_id', clinicId);
    }
    return matches.length;
  }, [clinicId, loadQrisPortions, user?.id]);

  const handleFile = async (file) => {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) {
      toast({ variant: 'destructive', title: 'File harus PDF', description: 'Unggah "Laporan Transaksi" QRIS dari BSI Merchant.' });
      return;
    }
    setParsing(true);
    setPreview(null);
    try {
      const parsed = await parseQrisReportPdf(file);
      if (!parsed.transactions.length && !(parsed.summary && parsed.summary.count === 0)) {
        throw new Error('Tidak ada transaksi yang terbaca dari PDF ini.');
      }
      setPreview({ fileName: file.name, ...parsed });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Gagal membaca PDF', description: e.message });
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const previewIssues = useMemo(() => {
    if (!preview) return [];
    const issues = [];
    const { meta, summary, transactions } = preview;
    if (meta.merchantName && !/KAFFAH/i.test(meta.merchantName)) issues.push('Nama merchant di laporan bukan Kaffah Physiotherapy.');
    if (meta.periodStart && meta.periodEnd && meta.periodStart !== meta.periodEnd) issues.push('Periode laporan lebih dari satu hari. Disarankan mengunggah laporan per hari.');
    if (summary) {
      if (summary.count !== transactions.length) issues.push(`Jumlah transaksi terbaca (${transactions.length}) berbeda dari ringkasan laporan (${summary.count}).`);
      const sum = transactions.reduce((s, t) => s + t.amount, 0);
      if (Math.round(sum) !== Math.round(summary.totalAmount)) issues.push(`Total nominal terbaca (${formatRp(sum)}) berbeda dari ringkasan laporan (${formatRp(summary.totalAmount)}).`);
    }
    return issues;
  }, [preview]);

  const handleSave = async () => {
    if (!preview || !clinicId) return;
    const reportDate = preview.meta.periodStart || preview.transactions[0]?.dateStr;
    if (!reportDate) { toast({ variant: 'destructive', title: 'Tanggal laporan tidak terbaca' }); return; }
    setSaving(true);
    try {
      const { data: upload, error: upErr } = await supabase
        .from('qris_report_uploads')
        .upsert({
          clinic_id: clinicId,
          report_date: reportDate,
          file_name: preview.fileName,
          mid: preview.meta.mid,
          mpan: preview.meta.mpan,
          total_count: preview.transactions.length,
          total_amount: preview.transactions.reduce((s, t) => s + t.amount, 0),
          total_net: preview.transactions.reduce((s, t) => s + t.netAmount, 0),
          uploaded_by: user?.id || null,
        }, { onConflict: 'clinic_id,report_date' })
        .select('id')
        .single();
      if (upErr) throw upErr;

      // Lewati transaksi yang RRN-nya sudah tersimpan (unggah ulang laporan yang sama aman).
      const rrns = preview.transactions.map((t) => t.rrn).filter(Boolean);
      const { data: existing } = rrns.length
        ? await supabase.from('qris_report_transactions').select('rrn').eq('clinic_id', clinicId).in('rrn', rrns)
        : { data: [] };
      const existingRrn = new Set((existing || []).map((e) => e.rrn));
      const rows = preview.transactions
        .filter((t) => !t.rrn || !existingRrn.has(t.rrn))
        .map((t) => ({
          upload_id: upload.id,
          clinic_id: clinicId,
          trx_date: t.dateStr,
          trx_time: t.timeStr,
          issuer: t.issuer,
          customer_name: t.customerName,
          ref_no: t.refNo,
          rrn: t.rrn,
          amount: t.amount,
          mdr: t.mdr,
          net_amount: t.netAmount,
        }));
      if (rows.length) {
        const { error: insErr } = await supabase.from('qris_report_transactions').insert(rows);
        if (insErr) throw insErr;
      }

      const autoCount = await runAutoMatch(reportDate);
      toast({
        title: 'Laporan tersimpan',
        description: `${rows.length} transaksi baru, ${preview.transactions.length - rows.length} sudah ada sebelumnya. ${autoCount} dicocokkan otomatis.`,
      });
      setPreview(null);
      await loadUploads();
      if (selectedDate === reportDate) await loadDetail(reportDate); else setSelectedDate(reportDate);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const setMatch = async (transactionId, recapId) => {
    const patch = recapId
      ? { matched_recap_id: recapId, match_method: 'manual', matched_at: new Date().toISOString(), matched_by: user?.id || null }
      : { matched_recap_id: null, match_method: null, matched_at: null, matched_by: null };
    const { error } = await supabase.from('qris_report_transactions').update(patch).eq('id', transactionId).eq('clinic_id', clinicId);
    if (error) { toast({ variant: 'destructive', title: 'Gagal menyimpan pencocokan', description: error.message }); return; }
    loadDetail(selectedDate);
  };

  const handleRematch = async () => {
    const n = await runAutoMatch(selectedDate);
    toast({ title: n ? `${n} transaksi dicocokkan` : 'Tidak ada pasangan baru yang ditemukan' });
    loadDetail(selectedDate);
  };

  const handleDelete = async () => {
    const upload = uploads.find((u) => u.report_date === selectedDate);
    if (!upload) return;
    if (!await confirmAction(`Hapus laporan QRIS ${fmtDate(upload.report_date)} beserta hasil pencocokannya? PDF bisa diunggah ulang.`)) return;
    const { error } = await supabase.from('qris_report_uploads').delete().eq('id', upload.id).eq('clinic_id', clinicId);
    if (error) { toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message }); return; }
    setSelectedDate(null);
    setDetail({ transactions: [], portions: [] });
    const list = await loadUploads();
    if (list.length) setSelectedDate(list[0].report_date);
  };

  // --- Turunan tampilan -------------------------------------------------------
  const portionById = useMemo(() => Object.fromEntries(detail.portions.map((p) => [p.recapId, p])), [detail.portions]);
  const matchedRecapIds = useMemo(() => new Set(detail.transactions.map((t) => t.matched_recap_id).filter(Boolean)), [detail.transactions]);
  const unmatchedTrx = detail.transactions.filter((t) => !t.matched_recap_id);
  const matchedTrx = detail.transactions.filter((t) => t.matched_recap_id);
  const freePortions = detail.portions.filter((p) => !matchedRecapIds.has(p.recapId));
  const bankTotal = detail.transactions.reduce((s, t) => s + Number(t.amount), 0);
  const recapTotal = detail.portions.reduce((s, p) => s + p.amount, 0);
  const selisih = bankTotal - recapTotal;
  const allClear = detail.transactions.length > 0 && unmatchedTrx.length === 0 && freePortions.length === 0;

  if (!isKaffah) {
    return (
      <div className="p-6 text-sm text-slate-600">Fitur rekonsiliasi QRIS harian hanya tersedia untuk Kaffah Physiotherapy.</div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      <Helmet><title>Rekonsiliasi QRIS Harian</title></Helmet>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><QrCode className="w-6 h-6 text-emerald-600" /> Rekonsiliasi QRIS Harian</h1>
        <p className="text-sm text-slate-500 mt-1">
          Setiap malam unggah PDF <b>Laporan Transaksi</b> dari BSI Merchant. Transaksi QRIS di laporan akan dicocokkan otomatis dengan pembayaran QRIS di Daily Recap hari itu.
        </p>
      </div>

      {/* Upload */}
      <Card>
        <CardContent className="pt-6">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-emerald-400'}`}
          >
            <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            {parsing ? (
              <div className="flex flex-col items-center gap-2 text-slate-600"><Loader2 className="w-8 h-8 animate-spin" /> Membaca PDF...</div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-600">
                <UploadCloud className="w-8 h-8 text-emerald-600" />
                <span className="font-medium">Klik atau seret PDF Laporan Transaksi QRIS ke sini</span>
                <span className="text-xs text-slate-400">Format: BSI Merchant &rsaquo; Laporan Transaksi (PDF)</span>
              </div>
            )}
          </div>

          {preview && (
            <div className="mt-4 rounded-lg border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium"><FileText className="w-4 h-4" /> {preview.fileName}</div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><div className="text-slate-500 text-xs">Tanggal laporan</div><div className="font-semibold">{preview.meta.periodStart ? fmtDate(preview.meta.periodStart) : '-'}</div></div>
                <div><div className="text-slate-500 text-xs">Jumlah transaksi</div><div className="font-semibold">{preview.transactions.length}</div></div>
                <div><div className="text-slate-500 text-xs">Total nominal</div><div className="font-semibold">{formatRp(preview.transactions.reduce((s, t) => s + t.amount, 0))}</div></div>
              </div>
              {previewIssues.length > 0 && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
                  {previewIssues.map((i) => <div key={i} className="flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {i}</div>)}
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Simpan & Cocokkan</Button>
                <Button variant="outline" onClick={() => setPreview(null)} disabled={saving}>Batal</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Riwayat */}
      {uploads.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <History className="w-4 h-4 text-slate-400 shrink-0" />
          {uploads.map((u) => (
            <Button key={u.id} size="sm" variant={u.report_date === selectedDate ? 'default' : 'outline'} onClick={() => setSelectedDate(u.report_date)} className="shrink-0">
              {format(parseISO(u.report_date), 'd MMM yyyy', { locale: localeId })}
            </Button>
          ))}
        </div>
      )}

      {/* Detail */}
      {selectedDate && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{fmtDate(selectedDate)}</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleRematch}><RefreshCw className="w-4 h-4 mr-1" /> Cocokkan ulang</Button>
              <Button size="sm" variant="outline" className="text-red-600" onClick={handleDelete}><Trash2 className="w-4 h-4 mr-1" /> Hapus</Button>
            </div>
          </div>

          {loadingDetail ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Memuat...</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card><CardContent className="pt-4"><div className="text-xs text-slate-500">Laporan bank</div><div className="font-bold">{formatRp(bankTotal)}</div><div className="text-xs text-slate-400">{detail.transactions.length} transaksi</div></CardContent></Card>
                <Card><CardContent className="pt-4"><div className="text-xs text-slate-500">QRIS di Daily Recap</div><div className="font-bold">{formatRp(recapTotal)}</div><div className="text-xs text-slate-400">{detail.portions.length} pembayaran</div></CardContent></Card>
                <Card><CardContent className="pt-4"><div className="text-xs text-slate-500">Selisih</div><div className={`font-bold ${selisih === 0 ? 'text-emerald-600' : 'text-red-600'}`}>{selisih === 0 ? 'Rp 0' : formatRp(selisih)}</div></CardContent></Card>
                <Card><CardContent className="pt-4"><div className="text-xs text-slate-500">Status</div>
                  {allClear ? <Badge className="bg-green-100 text-green-700 border-green-200 gap-1"><CheckCircle2 className="w-3 h-3" /> Semua cocok</Badge>
                    : <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1"><AlertTriangle className="w-3 h-3" /> {unmatchedTrx.length + freePortions.length} perlu dicek</Badge>}
                </CardContent></Card>
              </div>

              {unmatchedTrx.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2 text-red-700"><XCircle className="w-4 h-4" /> Ada di laporan bank, belum cocok dengan recap ({unmatchedTrx.length})</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {unmatchedTrx.map((t) => {
                      const cands = freePortions.filter((p) => Math.round(p.amount) === Math.round(t.amount));
                      return (
                        <div key={t.id} className="rounded-lg border border-red-100 bg-red-50/40 p-3 text-sm">
                          <div className="flex flex-wrap justify-between gap-1">
                            <div><span className="font-semibold">{t.customer_name || '-'}</span> <span className="text-slate-500">· {t.issuer} · {t.trx_time}</span></div>
                            <div className="font-bold">{formatRp(t.amount)}</div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 items-center">
                            {cands.length === 0 ? (
                              <span className="text-xs text-slate-500">Tidak ada pembayaran QRIS bernominal sama di Daily Recap hari ini.</span>
                            ) : (
                              <>
                                <span className="text-xs text-slate-500">Pilih pasien:</span>
                                {cands.map((p) => (
                                  <Button key={p.recapId} size="sm" variant="outline" onClick={() => setMatch(t.id, p.recapId)}>
                                    <Link2 className="w-3.5 h-3.5 mr-1" /> {p.name}{p.time ? ` (${p.time})` : ''}
                                  </Button>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {freePortions.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2 text-amber-700"><AlertTriangle className="w-4 h-4" /> Tercatat QRIS di Daily Recap, tidak ada di laporan bank ({freePortions.length})</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {freePortions.map((p) => (
                      <div key={p.recapId} className="flex justify-between rounded-lg border border-amber-100 bg-amber-50/40 p-3 text-sm">
                        <span className="font-medium">{p.name}{p.time ? <span className="text-slate-500"> · {p.time}</span> : null}</span>
                        <span className="font-bold">{formatRp(p.amount)}</span>
                      </div>
                    ))}
                    <p className="text-xs text-slate-500">Kemungkinan: metode bayar salah dicatat sebagai QRIS (sebenarnya cash/transfer), nominal salah ketik, atau pembayaran masuk di laporan hari lain.</p>
                  </CardContent>
                </Card>
              )}

              {matchedTrx.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2 text-green-700"><CheckCircle2 className="w-4 h-4" /> Cocok ({matchedTrx.length})</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {matchedTrx.map((t) => {
                      const p = portionById[t.matched_recap_id];
                      return (
                        <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-green-100 bg-green-50/40 p-3 text-sm">
                          <div>
                            <div><span className="font-semibold">{p?.name || 'Recap'}</span> <span className="text-slate-500">← {t.customer_name} · {t.issuer} · {t.trx_time}</span></div>
                            <div className="text-xs text-slate-400">RRN {t.rrn} · {t.match_method === 'manual' ? 'dicocokkan manual' : 'otomatis'}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{formatRp(t.amount)}</span>
                            <Button size="icon" variant="ghost" title="Lepas pencocokan" onClick={() => setMatch(t.id, null)}><Unlink className="w-4 h-4" /></Button>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminQrisReconciliation;
