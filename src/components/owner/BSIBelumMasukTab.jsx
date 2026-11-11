import React, { useState, useCallback } from 'react';
import { UploadCloud, Loader2, AlertTriangle, CheckCircle2, Info, Hourglass } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import { parseMutasiPdf } from '@/utils/bsiMutasiPdfParser';
import { buildUnits, reconcileSettlement, addDays } from '@/utils/bsiPendingSettlement';

const formatRp = (n) => `Rp ${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const fmtDate = (ymd) => {
  if (!ymd) return '-';
  const [y, m, d] = ymd.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
const METHOD_LABEL = { qris: 'QRIS', debit: 'Debit', transfer: 'Transfer' };
const todayWita = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });

// Ambil semua baris (Supabase membatasi 1000 baris per permintaan).
const fetchAll = async (build) => {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
};

const Stat = ({ label, value, sub, tone = 'slate' }) => {
  const tones = {
    slate: 'border-slate-200 bg-white',
    green: 'border-emerald-200 bg-emerald-50',
    amber: 'border-amber-300 bg-amber-50',
    red: 'border-rose-200 bg-rose-50',
  };
  return (
    <div className={cn('rounded-lg border p-4', tones[tone])}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900 break-words">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
};

const BSIBelumMasukTab = ({ clinicId }) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const handleFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    setData(null);
    setFileName(file.name);
    try {
      const parsed = await parseMutasiPdf(file);
      const { meta, credits } = parsed;
      if (!meta.periodStart) throw new Error('Periode mutasi tidak terbaca dari PDF.');

      const from = addDays(meta.periodStart, -10); // 10 hari ke belakang untuk debit/QRIS yang masuk telat
      const to = [todayWita(), meta.periodEnd || meta.periodStart].sort().pop();

      const [recaps, incomes] = await Promise.all([
        fetchAll(() =>
          supabase
            .from('daily_recaps')
            .select('id, recap_date, revenue_date, payment_method, amount, full_name, guest_name, end_time, status')
            .eq('clinic_id', clinicId)
            .gte('revenue_date', from)
            .lte('revenue_date', to)
            .gt('amount', 0)
            .order('id')
        ),
        fetchAll(() =>
          supabase
            .from('admin_income')
            .select('id, date, amount, payment_method, description, sub_category, created_at')
            .eq('clinic_id', clinicId)
            .gte('date', from)
            .lte('date', to)
            .order('id')
        ),
      ]);

      const splits = [];
      const ids = recaps.map((r) => r.id);
      for (let i = 0; i < ids.length; i += 200) {
        const { data: sp, error: spErr } = await supabase
          .from('daily_recap_payment_splits')
          .select('id, recap_id, payment_method, amount')
          .in('recap_id', ids.slice(i, i + 200));
        if (spErr) throw spErr;
        splits.push(...(sp || []));
      }

      const units = buildUnits({ recaps, splits, incomes });
      const result = reconcileSettlement({
        credits,
        units,
        periodStart: meta.periodStart,
        asOf: meta.periodEnd || meta.periodStart,
      });
      setData({ parsed, result, loadedAt: new Date() });
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Gagal membaca file.');
      toast({ title: 'Gagal memproses mutasi', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }, [clinicId, toast]);

  const parsed = data?.parsed;
  const r = data?.result;
  const s = r?.summary;
  const check = parsed?.check;
  const parseOk = check && check.creditTotalOk !== false && check.balanceMismatch === 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <label className={cn(
              'flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-app-sm border-2 border-dashed border-slate-300 hover:border-app-accent-bright hover:bg-app-soft text-sm font-medium text-slate-600',
              busy && 'pointer-events-none opacity-60'
            )}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4 text-app-accent-bright" />}
              <span className="break-words max-w-[260px] sm:truncate">{fileName || 'Pilih PDF Mutasi Rekening BSI'}</span>
              <input type="file" accept=".pdf" className="hidden" onChange={handleFile} disabled={busy} />
            </label>
            <p className="text-xs text-slate-500">
              Unduh "Mutasi Rekening" (PDF) dari BSINet lalu upload di sini. File hanya dibaca di browser dan tidak disimpan.
            </p>
          </div>
          {error && (
            <p className="text-sm text-rose-600 flex items-start gap-1.5"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{error}</p>
          )}
        </CardContent>
      </Card>

      {!data && !busy && !error && (
        <p className="text-sm text-slate-500 text-center py-6">
          Upload mutasi untuk melihat pembayaran QRIS, debit, dan transfer yang belum masuk ke rekening.
        </p>
      )}

      {data && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <Badge variant="outline">Rek. {parsed.meta.accountNo || '-'}</Badge>
            <Badge variant="outline">Periode {fmtDate(parsed.meta.periodStart)} – {fmtDate(parsed.meta.periodEnd)}</Badge>
            <Badge variant="outline">{check.creditCount} uang masuk terbaca</Badge>
            <Badge className={cn(parseOk ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800')}>
              {parseOk ? <CheckCircle2 className="w-3 h-3 mr-1 inline" /> : <AlertTriangle className="w-3 h-3 mr-1 inline" />}
              {check.creditTotalOk === null
                ? 'Total kredit tidak bisa dicek'
                : check.creditTotalOk
                  ? `Total kredit cocok dengan PDF (${formatRp(check.sumCredits)})`
                  : `Total kredit TIDAK cocok: terbaca ${formatRp(check.sumCredits)}, di PDF ${formatRp(parsed.meta.headerTotalCredit)}`}
            </Badge>
            {check.balanceMismatch > 0 && (
              <Badge className="bg-amber-100 text-amber-800">{check.balanceMismatch} baris saldo tidak nyambung — cek hasil dengan teliti</Badge>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Seharusnya masuk (net)" value={formatRp(s.expectedNet)} sub={`${s.expectedCount} pembayaran non-tunai sejak ${fmtDate(parsed.meta.periodStart)}`} />
            <Stat label="Sudah masuk rekening" value={formatRp(s.receivedNet)} tone="green" />
            <Stat
              label="BELUM masuk (perkiraan net)"
              value={formatRp(s.pendingNet)}
              sub={`${s.pendingCount} pembayaran • bruto ${formatRp(s.pendingGross)}`}
              tone={s.pendingOverdueCount > 0 ? 'red' : 'amber'}
            />
            <Stat
              label="Masuk tapi tidak ada di rekap"
              value={formatRp(s.unmatchedCreditSum)}
              sub={`${s.unmatchedCreditCount} setoran`}
              tone={s.unmatchedCreditCount > 0 ? 'red' : 'slate'}
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Hourglass className="w-4 h-4" /> Belum masuk rekening</CardTitle>
            </CardHeader>
            <CardContent>
              {r.pending.length === 0 ? (
                <p className="text-sm text-emerald-700 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Semua pembayaran non-tunai sudah masuk rekening.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 border-b">
                        <th className="py-2 pr-3">Tanggal</th>
                        <th className="py-2 pr-3">Pasien / Keterangan</th>
                        <th className="py-2 pr-3">Metode</th>
                        <th className="py-2 pr-3 text-right">Bruto</th>
                        <th className="py-2 pr-3 text-right">Perkiraan net</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.pending.map((u) => (
                        <tr key={u.id} className="border-b last:border-0 align-top">
                          <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(u.date)}{u.time ? ` ${u.time}` : ''}</td>
                          <td className="py-2 pr-3 break-words">
                            {u.name}
                            {u.kind === 'lainnya' && <span className="ml-1 text-xs text-slate-400">(pemasukan lain)</span>}
                            {u.ambiguous && (
                              <p className="text-xs text-slate-400">Ada transaksi lain dengan nominal sama di hari itu, jadi nama bisa tertukar.</p>
                            )}
                          </td>
                          <td className="py-2 pr-3">{METHOD_LABEL[u.method]}</td>
                          <td className="py-2 pr-3 text-right whitespace-nowrap">{formatRp(u.amount)}</td>
                          <td className="py-2 pr-3 text-right whitespace-nowrap font-medium">{formatRp(u.net)}</td>
                          <td className="py-2">
                            {u.overdue
                              ? <Badge className="bg-rose-100 text-rose-700">Lewat {u.ageDays} hari — cek</Badge>
                              : <Badge className="bg-amber-100 text-amber-800">{u.ageDays <= 0 ? 'Hari ini' : `H+${u.ageDays}`} — wajar</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 text-xs text-slate-500 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                Perkiraan net sudah dikurangi MDR (QRIS di atas Rp500.000 = 0,3%, debit = 0,15%). QRIS biasanya masuk sore hari yang sama atau pagi
                hari berikutnya; debit sampai beberapa hari. Transaksi sebelum {fmtDate(parsed.meta.periodStart)} ({s.assumedCount} pembayaran,
                {' '}{formatRp(s.assumedGross)}) dianggap sudah masuk.
              </p>
            </CardContent>
          </Card>

          {r.unmatchedCredits.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Uang masuk yang tidak cocok dengan rekap</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 border-b">
                        <th className="py-2 pr-3">Masuk</th><th className="py-2 pr-3">Keterangan</th>
                        <th className="py-2 pr-3 text-right">Nominal</th><th className="py-2">Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.unmatchedCredits.map((c) => (
                        <tr key={c.id} className="border-b last:border-0">
                          <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(c.dateStr)} {c.time}</td>
                          <td className="py-2 pr-3 break-words">{c.desc}</td>
                          <td className="py-2 pr-3 text-right whitespace-nowrap">{formatRp(c.amount)}</td>
                          <td className="py-2 text-xs text-slate-500">
                            {c.beforePeriod ? 'Transaksi periode sebelumnya (diabaikan)' : 'Tidak ada pembayaran non-tunai yang cocok — cek apakah dicatat Cash atau belum di-input'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Per tanggal transaksi</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b">
                      <th className="py-2 pr-3">Tanggal</th><th className="py-2 pr-3 text-right">Transaksi</th>
                      <th className="py-2 pr-3 text-right">Seharusnya (net)</th><th className="py-2 pr-3 text-right">Sudah masuk</th>
                      <th className="py-2 text-right">Belum masuk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.perDay.map((d) => (
                      <tr key={d.date} className="border-b last:border-0">
                        <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(d.date)}</td>
                        <td className="py-2 pr-3 text-right">{d.count}</td>
                        <td className="py-2 pr-3 text-right whitespace-nowrap">{formatRp(d.expectedNet)}</td>
                        <td className="py-2 pr-3 text-right whitespace-nowrap">{formatRp(d.receivedNet)}</td>
                        <td className={cn('py-2 text-right whitespace-nowrap', d.pendingNet > 0 && 'font-semibold text-amber-700')}>
                          {d.pendingNet > 0 ? formatRp(d.pendingNet) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <details className="rounded-lg border bg-white p-4 text-sm">
            <summary className="cursor-pointer font-medium text-slate-700">Detail pencocokan ({r.matches.length} setoran)</summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b">
                    <th className="py-2 pr-3">Masuk</th><th className="py-2 pr-3 text-right">Nominal</th><th className="py-2">Cocok dengan</th>
                  </tr>
                </thead>
                <tbody>
                  {r.matches.map((m) => (
                    <tr key={m.credit.id} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(m.credit.dateStr)} {m.credit.time}</td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">{formatRp(m.credit.amount)}</td>
                      <td className="py-2 break-words">
                        {m.units.map((u) => `${u.name} (${fmtDate(u.date)}, ${formatRp(u.amount)})`).join(' + ')}
                        {m.units.length > 1 && <span className="ml-1 text-xs text-slate-400">dibayar sekaligus</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
};

export default BSIBelumMasukTab;
