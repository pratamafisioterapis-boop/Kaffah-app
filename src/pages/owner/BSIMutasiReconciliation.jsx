import React, { useState, useCallback, useEffect } from 'react';
import {
  Upload, FileText, AlertTriangle, CheckCircle2, XCircle,
  QrCode, CreditCard, ArrowLeftRight, Search, RefreshCw,
  ChevronDown, ChevronUp, Info, Calendar, UploadCloud,
  CheckCircle, Clock, Trash2, FilePlus2, FileSearch2, Landmark
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
  format, getDaysInMonth, startOfMonth, endOfMonth, parseISO, getMonth, getYear
} from 'date-fns';
import { id as localeId } from 'date-fns/locale';

// --- Helpers ----------------------------------------------------------------

const parseAmount = (str) => {
  if (!str) return 0;
  return parseFloat(str.replace(/,/g, '').replace(/-$/, '').trim()) || 0;
};

const formatRp = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

const parseBSIDate = (str) => {
  if (!str) return null;
  const match = str.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2})\.(\d{2})/);
  if (!match) return null;
  const [, dd, mm, yyyy, hh, min] = match;
  return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00`);
};

const toDateStr = (dateObj) => {
  if (!dateObj) return null;
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const detectType = (desc) => {
  if (!desc) return 'other';
  const d = desc.trim();
  if (/^QR\s+\d{6}\s+/i.test(d)) return 'qris';
  if (/TRF Dari\s*-/i.test(d)) return 'transfer';
  if (/^\d{15,}$/.test(d)) return 'debit';
  return 'other';
};

const extractQrisTransactionDate = (desc) => {
  const match = desc?.match(/^QR\s+(\d{6})\s+/i);
  if (!match) return null;
  const raw = match[1];
  const dd = raw.slice(0, 2);
  const mm = raw.slice(2, 4);
  const yy = raw.slice(4, 6);
  const year = parseInt(yy) + 2000;
  return new Date(`${year}-${mm}-${dd}`);
};

const parseBSICSV = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex(l => l.includes('Waktu Transaksi'));
  if (headerIdx === -1) throw new Error('Format CSV tidak dikenali. Pastikan ini file mutasi rekening BSI.');

  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const fields = [];
    let cur = '';
    let inQuote = false;
    for (let ci = 0; ci < line.length; ci++) {
      const ch = line[ci];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { fields.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    fields.push(cur.trim());

    if (fields.length < 8) continue;

    const [waktuTransaksi, , namaPengirim, , , , deskripsi, debet, kredit] = fields;
    const creditAmt = parseAmount(kredit);
    if (creditAmt <= 0) continue;

    const tipe = detectType(deskripsi);
    if (tipe === 'other') continue;

    const masukDate = parseBSIDate(waktuTransaksi);
    const qrisTrxDate = tipe === 'qris' ? extractQrisTransactionDate(deskripsi) : null;

    rows.push({
      waktuTransaksi,
      masukDate,
      masukDateStr: toDateStr(masukDate),
      namaPengirim: namaPengirim || '',
      deskripsi,
      amount: creditAmt,
      tipe,
      qrisTrxDate,
      qrisTrxDateStr: toDateStr(qrisTrxDate),
      bulan: masukDate ? masukDate.getMonth() + 1 : null,
      tahun: masukDate ? masukDate.getFullYear() : null,
    });
  }
  return rows;
};

// Generate daftar bulan dari Jan 2026 sampai bulan ini
const generateMonthList = () => {
  const months = [];
  const now = new Date();
  let cur = new Date(2026, 0, 1);
  while (cur <= now) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return months.reverse(); // terbaru di atas
};

const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

// Parse PDF teks EDC BSI
const parseDebitEDCPdf = async (file) => {
  // Load pdf.js via script tag jika belum ada
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map(item => item.str).join(' ') + '\n';
  }

  console.log('PDF Text:', fullText);

  // Extract Report Date (format DDMMYYYY)
  const dateMatch = fullText.match(/Report\s*Date\s+(\d{2})(\d{2})(\d{4})/i);
  let reportDate = null;
  if (dateMatch) {
    const [, dd, mm, yyyy] = dateMatch;
    reportDate = `${yyyy}-${mm}-${dd}`;
  }

  // Extract Sales Volume Total
  const salesMatch = fullText.match(/Sales\s*Volume\s+Total\s+([\d,]+\.?\d*)/i);
  let salesVolume = 0;
  if (salesMatch) {
    salesVolume = parseFloat(salesMatch[1].replace(/,/g, '')) || 0;
  }

  // Extract Account Name
  const accountMatch = fullText.match(/BANK\s+SYARIAH\s+INDO[A-Z]*/i);
  const accountName = accountMatch ? accountMatch[0] : 'BSI EDC';

  // Extract Net/MDR Amount kalau ada di teks PDF (opsional, tidak semua format punya ini eksplisit)
  const nettMatch = fullText.match(/N(?:et|ett)\s*Amount\s+Total\s+([\d,]+\.?\d*)/i);
  const netAmount = nettMatch ? (parseFloat(nettMatch[1].replace(/,/g, '')) || null) : null;
  const mdrMatch = fullText.match(/MDR\s*(?:Amount)?\s+Total\s+([\d,]+\.?\d*)/i);
  const mdrAmount = mdrMatch ? (parseFloat(mdrMatch[1].replace(/,/g, '')) || null) : null;

  return { reportDate, salesVolume, mdrAmount, netAmount, accountName, rawText: fullText };
};

// Split satu baris CSV dengan benar (menangani angka yang dibungkus tanda kutip
// dan mengandung koma, mis. "530,000.00")
const splitCsvLine = (line) => {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
};

// Parse CSV "Merchant Statement" EDC BSI (format kedua selain PDF)
const parseDebitEDCCsv = (text) => {
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);

  // Baris: Report Date,10-07-2026,10-07-2026
  let reportDate = null;
  const reportDateLine = lines.find(l => l.toUpperCase().startsWith('REPORT DATE'));
  if (reportDateLine) {
    const cols = splitCsvLine(reportDateLine);
    const m = (cols[1] || '').trim().match(/(\d{2})-(\d{2})-(\d{4})/);
    if (m) reportDate = `${m[3]}-${m[2]}-${m[1]}`;
  }

  // Baris: Group Name,KAFFAH PHYSIOTHERAPY,
  let accountName = 'BSI EDC';
  const groupNameLine = lines.find(l => l.toUpperCase().startsWith('GROUP NAME'));
  if (groupNameLine) {
    const cols = splitCsvLine(groupNameLine);
    if (cols[1]?.trim()) accountName = cols[1].trim();
  }

  // Ambil baris TOTAL pertama (dari section DETAIL, sebelum SUMMARY GROUP).
  // Kolom ke-23 (index 22) = AMOUNT (gross/sales volume), ke-25 (index 24) = MDR Amount,
  // ke-26 (index 25) = NET AMOUNT — sesuai urutan header DETAIL.
  let salesVolume = 0;
  let mdrAmount = null;
  let netAmount = null;
  for (const line of lines) {
    if (line.toUpperCase().startsWith('SUMMARY GROUP')) break;
    if (line.toUpperCase().startsWith('TOTAL,')) {
      const cols = splitCsvLine(line);
      const amountStr = (cols[22] || '').replace(/,/g, '').trim();
      salesVolume = parseFloat(amountStr) || 0;
      const mdrStr = (cols[24] || '').replace(/,/g, '').trim();
      mdrAmount = mdrStr ? (parseFloat(mdrStr) || null) : null;
      const netStr = (cols[25] || '').replace(/,/g, '').trim();
      netAmount = netStr ? (parseFloat(netStr) || null) : null;
      break;
    }
  }

  return { reportDate, salesVolume, mdrAmount, netAmount, accountName, rawText: clean };
};
// Cari kombinasi recap yang totalnya paling mendekati targetAmount (dalam toleransi)
// Pakai DP subset-sum (0/1 knapsack) dengan satuan ratusan rupiah biar ringan.
const findMatchingCombo = (recaps, targetAmount, toleranceRp = 5000) => {
  const scale = 100;
  const target = Math.round(targetAmount / scale);
  const tol = Math.round(toleranceRp / scale);
  const maxSum = target + tol;
  const items = recaps.filter(r => Number(r.amount) > 0 && Math.round(Number(r.amount) / scale) <= maxSum);

  const dp = new Array(maxSum + 1).fill(null); // dp[s] = { itemIdx, prevSum } | null
  dp[0] = { itemIdx: -1, prevSum: -1 };
  for (let i = 0; i < items.length; i++) {
    const amt = Math.round(Number(items[i].amount) / scale);
    if (amt <= 0) continue;
    for (let s = maxSum; s >= amt; s--) {
      if (dp[s - amt] && !dp[s]) {
        dp[s] = { itemIdx: i, prevSum: s - amt };
      }
    }
  }

  let bestS = null;
  let bestDiff = Infinity;
  for (let s = Math.max(0, target - tol); s <= maxSum; s++) {
    if (dp[s]) {
      const diff = Math.abs(s - target);
      if (diff < bestDiff) { bestDiff = diff; bestS = s; }
    }
  }
  if (bestS === null || bestS === 0) return [];

  const used = [];
  let cur = bestS;
  while (cur > 0 && dp[cur]) {
    used.push(items[dp[cur].itemIdx]);
    cur = dp[cur].prevSum;
  }
  return used;
};
// --- Sub-components ----------------------------------------------------------

const TypeBadge = ({ tipe }) => {
  if (tipe === 'qris') return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1"><QrCode className="w-3 h-3" /> QRIS</Badge>;
  if (tipe === 'debit') return <Badge className="bg-blue-100 text-blue-700 border-blue-200 gap-1"><CreditCard className="w-3 h-3" /> Debit</Badge>;
  if (tipe === 'transfer') return <Badge className="bg-purple-100 text-purple-700 border-purple-200 gap-1"><ArrowLeftRight className="w-3 h-3" /> Transfer</Badge>;
  return null;
};

const StatusBadge = ({ status }) => {
  if (status === 'matched') return <Badge className="bg-green-100 text-green-700 border-green-200 gap-1"><CheckCircle2 className="w-3 h-3" /> Cocok</Badge>;
  if (status === 'unmatched') return <Badge className="bg-red-100 text-red-700 border-red-200 gap-1"><XCircle className="w-3 h-3" /> Belum Cocok</Badge>;
  return null;
};

// --- UnmatchedRecapPicker ---------------------------------------------------

const UnmatchedRecapPicker = ({ row, allRecaps, mutasiChecks, onCheck, onLoad, matchedRecapIds = new Set() }) => {
  React.useEffect(() => { onLoad(); }, []);

  // Filter tanggal sesuai tipe transaksi
  const relevantDates = new Set();
  if (row.tipe === 'qris') {
    // QRIS: hanya tanggal transaksi (dari deskripsi QR)
    if (row.tgl_transaksi) relevantDates.add(row.tgl_transaksi);
  } else if (row.tipe === 'transfer') {
    // Transfer: tgl_masuk rekening sampai 3 hari setelahnya
    const base = new Date(row.tgl_masuk + 'T12:00:00');
    for (let d = 0; d <= 3; d++) {
      const dt = new Date(base);
      dt.setDate(dt.getDate() + d);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      relevantDates.add(`${y}-${m}-${day}`);
    }
  }
  const candidates = allRecaps.filter(r => relevantDates.has(r.recap_date) && Number(r.amount) > 0);

  if (!allRecaps.length) {
    return <p className="text-xs text-slate-400 py-2">Memuat data recap...</p>;
  }

  if (!candidates.length) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-amber-700">Pilih transaksi daily recap yang cocok:</p>
        <p className="text-xs text-slate-400">Tidak ada recap di tanggal {row.tgl_masuk} / {row.tgl_transaksi}.</p>
        <p className="text-xs text-slate-400">Cari di panel "Semua Transaksi Daily Recap" di bawah.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-amber-700">Pilih transaksi daily recap yang cocok dengan mutasi Rp {Number(row.nominal || row.amount).toLocaleString('id-ID')}:</p>
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-amber-50 border-b text-amber-800 uppercase tracking-wide">
              <th className="px-3 py-2 text-left w-8">✓</th>
              <th className="px-3 py-2 text-left">Pasien</th>
              <th className="px-3 py-2 text-left">Tgl</th>
              <th className="px-3 py-2 text-left">Metode</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Nominal</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map(recap => {
              const checkRecord = mutasiChecks[recap.id];
              const isChecked = !!checkRecord?.is_checked && checkRecord?.mutasi_transaction_id === row.id;
              const isAlreadyMatched = matchedRecapIds.has(recap.id) && !isChecked;
              return (
                <tr
                  key={recap.id}
                  onClick={() => onCheck(recap, !isChecked, row)}
                  className={cn('border-b cursor-pointer transition-colors',
                    isChecked ? 'bg-green-50' :
                    isAlreadyMatched ? 'bg-blue-50/50' :
                    'hover:bg-amber-50'
                  )}
                >
                  <td className="px-3 py-2">
                    <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center', isChecked ? 'bg-green-500 border-green-500' : 'border-slate-300')}>
                      {isChecked && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-800">
                    {recap.patient_name}
                    {recap.kind === 'admin_income' && (
                      <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700 align-middle">Pemasukan Lain</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{recap.recap_date}</td>
                  <td className="px-3 py-2 text-slate-500">{recap.payment_method}</td>
                  <td className="px-3 py-2">
                    {isChecked ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle2 className="w-3 h-3" /> Dipilih
                      </span>
                    ) : isAlreadyMatched ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        ✓ Auto match
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-slate-800">{formatRp(recap.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- DebitSettlementDetail ---------------------------------------------------

const DebitSettlementDetail = ({ settlement, mutasiNominal, selisih }) => {
  const [patients, setPatients] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: checks } = await supabase
        .from('bsi_reconciliation_checks')
        .select('daily_recap_id')
        .eq('source_type', 'debit_settlement')
        .eq('debit_settlement_id', settlement.id)
        .eq('is_checked', true);
      const recapIds = (checks || []).map(c => c.daily_recap_id).filter(Boolean);
      if (!recapIds.length) {
        if (!cancelled) { setPatients([]); setLoading(false); }
        return;
      }
      const { data: recaps } = await supabase
        .from('daily_recaps')
        .select('id, recap_date, amount, patient_id, actual_patient_id, full_name, guest_name')
        .in('id', recapIds);
      const allIds = (recaps || []).flatMap(r => [r.patient_id, r.actual_patient_id]).filter(Boolean);
      let patientMap = {};
      if (allIds.length) {
        const { data: pts } = await supabase.from('patients').select('id, full_name').in('id', [...new Set(allIds)]);
        (pts || []).forEach(p => { patientMap[p.id] = p.full_name; });
      }
      const enriched = (recaps || []).map(r => ({
        ...r,
        patient_name: patientMap[r.actual_patient_id] || patientMap[r.patient_id] || r.full_name || r.guest_name || '-',
      }));
      if (!cancelled) { setPatients(enriched); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [settlement.id]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4 text-sm">
        <div><span className="text-slate-500 text-xs uppercase font-semibold">File Settlement</span><p className="font-semibold text-slate-800">{settlement.file_name}</p></div>
        <div><span className="text-slate-500 text-xs uppercase font-semibold">Sales Volume</span><p className="font-semibold text-slate-800">{formatRp(settlement.sales_volume)}</p></div>
        <div><span className="text-slate-500 text-xs uppercase font-semibold">MDR</span><p className="font-semibold text-slate-800">{settlement.mdr_amount != null ? formatRp(settlement.mdr_amount) : '-'}</p></div>
        <div><span className="text-slate-500 text-xs uppercase font-semibold">Net Amount</span><p className="font-semibold text-green-700">{settlement.net_amount != null ? formatRp(settlement.net_amount) : '-'}</p></div>
        <div>
          <span className="text-slate-500 text-xs uppercase font-semibold">Masuk Rekening</span>
          <p className={cn('font-semibold', selisih === 0 ? 'text-green-700' : selisih != null ? 'text-amber-600' : 'text-slate-800')}>
            {formatRp(mutasiNominal)}{selisih != null && selisih !== 0 ? ` (selisih ${formatRp(Math.abs(selisih))})` : ''}
          </p>
        </div>
      </div>
      <div className="border-t pt-2">
        <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Pasien yang sudah ter-Auto Match (dari tab Debit EDC)</p>
        {loading ? (
          <p className="text-xs text-slate-400">Memuat...</p>
        ) : !patients?.length ? (
          <p className="text-xs text-slate-400">Belum ada pasien yang di-Auto Match untuk settlement ini. Buka tab Debit EDC untuk cocokkan.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 uppercase">
                <th className="text-left py-1">Pasien</th>
                <th className="text-left py-1">Tgl</th>
                <th className="text-right py-1">Nominal</th>
              </tr>
            </thead>
            <tbody>
              {patients.map(p => (
                <tr key={p.id} className="border-t">
                  <td className="py-1 font-medium text-slate-800">{p.patient_name}</td>
                  <td className="py-1 text-slate-500">{p.recap_date}</td>
                  <td className="py-1 text-right font-bold text-slate-800">{formatRp(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// --- MonthStatusGrid ---------------------------------------------------------

const MonthStatusGrid = ({ uploadedMonths, onSelectMonth, selectedMonth }) => {
  const months = generateMonthList();
  const now = new Date();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-500" />
          Status Upload per Bulan
        </CardTitle>
        <p className="text-xs text-slate-500">Klik bulan untuk melihat transaksi yang sudah tersimpan</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {months.map(({ year, month }) => {
            const key = `${year}-${String(month).padStart(2, '0')}`;
            const info = uploadedMonths[key];
            const isFuture = new Date(year, month - 1, 1) > now;
            const isSelected = selectedMonth === key;

            let statusIcon, statusClass, label;
            if (isFuture) {
              statusIcon = null;
              statusClass = 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed';
              label = null;
            } else if (!info) {
              statusIcon = <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
              statusClass = 'border-red-200 bg-red-50 text-slate-700 cursor-pointer hover:border-red-400';
              label = <span className="text-xs text-red-500 font-medium">Belum ada</span>;
            } else if (info.isComplete) {
              statusIcon = <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
              statusClass = 'border-green-200 bg-green-50 text-slate-700 cursor-pointer hover:border-green-400';
              label = <span className="text-xs text-green-600 font-medium">{info.count} transaksi</span>;
            } else {
              statusIcon = <Clock className="w-3.5 h-3.5 text-amber-500" />;
              statusClass = 'border-amber-200 bg-amber-50 text-slate-700 cursor-pointer hover:border-amber-400';
              label = <span className="text-xs text-amber-600 font-medium">Sebagian</span>;
            }

            return (
              <div
                key={key}
                onClick={() => !isFuture && info && onSelectMonth(isSelected ? null : key)}
                className={cn(
                  'rounded-xl border-2 p-2.5 transition-all',
                  statusClass,
                  isSelected && 'ring-2 ring-blue-400 ring-offset-1'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold">{MONTH_NAMES[month - 1].slice(0, 3)}</span>
                  {statusIcon}
                </div>
                <div className="text-xs text-slate-500">{year}</div>
                {label}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-4 text-xs text-slate-500 flex-wrap">
          <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-green-500" /> Lengkap</span>
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-500" /> Sebagian</span>
          <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Belum ada</span>
        </div>
      </CardContent>
    </Card>
  );
};

// --- Main Component ----------------------------------------------------------

const BSIMutasiReconciliation = ({ readOnly = false }) => {
  const { toast } = useToast();
  const { user } = useAuth();

  // Upload states
  const [csvRows, setCsvRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [saving, setSaving] = useState(false);

  // Saved data states
  const [uploadedMonths, setUploadedMonths] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [savedTransactions, setSavedTransactions] = useState([]);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [uploads, setUploads] = useState([]);

  // Reconcile states
  const [reconciled, setReconciled] = useState([]);
  const [reconciling, setReconciling] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedIdx, setExpandedIdx] = useState(null);

  // Check transaksi manual states
  const [allRecapsForPeriod, setAllRecapsForPeriod] = useState([]);
  const [showAllRecaps, setShowAllRecaps] = useState(false);
  const [loadingAllRecaps, setLoadingAllRecaps] = useState(false);
  const [mutasiChecks, setMutasiChecks] = useState({});
  const [globalMatchedRecapIds, setGlobalMatchedRecapIds] = useState(new Set());

 const loadAllRecapsForPeriod = useCallback(async () => {
    if (!savedTransactions.length && !csvRows.length) return;
    setLoadingAllRecaps(true);
    try {
      const txList = savedTransactions.length > 0 ? savedTransactions : csvRows.map(r => ({
        tgl_masuk: r.masukDateStr,
        tgl_transaksi: r.qrisTrxDateStr || r.masukDateStr,
      }));
      const allDates = [
        ...txList.map(r => r.tgl_masuk),
        ...txList.map(r => r.tgl_transaksi),
      ].filter(Boolean).sort();
      const minDate = allDates[0];
      const maxDate = allDates[allDates.length - 1];

      const [{ data: recaps }, { data: adminIncomes }] = await Promise.all([
        supabase
          .from('daily_recaps')
          .select('id, recap_date, amount, payment_method, patient_id, actual_patient_id, full_name, guest_name')
          .gte('recap_date', minDate)
          .lte('recap_date', maxDate)
          .not('amount', 'is', null)
          .gt('amount', 0)
          .order('recap_date'),
        supabase
          .from('admin_income')
          .select('id, date, amount, category, sub_category, description')
          .gte('date', minDate)
          .lte('date', maxDate)
          .gt('amount', 0)
          .order('date'),
      ]);

      const allIds = (recaps || []).flatMap(r => [r.patient_id, r.actual_patient_id]).filter(Boolean);
      let patientMap = {};
      if (allIds.length > 0) {
        const { data: patients } = await supabase.from('patients').select('id, full_name').in('id', [...new Set(allIds)]);
        (patients || []).forEach(p => { patientMap[p.id] = p.full_name; });
      }

      const { data: paymentMethodOpts } = await supabase
        .from('operational_options')
        .select('id, label')
        .eq('category', 'payment_method');
      const pmMap = {};
      (paymentMethodOpts || []).forEach(pm => { pmMap[pm.id] = pm.label; });
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      const enrichedRecaps = (recaps || []).map(r => ({
        ...r,
        kind: 'recap',
        patient_name: patientMap[r.actual_patient_id] || patientMap[r.patient_id] || r.full_name || r.guest_name || '-',
        payment_method: uuidRe.test(r.payment_method || '') ? (pmMap[r.payment_method] || r.payment_method) : r.payment_method,
      }));

      const enrichedAdminIncome = (adminIncomes || []).map(r => ({
        id: r.id,
        recap_date: r.date,
        amount: r.amount,
        kind: 'admin_income',
        patient_name: (r.sub_category || r.category || 'Pemasukan Lainnya') + (r.description ? ` - ${r.description}` : ''),
        payment_method: 'Pemasukan Lainnya',
      }));

      const enriched = [...enrichedRecaps, ...enrichedAdminIncome];
      setAllRecapsForPeriod(enriched);

      // Hitung auto-match SECARA GLOBAL (lintas file bulan mutasi), bukan cuma dari
      // reconciled bulan yang sedang dibuka. Perlu karena QRIS bisa tgl_transaksi di
      // akhir bulan tapi tgl_masuk (jadi masuk file bulan) di awal bulan berikutnya.
      const { data: allQrisTx } = await supabase
        .from('bsi_mutasi_transactions')
        .select('id, tgl_transaksi, nominal, tipe')
        .eq('tipe', 'qris')
        .gte('tgl_transaksi', minDate)
        .lte('tgl_transaksi', maxDate);

      const qrisRecapsForGlobal = enrichedRecaps.filter(r => (r.payment_method || '').toLowerCase().includes('qris'));
      const globalUsedIds = new Set();
      (allQrisTx || [])
        .slice()
        .sort((a, b) => (a.tgl_transaksi > b.tgl_transaksi ? 1 : -1))
        .forEach(tx => {
          const mutasiAmt = Math.round(Number(tx.nominal));
          const match = qrisRecapsForGlobal.find(r =>
            !globalUsedIds.has(r.id) &&
            r.recap_date === tx.tgl_transaksi &&
            Math.round(Number(r.amount)) >= mutasiAmt &&
            Math.round(Number(r.amount)) <= mutasiAmt + 15000
          );
          if (match) globalUsedIds.add(match.id);
        });
      setGlobalMatchedRecapIds(globalUsedIds);

      // Load existing checks untuk mutasi_csv (daily recap maupun pemasukan lainnya)
      const recapIds = enrichedRecaps.map(r => r.id);
      const adminIncomeIds = enrichedAdminIncome.map(r => r.id);
      const checkMap = {};
      if (recapIds.length > 0) {
        const { data: checks1 } = await supabase
          .from('bsi_reconciliation_checks')
          .select('*')
          .eq('source_type', 'mutasi_csv')
          .in('daily_recap_id', recapIds);
        (checks1 || []).forEach(c => { checkMap[c.daily_recap_id] = c; });
      }
      if (adminIncomeIds.length > 0) {
        const { data: checks2 } = await supabase
          .from('bsi_reconciliation_checks')
          .select('*')
          .eq('source_type', 'mutasi_csv')
          .in('admin_income_id', adminIncomeIds);
        (checks2 || []).forEach(c => { checkMap[c.admin_income_id] = c; });
      }
      setMutasiChecks(checkMap);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setLoadingAllRecaps(false);
    }
  }, [savedTransactions, csvRows, toast]);

  const handleMutasiCheck = useCallback(async (recap, isChecked, targetMutasiRow) => {
    // targetMutasiRow = baris mutasi CSV yang sedang dibuka picker-nya
    const existing = mutasiChecks[recap.id];
    const mutasiTxId = targetMutasiRow?.id || null;
    const isAdminIncome = recap.kind === 'admin_income';

    // Simpan/update record checklist di database (1 recap/pemasukan = 1 record, repoint ke mutasi baru)
    if (existing) {
      const { data } = await supabase
        .from('bsi_reconciliation_checks')
        .update({
          is_checked: isChecked,
          mutasi_transaction_id: isChecked ? mutasiTxId : null,
          checked_by: user?.id,
          checked_at: isChecked ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id).select().single();
      if (data) setMutasiChecks(prev => ({ ...prev, [recap.id]: data }));
    } else {
      const { data } = await supabase
        .from('bsi_reconciliation_checks')
        .insert({
          source_type: 'mutasi_csv',
          mutasi_transaction_id: mutasiTxId,
          daily_recap_id: isAdminIncome ? null : recap.id,
          admin_income_id: isAdminIncome ? recap.id : null,
          is_checked: isChecked,
          checked_by: user?.id,
          checked_at: isChecked ? new Date().toISOString() : null,
        }).select().single();
      if (data) setMutasiChecks(prev => ({ ...prev, [recap.id]: data }));
    }

    // Lepas recap dari baris manapun yang masih menyimpannya, lalu pasang ke baris target
    setReconciled(prev => prev.map(r => {
      const isTargetRow = targetMutasiRow?.id ? r.id === targetMutasiRow.id : r === targetMutasiRow;
      const hasThisRecap = r.matchedRecap?.id === recap.id || (r.manualRecaps || []).some(mr => mr.id === recap.id);

      if (hasThisRecap && !isTargetRow) {
        const remaining = (r.manualRecaps || []).filter(mr => mr.id !== recap.id);
        if (remaining.length === 0) {
          return { ...r, status: 'unmatched', matchedRecap: null, manualRecaps: [], isManualMatch: false };
        }
        return { ...r, status: 'matched', matchedRecap: remaining[0], manualRecaps: remaining };
      }

      if (!isTargetRow) return r;

      if (!isChecked) {
        const remaining = (r.manualRecaps || []).filter(mr => mr.id !== recap.id);
        if (remaining.length === 0) {
          return { ...r, status: 'unmatched', matchedRecap: null, manualRecaps: [], isManualMatch: false };
        }
        return { ...r, status: 'matched', matchedRecap: remaining[0], manualRecaps: remaining };
      }

      const existingManual = r.manualRecaps || [];
      const alreadyIn = existingManual.find(mr => mr.id === recap.id);
      const newManualRecaps = alreadyIn ? existingManual : [...existingManual, {
        id: recap.id,
        recap_date: recap.recap_date,
        amount: recap.amount,
        payment_method: recap.payment_method || '-',
        patient_name: recap.patient_name || '-',
        kind: recap.kind || 'recap',
      }];
      return {
        ...r,
        status: 'matched',
        matchedRecap: newManualRecaps[0],
        manualRecaps: newManualRecaps,
        isManualMatch: true,
        _editMode: false,
      };
    }));
  }, [mutasiChecks, user]);

  const [debitEntries, setDebitEntries] = useState([]);
  const [debitParsing, setDebitParsing] = useState(false);
  const [debitLoadingRecaps, setDebitLoadingRecaps] = useState(false);
  const [debitRecaps, setDebitRecaps] = useState({}); // { settlement_id: [recap, ...] }
  const [debitChecks, setDebitChecks] = useState({}); // { recap_id: check_record }
  const [debitRecapUsage, setDebitRecapUsage] = useState({}); // { recap_id: { settlementId, reportDate } } — dipakai settlement LAIN
  const [debitFilterMonth, setDebitFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [autoMatchingId, setAutoMatchingId] = useState(null);

  // Audit: recap mana yang belum match ke mutasi BSI / settlement EDC
  const [recapAuditRange, setRecapAuditRange] = useState(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: toDateStr(startOfMonth), end: toDateStr(now) };
  });
  const [recapAuditResult, setRecapAuditResult] = useState(null);
  const [recapAuditLoading, setRecapAuditLoading] = useState(false);
  const [recapAuditFilter, setRecapAuditFilter] = useState('unmatched'); // 'unmatched' | 'all'

  // Tab: 'upload' | 'check' | 'debit'
  const [activeTab, setActiveTab] = useState(readOnly ? 'check' : 'upload');

  const loadMonthStatus = useCallback(async () => {
    // Get all transactions grouped by tahun-bulan
    const { data, error } = await supabase
      .from('bsi_mutasi_transactions')
      .select('tgl_masuk, bulan, tahun');

    if (error) return;

    const months = generateMonthList();
    const result = {};

    months.forEach(({ year, month }) => {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      const txInMonth = (data || []).filter(t => t.tahun === year && t.bulan === month);

      if (txInMonth.length === 0) {
        result[key] = null;
        return;
      }

      // Cek apakah semua tanggal dalam bulan sudah ada
      const daysInMonth = getDaysInMonth(new Date(year, month - 1));
      const datesUploaded = new Set(txInMonth.map(t => t.tgl_masuk));

      // Cek hari kerja (senin-sabtu), atau cek semua hari dalam bulan
      // Kita cek berdasarkan tanggal yang ada di transactions saja
      // Bulan dianggap lengkap kalau ada data dari tgl 1 s/d akhir bulan
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      const hasFirst = datesUploaded.has(firstDay);
      const hasLast = datesUploaded.has(lastDay);

      // Lengkap = ada data dari awal dan akhir bulan
      // (tidak semua hari harus ada karena mungkin tidak ada transaksi di hari tertentu)
      const allDates = Array.from(datesUploaded).sort();
      const minDate = allDates[0];
      const maxDate = allDates[allDates.length - 1];
      const isComplete = minDate <= firstDay && maxDate >= lastDay;

      result[key] = {
        count: txInMonth.length,
        isComplete,
        minDate,
        maxDate,
      };
    });

    setUploadedMonths(result);
  }, []);

  // Load month status on mount
  useEffect(() => {
    loadMonthStatus();
  }, [loadMonthStatus]);

  // Load transactions for selected month
  useEffect(() => {
    if (!selectedMonth) {
      setSavedTransactions([]);
      setUploads([]);
      return;
    }
    loadMonthTransactions(selectedMonth);
  }, [selectedMonth]);

  const loadMonthTransactions = async (monthKey) => {
    setLoadingMonth(true);
    const [year, month] = monthKey.split('-').map(Number);

    const [txRes, upRes] = await Promise.all([
      supabase
        .from('bsi_mutasi_transactions')
        .select('*')
        .eq('tahun', year)
        .eq('bulan', month)
        .order('tgl_masuk')
        .order('id'),
      supabase
        .from('bsi_mutasi_uploads')
        .select('*')
        .gte('periode_start', `${year}-${String(month).padStart(2, '0')}-01`)
        .lte('periode_end', `${year}-${String(month).padStart(2, '0')}-31`)
        .order('uploaded_at', { ascending: false }),
    ]);

    setSavedTransactions(txRes.data || []);
    setUploads(upRes.data || []);
    setLoadingMonth(false);
  };

  // Handle file upload
  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setFileName(file.name);
    try {
      const text = await file.text();
      const rows = parseBSICSV(text);
      if (rows.length === 0) {
        toast({ variant: 'destructive', title: 'Tidak ada data', description: 'Tidak ditemukan transaksi QRIS/Debit/Transfer di file ini.' });
        return;
      }
      setCsvRows(rows);
      setReconciled([]);
      toast({ title: `${rows.length} transaksi ditemukan`, description: 'Review data lalu klik "Simpan ke Database".' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal membaca file', description: err.message });
    }
  }, [toast]);

  // Save CSV to database
  const handleSave = useCallback(async () => {
    if (!csvRows.length) return;
    setSaving(true);
    try {
      const dates = csvRows.map(r => r.masukDateStr).filter(Boolean).sort();
      const periodeStart = dates[0];
      const periodeEnd = dates[dates.length - 1];

      // Cek transaksi yang sudah ada di rentang tanggal file ini, supaya tanggal
      // yang overlap antar upload (mis. upload 1 s/d 10, lalu upload 10 s/d 30)
      // tidak tersimpan dobel di tgl 10.
      const { data: existingTx, error: existErr } = await supabase
        .from('bsi_mutasi_transactions')
        .select('tgl_masuk, waktu_transaksi, deskripsi, nominal')
        .gte('tgl_masuk', periodeStart)
        .lte('tgl_masuk', periodeEnd);

      if (existErr) throw existErr;

      const existingKeys = new Set(
        (existingTx || []).map(t => `${t.tgl_masuk}|${t.waktu_transaksi}|${t.deskripsi}|${Math.round(Number(t.nominal))}`)
      );

      const newRows = csvRows.filter(r => {
        const key = `${r.masukDateStr}|${r.waktuTransaksi}|${r.deskripsi}|${Math.round(Number(r.amount))}`;
        return !existingKeys.has(key);
      });
      const skippedCount = csvRows.length - newRows.length;

      if (newRows.length === 0) {
        toast({ title: 'Tidak ada transaksi baru', description: `Semua ${csvRows.length} transaksi di file ini sudah ada di database (duplikat dilewati).` });
        setCsvRows([]);
        setFileName('');
        return;
      }

      // Insert upload record
      const { data: uploadRecord, error: upErr } = await supabase
        .from('bsi_mutasi_uploads')
        .insert({
          periode_start: periodeStart,
          periode_end: periodeEnd,
          jumlah_transaksi: newRows.length,
          uploaded_by: user?.id || null,
          notes: fileName,
        })
        .select()
        .single();

      if (upErr) throw upErr;

      // Insert transactions in batches of 100
      const txRows = newRows.map(r => ({
        upload_id: uploadRecord.id,
        waktu_transaksi: r.waktuTransaksi,
        tgl_masuk: r.masukDateStr,
        tgl_transaksi: r.qrisTrxDateStr || r.masukDateStr,
        deskripsi: r.deskripsi,
        nama_pengirim: r.namaPengirim || null,
        nominal: r.amount,
        tipe: r.tipe,
        bulan: r.bulan,
        tahun: r.tahun,
      }));

      const batchSize = 100;
      let insertedCount = 0;
      for (let i = 0; i < txRows.length; i += batchSize) {
        const { data: insertedBatch, error } = await supabase
          .from('bsi_mutasi_transactions')
          .upsert(txRows.slice(i, i + batchSize), {
            onConflict: 'tgl_masuk,waktu_transaksi,deskripsi,nominal',
            ignoreDuplicates: true,
          })
          .select('id');
        if (error) throw error;
        insertedCount += (insertedBatch || []).length;
      }

      toast({
        title: 'Berhasil disimpan',
        description: skippedCount > 0
          ? `${insertedCount} transaksi baru tersimpan, ${csvRows.length - insertedCount} transaksi duplikat dilewati.`
          : `${insertedCount} transaksi tersimpan ke database.`,
      });
      setCsvRows([]);
      setFileName('');
      await loadMonthStatus();

      // Auto-select month dari data yang baru disimpan
      const firstRow = newRows[0];
      if (firstRow?.tahun && firstRow?.bulan) {
        const key = `${firstRow.tahun}-${String(firstRow.bulan).padStart(2, '0')}`;
        setSelectedMonth(key);
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: err.message });
    } finally {
      setSaving(false);
    }
  }, [csvRows, fileName, user, toast]);

  // Delete upload
  const handleDeleteUpload = async (uploadId) => {
    if (!confirm('Hapus data upload ini beserta semua transaksinya?')) return;
    const { error } = await supabase.from('bsi_mutasi_uploads').delete().eq('id', uploadId);
    if (error) { toast({ variant: 'destructive', title: 'Gagal hapus', description: error.message }); return; }
    toast({ title: 'Berhasil dihapus' });
    await loadMonthStatus();
    if (selectedMonth) loadMonthTransactions(selectedMonth);
  };

  // Reconcile saved transactions with daily recaps
  const handleReconcile = useCallback(async () => {
    const txList = savedTransactions.length > 0 ? savedTransactions : csvRows.map(r => ({
      tgl_masuk: r.masukDateStr,
      tgl_transaksi: r.qrisTrxDateStr || r.masukDateStr,
      deskripsi: r.deskripsi,
      nama_pengirim: r.namaPengirim,
      nominal: r.amount,
      tipe: r.tipe,
    }));

    if (!txList.length) return;
    setReconciling(true);

    try {
      const dates = txList.map(r => r.tgl_masuk).filter(Boolean).sort();
      const qrisDates = txList.map(r => r.tgl_transaksi).filter(Boolean).sort();
      const allDates = [...dates, ...qrisDates].sort();
      const minDate = allDates[0];
      const maxDate = allDates[allDates.length - 1];

      const { data: recaps, error } = await supabase
        .from('daily_recaps')
        .select('id, recap_date, amount, payment_method, patient_id, actual_patient_id, full_name, guest_name')
        .gte('recap_date', minDate)
        .lte('recap_date', maxDate)
        .not('amount', 'is', null)
        .gt('amount', 0)
        .order('id');

      if (error) throw error;

      // Ambil settlement Debit EDC (Yokke) di rentang tanggal yang sama, untuk dicocokkan
      // langsung ke mutasi tipe 'debit' berdasarkan tanggal + net amount (1:1 per hari).
      const { data: debitSettlements } = await supabase
        .from('bsi_debit_settlements')
        .select('id, report_date, sales_volume, net_amount, mdr_amount, account_name, file_name')
        .gte('report_date', minDate)
        .lte('report_date', maxDate);
      const settlementsByDate = {};
      (debitSettlements || []).forEach(s => { settlementsByDate[s.report_date] = s; });

      const allPatientIds = [...new Set([
        ...(recaps || []).map(r => r.patient_id),
        ...(recaps || []).map(r => r.actual_patient_id),
      ].filter(Boolean))];

      let patientMap = {};
      if (allPatientIds.length > 0) {
        const { data: patients } = await supabase
          .from('patients').select('id, full_name').in('id', allPatientIds);
        (patients || []).forEach(p => { patientMap[p.id] = p.full_name; });
      }

      const getPatientName = (r) => patientMap[r.actual_patient_id] || patientMap[r.patient_id] || r.full_name || r.guest_name || '-';

      const txIds = txList.map(r => r.id).filter(Boolean);
      let manualMatchesByTxId = {};
      if (txIds.length > 0) {
        const { data: checks } = await supabase
          .from('bsi_reconciliation_checks')
          .select('mutasi_transaction_id, daily_recap_id, admin_income_id')
          .eq('source_type', 'mutasi_csv')
          .eq('is_checked', true)
          .in('mutasi_transaction_id', txIds);

        const recapById = {};
        (recaps || []).forEach(r => { recapById[r.id] = r; });

        const adminIncomeCheckIds = (checks || []).map(c => c.admin_income_id).filter(Boolean);
        let adminIncomeById = {};
        if (adminIncomeCheckIds.length > 0) {
          const { data: adminIncomes } = await supabase
            .from('admin_income')
            .select('id, date, amount, category, sub_category, description')
            .in('id', [...new Set(adminIncomeCheckIds)]);
          (adminIncomes || []).forEach(a => { adminIncomeById[a.id] = a; });
        }

        (checks || []).forEach(c => {
          let entry = null;
          if (c.daily_recap_id) {
            const dr = recapById[c.daily_recap_id];
            if (!dr) return;
            entry = {
              id: dr.id,
              recap_date: dr.recap_date,
              amount: dr.amount,
              payment_method: dr.payment_method,
              patient_name: getPatientName(dr),
              kind: 'recap',
            };
          } else if (c.admin_income_id) {
            const ai = adminIncomeById[c.admin_income_id];
            if (!ai) return;
            entry = {
              id: ai.id,
              recap_date: ai.date,
              amount: ai.amount,
              payment_method: 'Pemasukan Lainnya',
              patient_name: (ai.sub_category || ai.category || 'Pemasukan Lainnya') + (ai.description ? ` - ${ai.description}` : ''),
              kind: 'admin_income',
            };
          }
          if (!entry) return;
          if (!manualMatchesByTxId[c.mutasi_transaction_id]) manualMatchesByTxId[c.mutasi_transaction_id] = [];
          manualMatchesByTxId[c.mutasi_transaction_id].push(entry);
        });
      }

      const QRIS_UUID = '09768d17-6bfa-4d0e-bee2-81d9cb156838';
      const DEBIT_UUID = '879709f1-9be0-4d2e-8006-a927ea96ff22';
      const TRANSFER_UUID = 'da9ccafc-d10c-41f3-8baf-17b84cddc77e';
      const isQris = (pm) => pm === QRIS_UUID || (pm || '').toLowerCase().includes('qris');
      const isDebit = (pm) => pm === DEBIT_UUID || (pm || '').toLowerCase().includes('debit');
      const isTransfer = (pm) => pm === TRANSFER_UUID || (pm || '').toLowerCase().includes('transfer');

      const qrisRecaps = (recaps || []).filter(r => isQris(r.payment_method));
      const debitRecaps = (recaps || []).filter(r => isDebit(r.payment_method));
      const transferRecaps = (recaps || []).filter(r => isTransfer(r.payment_method));

      const usedIds = new Set();
      // Recap/pemasukan lain yang sudah dipesan untuk match manual di baris manapun tidak boleh diambil auto-match baris lain
      Object.values(manualMatchesByTxId).forEach(list => {
        (list || []).forEach(mr => usedIds.add(mr.id));
      });

      const result = txList.map(row => {
        const tglMasuk = row.tgl_masuk;
        const mutasiAmt = Math.round(Number(row.nominal || row.amount));

        // Debit dicocokkan LANGSUNG ke settlement EDC (Yokke) berdasarkan tanggal —
        // bukan ke daily recap — karena 1 report_date cuma boleh py 1 settlement
        // (constraint DB). Detail pasien per settlement dilihat lewat tab Debit EDC.
        if (row.tipe === 'debit') {
          const settlement = settlementsByDate[tglMasuk];
          if (!settlement) {
            return { ...row, status: 'unmatched', matchedSettlement: null };
          }
          const net = settlement.net_amount != null ? Math.round(Number(settlement.net_amount)) : null;
          return {
            ...row,
            status: 'matched',
            matchedSettlement: settlement,
            debitSelisih: net != null ? mutasiAmt - net : null,
          };
        }

        let matched = null;
        let candidates = [];
        const tglTransaksi = row.tgl_transaksi;

        if (row.tipe === 'qris') {
          candidates = qrisRecaps
            .filter(r => {
              const recapAmt = Math.round(Number(r.amount));
              return !usedIds.has(r.id) && r.recap_date === tglTransaksi &&
                recapAmt >= mutasiAmt && recapAmt <= mutasiAmt + 15000;
            })
            .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        } else if (row.tipe === 'transfer') {
          // Transfer: cocokkan di tgl_masuk rekening sampai 3 hari setelahnya
          const baseDate = new Date(tglMasuk + 'T12:00:00');
          const transferDates = new Set();
          for (let d = 0; d <= 3; d++) {
            const dt = new Date(baseDate);
            dt.setDate(dt.getDate() + d);
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            const day = String(dt.getDate()).padStart(2, '0');
            transferDates.add(`${y}-${m}-${day}`);
          }
          candidates = transferRecaps.filter(r => {
            const recapAmt = Math.round(Number(r.amount));
            return !usedIds.has(r.id) && recapAmt === mutasiAmt && transferDates.has(r.recap_date);
          });
        }

        if (candidates.length > 0) {
          matched = candidates[0];
          usedIds.add(matched.id);
        }

        const manualRecaps = row.id ? manualMatchesByTxId[row.id] : null;
        if (manualRecaps && manualRecaps.length > 0) {
          return {
            ...row,
            status: 'matched',
            matchedRecap: manualRecaps[0],
            manualRecaps,
            isManualMatch: true,
          };
        }

        return {
          ...row,
          status: matched ? 'matched' : 'unmatched',
          matchedRecap: matched ? {
            id: matched.id,
            recap_date: matched.recap_date,
            amount: matched.amount,
            payment_method: matched.payment_method,
            patient_name: getPatientName(matched),
          } : null,
        };
      });

      setReconciled(result);
      const matchedCount = result.filter(r => r.status === 'matched').length;
      toast({ title: 'Rekonsiliasi selesai', description: `${matchedCount} dari ${result.length} transaksi cocok.` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setReconciling(false);
    }
  }, [savedTransactions, csvRows, toast]);

  const handleReset = () => {
    setCsvRows([]);
    setFileName('');
    setReconciled([]);
    setSearch('');
    setFilterType('all');
    setFilterStatus('all');
    setExpandedIdx(null);
  };

  // Handle Debit EDC PDF upload
  const loadDebitSettlements = useCallback(async () => {
    const [year, month] = debitFilterMonth.split('-').map(Number);
    const { data } = await supabase
      .from('bsi_debit_settlements')
      .select('*')
      .eq('tahun', year)
      .eq('bulan', month)
      .order('report_date');
    setDebitEntries(data || []);
  }, [debitFilterMonth]);

  // Load debit settlements saat bulan berubah
  useEffect(() => {
    loadDebitSettlements();
  }, [loadDebitSettlements]);

  // Auto-match otomatis untuk semua settlement yang selisihnya belum 0, tiap kali
  // daftar settlement bulan ini selesai dimuat — supaya sama seperti QRIS (langsung
  // jalan sendiri tanpa perlu klik manual).
  useEffect(() => {
    if (!debitEntries.length) return;
    let cancelled = false;
    (async () => {
      for (const entry of debitEntries) {
        if (cancelled) return;
        await handleAutoMatchDebit(entry, { silent: true });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debitEntries.map(e => e.id).join(',')]);

  // Auto-match SEMUA settlement dari SEMUA bulan (bukan cuma bulan yang lagi difilter),
  // sekali saja saat tab Debit EDC pertama kali dipakai. Ini penting karena kombinasi
  // pasangan recap bisa menyeberang bulan (mis. settlement akhir Mei butuh recap dari
  // akhir Mei juga, tapi kalau kamu cuma buka tab Juni, settlement itu nggak pernah
  // ke-auto-match dan recap-nya keliatan "Belum dipakai" terus di tab lain).
  const [globalDebitAutoMatchDone, setGlobalDebitAutoMatchDone] = useState(false);
  useEffect(() => {
    if (globalDebitAutoMatchDone) return;
    let cancelled = false;
    (async () => {
      const { data: allEntries } = await supabase
        .from('bsi_debit_settlements')
        .select('*')
        .order('report_date');
      for (const entry of allEntries || []) {
        if (cancelled) return;
        await handleAutoMatchDebit(entry, { silent: true });
      }
      if (!cancelled) {
        setGlobalDebitAutoMatchDone(true);
        // Refresh tampilan bulan yang lagi dibuka, siapa tahu ikut kena update dari proses ini
        await loadDebitSettlements();
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDebitPdfUpload = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';
    setDebitParsing(true);
    for (const file of files) {
      try {
        const ext = file.name.split('.').pop().toLowerCase();
        const result = ext === 'csv'
          ? parseDebitEDCCsv(await file.text())
          : await parseDebitEDCPdf(file);
        if (!result.reportDate || !result.salesVolume) {
          toast({ variant: 'destructive', title: `Gagal parse: ${file.name}`, description: 'Tidak ditemukan Report Date atau Sales Volume.' });
          continue;
        }
        const reportDateObj = new Date(result.reportDate + 'T12:00:00');
        const bulan = reportDateObj.getMonth() + 1;
        const tahun = reportDateObj.getFullYear();

        // Simpan ke DB
        const { data: saved, error } = await supabase
          .from('bsi_debit_settlements')
          .insert({
            report_date: result.reportDate,
            sales_volume: result.salesVolume,
            mdr_amount: result.mdrAmount ?? null,
            net_amount: result.netAmount ?? null,
            account_name: result.accountName,
            file_name: file.name,
            bulan,
            tahun,
            uploaded_by: user?.id || null,
          })
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            toast({ variant: 'destructive', title: `Duplikat: ${file.name}`, description: `Settlement tanggal ${result.reportDate} sudah ada di database, dilewati.` });
            continue;
          }
          throw error;
        }
        toast({ title: `✅ ${file.name}`, description: `Tgl: ${result.reportDate} | Rp ${result.salesVolume.toLocaleString('id-ID')} — tersimpan` });
        await loadDebitSettlements();
      } catch (err) {
        toast({ variant: 'destructive', title: `Error: ${file.name}`, description: err.message });
      }
    }
    setDebitParsing(false);
  }, [toast, user]);

  const handleRemoveDebitEntry = async (id) => {
    if (!confirm('Hapus data settlement ini?')) return;
    await supabase.from('bsi_debit_settlements').delete().eq('id', id);
    await loadDebitSettlements();
  };

  const loadDebitRecapsForSettlement = useCallback(async (settlement) => {
    setDebitLoadingRecaps(true);
    const validDates = [];
    for (let d = 0; d <= 10; d++) {
      const dt = new Date(settlement.report_date + 'T12:00:00');
      dt.setDate(dt.getDate() - d);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      validDates.push(`${y}-${m}-${day}`);
    }

    const DEBIT_UUID = '879709f1-9be0-4d2e-8006-a927ea96ff22';
    const { data: recaps } = await supabase
      .from('daily_recaps')
      .select('id, recap_date, amount, payment_method, patient_id, actual_patient_id, full_name, guest_name')
      .in('recap_date', validDates)
      .not('amount', 'is', null)
      .gt('amount', 0);

    const debitRecapsOnly = (recaps || []).filter(r => {
      const pm = (r.payment_method || '').toLowerCase();
      return pm.includes('debit') || r.payment_method === DEBIT_UUID;
    });

    const allIds = debitRecapsOnly.map(r => r.patient_id).concat(debitRecapsOnly.map(r => r.actual_patient_id)).filter(Boolean);
    let patientMap = {};
    if (allIds.length > 0) {
      const { data: patients } = await supabase.from('patients').select('id, full_name').in('id', [...new Set(allIds)]);
      (patients || []).forEach(p => { patientMap[p.id] = p.full_name; });
    }

    const enriched = debitRecapsOnly.map(r => ({
      ...r,
      patient_name: patientMap[r.actual_patient_id] || patientMap[r.patient_id] || r.full_name || r.guest_name || '-',
    }));

    setDebitRecaps(prev => ({ ...prev, [settlement.id]: enriched }));

    // Load existing checks untuk settlement ini — key digabung settlement+recap supaya
    // tidak nyampur status "sudah dicentang" antar settlement yang beda.
    const { data: checks } = await supabase
      .from('bsi_reconciliation_checks')
      .select('*')
      .eq('source_type', 'debit_settlement')
      .eq('debit_settlement_id', settlement.id);
    const checkMap = {};
    (checks || []).forEach(c => { checkMap[`${settlement.id}::${c.daily_recap_id}`] = c; });
    setDebitChecks(prev => ({ ...prev, ...checkMap }));

    setDebitLoadingRecaps(false);
    return enriched;
  }, []);

  // Status "recap ini sudah dipakai di settlement mana" diambil GLOBAL (semua settlement
  // sekaligus), bukan snapshot per-kartu — supaya kartu yang dibuka duluan tetap otomatis
  // ter-update begitu kartu lain belakangan mencentang recap yang sama.
  const refreshDebitRecapUsage = useCallback(async () => {
    const { data } = await supabase
      .from('bsi_reconciliation_checks')
      .select('daily_recap_id, debit_settlement_id, bsi_debit_settlements(report_date)')
      .eq('source_type', 'debit_settlement')
      .eq('is_checked', true);
    const usageMap = {};
    (data || []).forEach(c => {
      usageMap[c.daily_recap_id] = {
        settlementId: c.debit_settlement_id,
        reportDate: c.bsi_debit_settlements?.report_date || null,
      };
    });
    setDebitRecapUsage(usageMap);
  }, []);

  const handleDebitCheck = useCallback(async (settlement, recap, isChecked) => {
    const key = `${settlement.id}::${recap.id}`;

    // Selalu cek langsung ke database (bukan cuma state lokal) supaya tidak pernah
    // insert baris dobel walau state React belum sempat sinkron — ini yang bikin
    // dulu satu pasien bisa ke-insert 2-3x untuk settlement yang sama.
    const { data: existingRows } = await supabase
      .from('bsi_reconciliation_checks')
      .select('*')
      .eq('source_type', 'debit_settlement')
      .eq('debit_settlement_id', settlement.id)
      .eq('daily_recap_id', recap.id)
      .limit(1);
    const existingCheck = existingRows?.[0] || null;

    if (existingCheck) {
      const { data } = await supabase
        .from('bsi_reconciliation_checks')
        .update({ is_checked: isChecked, checked_by: user?.id, checked_at: isChecked ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
        .eq('id', existingCheck.id)
        .select().single();
      if (data) setDebitChecks(prev => ({ ...prev, [key]: data }));
      await refreshDebitRecapUsage();
      return;
    }

    const { data, error } = await supabase
      .from('bsi_reconciliation_checks')
      .insert({
        source_type: 'debit_settlement',
        debit_settlement_id: settlement.id,
        daily_recap_id: recap.id,
        is_checked: isChecked,
        checked_by: user?.id,
        checked_at: isChecked ? new Date().toISOString() : null,
      })
      .select().single();

    // Kalau ternyata sudah ada duluan (race condition), constraint DB akan menolak —
    // ambil ulang baris yang sudah ada lalu update, bukan gagal total.
    if (error?.code === '23505') {
      const { data: existing2 } = await supabase
        .from('bsi_reconciliation_checks')
        .select('*')
        .eq('source_type', 'debit_settlement')
        .eq('debit_settlement_id', settlement.id)
        .eq('daily_recap_id', recap.id)
        .single();
      if (existing2) {
        const { data: updated } = await supabase
          .from('bsi_reconciliation_checks')
          .update({ is_checked: isChecked, checked_by: user?.id, checked_at: isChecked ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
          .eq('id', existing2.id)
          .select().single();
        if (updated) setDebitChecks(prev => ({ ...prev, [key]: updated }));
      }
      await refreshDebitRecapUsage();
      return;
    }

    if (data) setDebitChecks(prev => ({ ...prev, [key]: data }));
    await refreshDebitRecapUsage();
  }, [user, refreshDebitRecapUsage]);

  const runRecapAudit = useCallback(async () => {
    const { start, end } = recapAuditRange;
    if (!start || !end) return;
    setRecapAuditLoading(true);
    try {
      const QRIS_UUID = '09768d17-6bfa-4d0e-bee2-81d9cb156838';
      const DEBIT_UUID = '879709f1-9be0-4d2e-8006-a927ea96ff22';
      const TRANSFER_UUID = 'da9ccafc-d10c-41f3-8baf-17b84cddc77e';
      const isQris = (pm) => pm === QRIS_UUID || (pm || '').toLowerCase().includes('qris');
      const isDebit = (pm) => pm === DEBIT_UUID || (pm || '').toLowerCase().includes('debit');
      const isTransfer = (pm) => pm === TRANSFER_UUID || (pm || '').toLowerCase().includes('transfer');

      // 1) Semua daily recap non-tunai di rentang tanggal ini
      const { data: recaps, error } = await supabase
        .from('daily_recaps')
        .select('id, recap_date, amount, payment_method, patient_id, actual_patient_id, full_name, guest_name')
        .gte('recap_date', start)
        .lte('recap_date', end)
        .not('amount', 'is', null)
        .gt('amount', 0)
        .order('id');
      if (error) throw error;

      const allPatientIds = [...new Set([
        ...(recaps || []).map(r => r.patient_id),
        ...(recaps || []).map(r => r.actual_patient_id),
      ].filter(Boolean))];
      let patientMap = {};
      if (allPatientIds.length) {
        const { data: patients } = await supabase.from('patients').select('id, full_name').in('id', allPatientIds);
        (patients || []).forEach(p => { patientMap[p.id] = p.full_name; });
      }
      const getPatientName = (r) => patientMap[r.actual_patient_id] || patientMap[r.patient_id] || r.full_name || r.guest_name || '-';

      const qrisRecapsAll = (recaps || []).filter(r => isQris(r.payment_method));
      const debitRecapsList = (recaps || []).filter(r => isDebit(r.payment_method));
      const transferRecapsAll = (recaps || []).filter(r => isTransfer(r.payment_method));
      const relevantRecaps = [...qrisRecapsAll, ...debitRecapsList, ...transferRecapsAll];
      if (!relevantRecaps.length) {
        setRecapAuditResult([]);
        toast({ title: 'Tidak ada data', description: 'Tidak ada recap QRIS/Debit/Transfer di rentang tanggal ini.' });
        return;
      }
      const recapIds = relevantRecaps.map(r => r.id);

      // 2) Manual match yang sudah dikonfirmasi (source_type mutasi_csv) — dianggap SELESAI.
      // Diambil di awal, sebelum recap/mutasi dipakai untuk auto-match, supaya recap dan
      // mutasi yang sudah "habis dipakai" manual tidak ikut rebutan slot lagi.
      const { data: manualChecks } = await supabase
        .from('bsi_reconciliation_checks')
        .select('daily_recap_id, mutasi_transaction_id')
        .eq('source_type', 'mutasi_csv')
        .eq('is_checked', true)
        .in('daily_recap_id', recapIds);
      const manualMatchedIds = new Set((manualChecks || []).map(c => c.daily_recap_id));
      const manuallyClaimedMutasiIds = new Set((manualChecks || []).map(c => c.mutasi_transaction_id).filter(Boolean));

      // Recap yang masih perlu dicariin pasangan otomatis = yang BELUM manual-matched
      const qrisRecaps = qrisRecapsAll.filter(r => !manualMatchedIds.has(r.id));
      const transferRecapsList = transferRecapsAll.filter(r => !manualMatchedIds.has(r.id));

      // 3) Mutasi QRIS & Transfer yang relevan (window dilebarkan +5 hari biar QRIS yang
      // baru masuk rekening beberapa hari setelah tgl transaksi tetap kebaca), dikurangi
      // yang sudah "habis dipakai" manual match.
      const widenedEnd = new Date(new Date(end + 'T12:00:00').getTime() + 5 * 86400000);
      const { data: mutasiRows } = await supabase
        .from('bsi_mutasi_transactions')
        .select('id, tgl_masuk, tgl_transaksi, nominal, tipe')
        .in('tipe', ['qris', 'transfer'])
        .gte('tgl_masuk', start)
        .lte('tgl_masuk', toDateStr(widenedEnd))
        .order('id');

      const qrisMutasi = (mutasiRows || []).filter(m => m.tipe === 'qris' && !manuallyClaimedMutasiIds.has(m.id));
      const transferMutasi = (mutasiRows || []).filter(m => m.tipe === 'transfer' && !manuallyClaimedMutasiIds.has(m.id));

      // 4) Auto-match QRIS: tiap mutasi cari 1 recap yang cocok (tanggal scan + nominal +0..+15rb).
      // Diurutkan pakai id (deterministik) supaya hasilnya konsisten setiap kali dijalankan,
      // dan tidak beda-beda dengan hasil di tab Check Transaksi.
      const qrisRecapsSorted = qrisRecaps.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      const qrisMatchedIds = new Set();
      qrisMutasi
        .slice()
        .sort((a, b) => (a.tgl_transaksi !== b.tgl_transaksi ? (a.tgl_transaksi > b.tgl_transaksi ? 1 : -1) : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)))
        .forEach(m => {
          const mutasiAmt = Math.round(Number(m.nominal));
          const match = qrisRecapsSorted.find(r =>
            !qrisMatchedIds.has(r.id) && r.recap_date === m.tgl_transaksi &&
            Math.round(Number(r.amount)) >= mutasiAmt && Math.round(Number(r.amount)) <= mutasiAmt + 15000
          );
          if (match) qrisMatchedIds.add(match.id);
        });

      // 5) Auto-match Transfer: nominal exact, tgl_masuk s/d +3 hari
      const transferMatchedIds = new Set();
      transferMutasi.forEach(m => {
        const mutasiAmt = Math.round(Number(m.nominal));
        const baseDate = new Date(m.tgl_masuk + 'T12:00:00');
        const validDates = new Set();
        for (let d = 0; d <= 3; d++) {
          const dt = new Date(baseDate); dt.setDate(dt.getDate() + d);
          validDates.add(toDateStr(dt));
        }
        const match = transferRecapsList.find(r =>
          !transferMatchedIds.has(r.id) && Math.round(Number(r.amount)) === mutasiAmt && validDates.has(r.recap_date)
        );
        if (match) transferMatchedIds.add(match.id);
      });

      // 6) Debit: matched kalau sudah dicentang (is_checked) di settlement manapun
      const { data: debitChecksData } = await supabase
        .from('bsi_reconciliation_checks')
        .select('daily_recap_id')
        .eq('source_type', 'debit_settlement')
        .eq('is_checked', true)
        .in('daily_recap_id', recapIds);
      const debitMatchedIds = new Set((debitChecksData || []).map(c => c.daily_recap_id));

      // Untuk debit yang belum match, cek dulu apakah memang belum ada settlement EDC
      // sama sekali yang meng-cover periode itu (window 10 hari setelah tgl recap) —
      // supaya keterangannya jelas: "belum ada file di-upload" vs "settlement ada tapi
      // kombinasi nominalnya belum pas".
      const { data: allSettlementDates } = await supabase
        .from('bsi_debit_settlements')
        .select('report_date')
        .order('report_date');
      const settlementDatesSorted = (allSettlementDates || []).map(s => s.report_date);
      const hasSettlementCovering = (recapDate) => {
        const rd = new Date(recapDate + 'T12:00:00');
        const windowEnd = new Date(rd.getTime() + 10 * 86400000);
        return settlementDatesSorted.some(sd => {
          const sdt = new Date(sd + 'T12:00:00');
          return sdt >= rd && sdt <= windowEnd;
        });
      };

      // 7) Deteksi kasus "kurang mutasi": kalau jumlah recap QRIS (yang masih butuh auto-match,
      // sama tanggal + sama nominal) lebih banyak dari jumlah mutasi QRIS yang tersedia di
      // tanggal+nominal itu, salah satu recap PASTI tidak akan pernah ketemu pasangannya —
      // bukan salah algoritma, tapi memang datanya kurang di mutasi rekening.
      const bucketKey = (date, amt) => `${date}|${Math.floor(Math.round(amt) / 15000)}`; // toleransi 15rb selaras dgn matching
      const recapBucketCount = {};
      qrisRecaps.forEach(r => {
        const k = bucketKey(r.recap_date, Number(r.amount));
        recapBucketCount[k] = (recapBucketCount[k] || 0) + 1;
      });
      const mutasiBucketCount = {};
      qrisMutasi.forEach(m => {
        const k = bucketKey(m.tgl_transaksi, Number(m.nominal));
        mutasiBucketCount[k] = (mutasiBucketCount[k] || 0) + 1;
      });
      const ambiguousBucket = (date, amt) => {
        const k = bucketKey(date, amt);
        return (recapBucketCount[k] || 0) > (mutasiBucketCount[k] || 0);
      };

      // 8) Susun hasil akhir
      const result = relevantRecaps.map(r => {
        let matched = false;
        let reason = '';
        if (isQris(r.payment_method)) {
          matched = qrisMatchedIds.has(r.id) || manualMatchedIds.has(r.id);
          if (!matched) {
            reason = ambiguousBucket(r.recap_date, Number(r.amount))
              ? `⚠️ Ada beberapa recap QRIS tgl ${r.recap_date} dengan nominal sekitar Rp${Number(r.amount).toLocaleString('id-ID')}, tapi mutasi QRIS yang cocok di tanggal+nominal itu lebih sedikit. Kemungkinan mutasinya belum ke-upload atau ada recap dobel — cek manual.`
              : 'Tidak ada mutasi QRIS yang cocok (tanggal scan + nominal)';
          }
        } else if (isTransfer(r.payment_method)) {
          matched = transferMatchedIds.has(r.id) || manualMatchedIds.has(r.id);
          if (!matched) reason = 'Tidak ada mutasi Transfer yang cocok (nominal + tanggal masuk)';
        } else if (isDebit(r.payment_method)) {
          matched = debitMatchedIds.has(r.id);
          if (!matched) {
            reason = hasSettlementCovering(r.recap_date)
              ? '⚠️ Ada settlement EDC di periode ini, tapi kombinasi nominalnya belum pas — cek manual di tab Debit EDC.'
              : '❌ Belum ada settlement EDC yang di-upload untuk periode 10 hari setelah tanggal ini — upload dulu file Yokke-nya di tab Debit EDC.';
          }
        }
        return {
          id: r.id,
          recap_date: r.recap_date,
          amount: r.amount,
          tipe: isQris(r.payment_method) ? 'qris' : isDebit(r.payment_method) ? 'debit' : 'transfer',
          patient_name: getPatientName(r),
          matched,
          reason,
        };
      }).sort((a, b) => (a.recap_date < b.recap_date ? -1 : a.recap_date > b.recap_date ? 1 : 0));

      setRecapAuditResult(result);
      const unmatchedCount = result.filter(r => !r.matched).length;
      toast({ title: 'Audit selesai', description: `${unmatchedCount} dari ${result.length} recap belum ketemu pasangannya.` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal audit', description: err.message });
    } finally {
      setRecapAuditLoading(false);
    }
  }, [recapAuditRange, toast]);
  const handleAutoMatchDebit = useCallback(async (entry, { silent = false } = {}) => {
    setAutoMatchingId(entry.id);
    try {
      const recapsForEntry = debitRecaps[entry.id] || await loadDebitRecapsForSettlement(entry);
      if (!recapsForEntry || !recapsForEntry.length) {
        if (!silent) toast({ variant: 'destructive', title: 'Tidak ada recap', description: 'Tidak ditemukan transaksi debit di daily recap untuk settlement ini.' });
        return;
      }

      // Ambil SEMUA check debit_settlement yang sudah tercentang, di settlement manapun,
      // supaya recap yang sudah dipakai settlement lain tidak diambil lagi.
      const { data: existingChecks } = await supabase
        .from('bsi_reconciliation_checks')
        .select('id, daily_recap_id, debit_settlement_id, is_checked')
        .eq('source_type', 'debit_settlement')
        .in('daily_recap_id', recapsForEntry.map(r => r.id));

      const usedElsewhere = new Set(
        (existingChecks || [])
          .filter(c => c.is_checked && c.debit_settlement_id !== entry.id)
          .map(c => c.daily_recap_id)
      );
      // Match lama milik settlement INI SENDIRI dihitung ulang dari nol, bukan ditambah-tambah
      const currentEntryChecked = (existingChecks || []).filter(c => c.is_checked && c.debit_settlement_id === entry.id);

      const availableRecaps = recapsForEntry.filter(r => !usedElsewhere.has(r.id));
      const combo = findMatchingCombo(availableRecaps, entry.sales_volume, 5000);
      const comboIds = new Set(combo.map(r => r.id));

      // Uncheck recap yang sebelumnya kepilih di settlement ini tapi tidak lagi terpakai
      for (const c of currentEntryChecked) {
        if (!comboIds.has(c.daily_recap_id)) {
          const recap = recapsForEntry.find(r => r.id === c.daily_recap_id);
          if (recap) await handleDebitCheck(entry, recap, false);
        }
      }
      // Check recap hasil kombinasi terbaru
      for (const recap of combo) {
        await handleDebitCheck(entry, recap, true);
      }

      if (!combo.length) {
        if (!silent) toast({ variant: 'destructive', title: 'Tidak ditemukan kombinasi', description: `Tidak ada kombinasi transaksi yang jumlahnya cocok dengan Rp ${Number(entry.sales_volume).toLocaleString('id-ID')}.` });
        return;
      }
      if (!silent) toast({ title: 'Auto match selesai', description: `${combo.length} transaksi dicentang untuk settlement ${entry.report_date} (Rp ${combo.reduce((s, r) => s + Number(r.amount), 0).toLocaleString('id-ID')}).` });
    } catch (err) {
      if (!silent) toast({ variant: 'destructive', title: 'Gagal auto match', description: err.message });
    } finally {
      setAutoMatchingId(null);
    }
  }, [debitRecaps, loadDebitRecapsForSettlement, handleDebitCheck, toast]);

  // Summary
  const summary = React.useMemo(() => {
    const matched = reconciled.filter(r => r.status === 'matched').length;
    const unmatched = reconciled.filter(r => r.status === 'unmatched').length;
    const totalAmt = reconciled.reduce((s, r) => s + Number(r.nominal || r.amount || 0), 0);
    const matchedAmt = reconciled.filter(r => r.status === 'matched').reduce((s, r) => s + Number(r.nominal || r.amount || 0), 0);
    const unmatchedAmt = reconciled.filter(r => r.status === 'unmatched').reduce((s, r) => s + Number(r.nominal || r.amount || 0), 0);
    const byType = { qris: 0, debit: 0, transfer: 0 };
    reconciled.forEach(r => { if (byType[r.tipe] !== undefined) byType[r.tipe]++; });
    return { matched, unmatched, totalAmt, matchedAmt, unmatchedAmt, byType, total: reconciled.length };
  }, [reconciled]);

  const txForDisplay = selectedMonth ? savedTransactions : csvRows.map(r => ({
    tgl_masuk: r.masukDateStr, tgl_transaksi: r.qrisTrxDateStr || r.masukDateStr,
    deskripsi: r.deskripsi, nama_pengirim: r.namaPengirim, nominal: r.amount, tipe: r.tipe,
  }));

  const filtered = React.useMemo(() => {
    const source = reconciled.length > 0 ? reconciled : [];
    return source.filter(r => {
      const matchType = filterType === 'all' || r.tipe === filterType;
      const matchStatus = filterStatus === 'all' || r.status === filterStatus;
      const q = search.toLowerCase();
      const matchSearch = !q || r.deskripsi?.toLowerCase().includes(q) ||
        r.nama_pengirim?.toLowerCase().includes(q) ||
        r.matchedRecap?.patient_name?.toLowerCase().includes(q) ||
        String(r.nominal || r.amount).includes(q);
      return matchType && matchStatus && matchSearch;
    });
  }, [reconciled, filterType, filterStatus, search]);

  const missingMonths = Object.entries(uploadedMonths)
    .filter(([, v]) => v === null)
    .map(([k]) => k);

  // Konten detail baris "Hasil Rekonsiliasi" — dipakai bareng di tampilan tabel
  // (desktop) maupun kartu (mobile) supaya logikanya tidak dobel.
  const renderReconciledRowDetail = (row, idx) => (
    <>
      {row.tipe === 'debit' && row.status === 'matched' && row.matchedSettlement && (
        <DebitSettlementDetail settlement={row.matchedSettlement} mutasiNominal={row.nominal || row.amount} selisih={row.debitSelisih} />
      )}
      {row.status === 'matched' && row.matchedRecap && !row._editMode && (
        <div className="flex flex-col gap-3">
          {/* Tampil semua recap yang match */}
          {(row.manualRecaps || [row.matchedRecap]).map((mr, i) => (
            <div key={mr.id || i} className="flex flex-wrap gap-4 text-sm">
              <div><span className="text-slate-500 text-xs uppercase font-semibold">Pasien</span><p className="font-semibold text-slate-800">{mr.patient_name}</p></div>
              <div><span className="text-slate-500 text-xs uppercase font-semibold">Tgl Daily Recap</span><p className="font-semibold text-slate-800">{mr.recap_date}</p></div>
              <div><span className="text-slate-500 text-xs uppercase font-semibold">Metode</span><p className="font-semibold text-slate-800">{mr.payment_method}</p></div>
              <div><span className="text-slate-500 text-xs uppercase font-semibold">Nominal Recap</span><p className="font-semibold text-green-700">{formatRp(mr.amount)}</p></div>
            </div>
          ))}
          {/* Total jika lebih dari 1 */}
          {row.manualRecaps && row.manualRecaps.length > 1 && (
            <div className="flex justify-between items-center pt-2 border-t border-green-200">
              <span className="text-xs font-semibold text-green-700">Total ({row.manualRecaps.length} transaksi)</span>
              <span className="text-sm font-bold text-green-700">{formatRp(row.manualRecaps.reduce((s, mr) => s + Number(mr.amount), 0))}</span>
            </div>
          )}
          {row.tipe !== 'debit' && (
            <div className="flex justify-end">
              <button
                onClick={() => setReconciled(prev => prev.map((r, i) => i === idx ? {...r, _editMode: true} : r))}
                className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1 border border-amber-300 rounded px-2 py-1 bg-white"
              >
                ✏️ Ubah Match
              </button>
            </div>
          )}
        </div>
      )}
      {(row.status === 'unmatched' || row._editMode) && row.tipe !== 'debit' && (
        <>
          {row._editMode && (
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-amber-700 font-semibold">Mode Edit — pilih ulang transaksi yang cocok:</p>
              <button
                onClick={() => setReconciled(prev => prev.map((r, i) => i === idx ? {...r, _editMode: false} : r))}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Batal
              </button>
            </div>
          )}
          <UnmatchedRecapPicker
            row={row}
            allRecaps={allRecapsForPeriod}
            mutasiChecks={mutasiChecks}
            onCheck={handleMutasiCheck}
            onLoad={() => { if (!allRecapsForPeriod.length) loadAllRecapsForPeriod(); }}
            matchedRecapIds={new Set([
              ...globalMatchedRecapIds,
              ...reconciled.flatMap(r => (r.manualRecaps && r.manualRecaps.length ? r.manualRecaps.map(mr => mr.id) : (r.matchedRecap ? [r.matchedRecap.id] : []))),
            ])}
          />
        </>
      )}
    </>
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Hero Banner */}
      <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 shadow-xl border border-slate-700/50 relative">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative flex items-center gap-4 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-indigo-600/80 flex items-center justify-center shadow-lg">
            <Landmark className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold tracking-widest text-indigo-300 uppercase mb-1">{useAuth().clinicName || ''}</p>
            <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">
              {readOnly ? 'Check Transaksi BSI' : 'Rekonsiliasi Mutasi BSI'}
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {readOnly
                ? 'Crosscheck transaksi mutasi BSI dengan Daily Recap.'
                : 'Upload dan simpan mutasi rekening BSI, lalu cocokkan dengan Daily Recap.'}
            </p>
          </div>
        </div>
      </div>

      {/* Missing months warning */}
      {missingMonths.length > 0 && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Bulan belum ada file mutasi:</p>
            <p className="text-sm text-red-600 mt-0.5">
              {missingMonths.map(k => {
                const [y, m] = k.split('-');
                return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
              }).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Month Status Grid */}
      <MonthStatusGrid
        uploadedMonths={uploadedMonths}
        onSelectMonth={setSelectedMonth}
        selectedMonth={selectedMonth}
      />

      {/* Tabs */}
      <div className="flex border-b gap-1">
        {!readOnly && (
          <button
            onClick={() => setActiveTab('upload')}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'upload'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
          >
            <UploadCloud className="w-4 h-4 inline mr-1.5" />
            Upload CSV
          </button>
        )}
        <button
          onClick={() => setActiveTab('check')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'check'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          )}
        >
          <CheckCircle2 className="w-4 h-4 inline mr-1.5" />
          Check Transaksi
        </button>
        <button
          onClick={() => setActiveTab('debit')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'debit'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          )}
        >
          <CreditCard className="w-4 h-4 inline mr-1.5" />
          Debit EDC
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'audit'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          )}
        >
          <Search className="w-4 h-4 inline mr-1.5" />
          Recap Belum Match
        </button>
      </div>

      {/* -- UPLOAD TAB -- */}
      {activeTab === 'upload' && !readOnly && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <label className="flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 transition-all text-sm font-medium text-slate-600">
                  <Upload className="w-4 h-4 text-blue-500" />
                  {fileName
                    ? <span className="text-blue-700 truncate max-w-[220px]">{fileName}</span>
                    : <span>Pilih file CSV mutasi BSI</span>}
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                </label>

                {csvRows.length > 0 && (
                  <>
                    <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                      {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                      Simpan ke Database
                    </Button>
                    <Button variant="outline" onClick={handleReset} className="gap-2">
                      <XCircle className="w-4 h-4" /> Reset
                    </Button>
                  </>
                )}
              </div>

              {csvRows.length > 0 && (
                <div className="mt-3 flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>{csvRows.length} transaksi siap disimpan. Periode: {csvRows[0]?.masukDateStr} s/d {csvRows[csvRows.length - 1]?.masukDateStr}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview CSV */}
          {csvRows.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Preview Data ({csvRows.length} transaksi)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Mobile: kartu */}
                <div className="sm:hidden divide-y max-h-80 overflow-y-auto">
                  {csvRows.map((row, i) => (
                    <div key={i} className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <TypeBadge tipe={row.tipe} />
                        <span className="text-xs font-bold text-slate-800">{formatRp(row.amount)}</span>
                      </div>
                      <div className="font-mono text-xs text-slate-600 break-words">{row.deskripsi}</div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span>Masuk: {row.masukDateStr}</span>
                        {row.tipe === 'qris'
                          ? <span className="text-emerald-700 font-medium">Trx: {row.qrisTrxDateStr}</span>
                          : <span className="text-slate-400">Trx = masuk</span>}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop: tabel */}
                <div className="hidden sm:block overflow-x-auto max-h-80">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="border-b text-xs uppercase tracking-wide text-slate-600">
                        <th className="text-left px-4 py-2 font-semibold">Tipe</th>
                        <th className="text-left px-4 py-2 font-semibold">Tgl Masuk</th>
                        <th className="text-left px-4 py-2 font-semibold">Tgl Transaksi</th>
                        <th className="text-left px-4 py-2 font-semibold">Deskripsi</th>
                        <th className="text-right px-4 py-2 font-semibold">Nominal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((row, i) => (
                        <tr key={i} className="border-b hover:bg-slate-50">
                          <td className="px-4 py-2"><TypeBadge tipe={row.tipe} /></td>
                          <td className="px-4 py-2 text-xs text-slate-600">{row.masukDateStr}</td>
                          <td className="px-4 py-2 text-xs">{row.tipe === 'qris' ? <span className="text-emerald-700 font-medium">{row.qrisTrxDateStr}</span> : <span className="text-slate-400">= masuk</span>}</td>
                          <td className="px-4 py-2 text-xs font-mono truncate max-w-[200px]" title={row.deskripsi}>{row.deskripsi}</td>
                          <td className="px-4 py-2 text-right font-bold text-slate-800 text-xs">{formatRp(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Uploaded records for selected month */}
          {selectedMonth && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Upload History - {MONTH_NAMES[parseInt(selectedMonth.split('-')[1]) - 1]} {selectedMonth.split('-')[0]}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingMonth ? (
                  <div className="text-center py-6 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mx-auto" /></div>
                ) : uploads.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Belum ada upload untuk bulan ini.</p>
                ) : (
                  <div className="space-y-2">
                    {uploads.map(up => (
                      <div key={up.id} className="flex items-center justify-between rounded-lg border px-4 py-3 bg-slate-50">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{up.notes || 'Upload'}</p>
                          <p className="text-xs text-slate-500">{up.periode_start} s/d {up.periode_end} . {up.jumlah_transaksi} transaksi</p>
                          <p className="text-xs text-slate-400">{format(parseISO(up.uploaded_at), 'dd MMM yyyy HH:mm', { locale: localeId })}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteUpload(up.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* -- CHECK TAB -- */}
      {activeTab === 'check' && (
        <div className="space-y-4">
          {/* Source selector */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex flex-wrap gap-3 items-center">
                {selectedMonth ? (
                  <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <Calendar className="w-4 h-4" />
                    <span>
                      Menampilkan transaksi <strong>{MONTH_NAMES[parseInt(selectedMonth.split('-')[1]) - 1]} {selectedMonth.split('-')[0]}</strong>
                      {' '}({savedTransactions.length} transaksi dari database)
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    Pilih bulan di grid atas untuk melihat transaksi tersimpan, atau upload CSV baru di tab Upload.
                  </div>
                )}

                {(savedTransactions.length > 0 || csvRows.length > 0) && (
                  <Button
                    onClick={handleReconcile}
                    disabled={reconciling}
                    className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                  >
                    {reconciling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Cocokkan dengan Daily Recap
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          {reconciled.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="border-slate-200">
                <CardContent className="pt-4">
                  <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">Total</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{summary.total}</p>
                </CardContent>
              </Card>
              <Card className="border-green-200 bg-green-50">
                <CardContent className="pt-4">
                  <p className="text-xs text-green-700 uppercase font-semibold tracking-wide">Cocok</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">{summary.matched}</p>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-4">
                  <p className="text-xs text-red-700 uppercase font-semibold tracking-wide">Belum Cocok</p>
                  <p className="text-2xl font-bold text-red-700 mt-1">{summary.unmatched}</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200">
                <CardContent className="pt-4">
                  <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">Per Tipe</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">QRIS: {summary.byType.qris}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Debit: {summary.byType.debit}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">TRF: {summary.byType.transfer}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filter */}
          {reconciled.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Cari nama pasien, deskripsi, nominal..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="h-10 px-3 rounded-md border border-input bg-white text-sm outline-none min-w-[130px]">
                <option value="all">Semua Tipe</option>
                <option value="qris">QRIS</option>
                <option value="debit">Debit</option>
                <option value="transfer">Transfer</option>
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-10 px-3 rounded-md border border-input bg-white text-sm outline-none min-w-[140px]">
                <option value="all">Semua Status</option>
                <option value="matched">Sudah Cocok</option>
                <option value="unmatched">Belum Cocok</option>
              </select>
            </div>
          )}

          {/* Results table */}
          {reconciled.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Hasil Rekonsiliasi ({filtered.length} transaksi)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Mobile: kartu — tampilkan field paling penting saja (Tipe, Tanggal,
                    Deskripsi, Nominal, Status), sisanya (recap yang match / picker manual /
                    detail settlement debit) tetap bisa dibuka lewat tombol Detail yang sama
                    persis dengan yang dipakai tabel desktop. */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {filtered.map((row, idx) => {
                    const isExpanded = expandedIdx === idx;
                    return (
                      <div key={idx} className={cn(row.status === 'unmatched' ? 'bg-red-50/50' : '')}>
                        <div className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <TypeBadge tipe={row.tipe} />
                              <StatusBadge status={row.status} />
                            </div>
                            <span className="text-sm font-bold text-slate-800 whitespace-nowrap">{formatRp(row.nominal || row.amount)}</span>
                          </div>
                          <div>
                            <div className="font-mono text-xs text-slate-700 break-words">{row.deskripsi}</div>
                            {row.nama_pengirim && <div className="text-xs text-slate-500 mt-0.5">dari: {row.nama_pengirim}</div>}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500">
                            <span>Masuk: {row.tgl_masuk}</span>
                            {row.tipe === 'qris'
                              ? <span className="font-medium text-emerald-700">Trx: {row.tgl_transaksi}</span>
                              : <span className="text-slate-400">Trx = masuk</span>}
                          </div>
                          <div>
                            {row.status === 'matched' ? (
                              <button onClick={() => setExpandedIdx(isExpanded ? null : idx)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} {isExpanded ? 'Tutup detail' : 'Lihat recap'}
                              </button>
                            ) : row.tipe === 'debit' ? (
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <CreditCard className="w-3.5 h-3.5" /> Lihat tab Debit EDC
                              </span>
                            ) : (
                              <button onClick={() => setExpandedIdx(isExpanded ? null : idx)} className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800">
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} {isExpanded ? 'Tutup detail' : 'Pilih manual'}
                              </button>
                            )}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-3 pb-3 bg-green-50/60 border-t border-slate-100 pt-3">
                            {renderReconciledRowDetail(row, idx)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filtered.length === 0 && (
                    <div className="px-4 py-10 text-center text-slate-400 text-sm">Tidak ada transaksi yang sesuai filter.</div>
                  )}
                </div>

                {/* Desktop: tabel penuh */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                        <th className="text-left px-4 py-3 font-semibold">Tipe</th>
                        <th className="text-left px-4 py-3 font-semibold">Tgl Masuk Rekening</th>
                        <th className="text-left px-4 py-3 font-semibold">Tgl Transaksi</th>
                        <th className="text-left px-4 py-3 font-semibold">Deskripsi / Pengirim</th>
                        <th className="text-right px-4 py-3 font-semibold">Nominal</th>
                        <th className="text-left px-4 py-3 font-semibold">Status</th>
                        <th className="text-left px-4 py-3 font-semibold">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((row, idx) => {
                        const isExpanded = expandedIdx === idx;
                        return (
                          <React.Fragment key={idx}>
                            <tr className={cn('border-b transition-colors', row.status === 'unmatched' ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-slate-50')}>
                              <td className="px-4 py-3"><TypeBadge tipe={row.tipe} /></td>
                              <td className="px-4 py-3 text-slate-700 whitespace-nowrap text-xs">{row.tgl_masuk}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-xs">
                                {row.tipe === 'qris'
                                  ? <span className="font-medium text-emerald-700">{row.tgl_transaksi}</span>
                                  : <span className="text-slate-400">= Tgl masuk</span>}
                              </td>
                              <td className="px-4 py-3 max-w-[220px]">
                                <div className="truncate font-mono text-xs text-slate-700" title={row.deskripsi}>{row.deskripsi}</div>
                                {row.nama_pengirim && <div className="text-xs text-slate-500 mt-0.5">dari: {row.nama_pengirim}</div>}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap text-xs">{formatRp(row.nominal || row.amount)}</td>
                              <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                              <td className="px-4 py-3">
                                {row.status === 'matched' ? (
                                  <button onClick={() => setExpandedIdx(isExpanded ? null : idx)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} Lihat recap
                                  </button>
                                ) : row.tipe === 'debit' ? (
                                  <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <CreditCard className="w-3.5 h-3.5" /> Lihat tab Debit EDC
                                  </span>
                                ) : (
                                  <button onClick={() => setExpandedIdx(isExpanded ? null : idx)} className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800">
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} Pilih manual
                                  </button>
                                )}
                              </td>
                            </tr>
                            {isExpanded && (row.matchedSettlement || row.matchedRecap || row.status === 'unmatched' || row._editMode) && (
                              <tr className={cn('border-b', row.status === 'unmatched' || row._editMode ? 'bg-amber-50/50' : 'bg-green-50')}>
                                <td colSpan={7} className="px-4 py-3">
                                  {renderReconciledRowDetail(row, idx)}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                      {filtered.length === 0 && (
                        <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Tidak ada transaksi yang sesuai filter.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          

          {/* Saved transactions preview (before reconcile) */}
          {reconciled.length === 0 && savedTransactions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Transaksi Tersimpan ({savedTransactions.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Mobile: kartu */}
                <div className="sm:hidden divide-y max-h-80 overflow-y-auto">
                  {savedTransactions.map((row, i) => (
                    <div key={i} className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <TypeBadge tipe={row.tipe} />
                        <span className="text-xs font-bold text-slate-800">{formatRp(row.nominal)}</span>
                      </div>
                      <div className="font-mono text-xs text-slate-600 break-words">{row.deskripsi}</div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span>Masuk: {row.tgl_masuk}</span>
                        {row.tipe === 'qris'
                          ? <span className="text-emerald-700 font-medium">Trx: {row.tgl_transaksi}</span>
                          : <span className="text-slate-400">Trx = masuk</span>}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop: tabel */}
                <div className="hidden sm:block overflow-x-auto max-h-80">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr className="border-b text-xs uppercase tracking-wide text-slate-600">
                        <th className="text-left px-4 py-2 font-semibold">Tipe</th>
                        <th className="text-left px-4 py-2 font-semibold">Tgl Masuk</th>
                        <th className="text-left px-4 py-2 font-semibold">Tgl Transaksi</th>
                        <th className="text-left px-4 py-2 font-semibold">Deskripsi</th>
                        <th className="text-right px-4 py-2 font-semibold">Nominal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedTransactions.map((row, i) => (
                        <tr key={i} className="border-b hover:bg-slate-50">
                          <td className="px-4 py-2"><TypeBadge tipe={row.tipe} /></td>
                          <td className="px-4 py-2 text-xs text-slate-600">{row.tgl_masuk}</td>
                          <td className="px-4 py-2 text-xs">
                            {row.tipe === 'qris' ? <span className="text-emerald-700 font-medium">{row.tgl_transaksi}</span> : <span className="text-slate-400">= masuk</span>}
                          </td>
                          <td className="px-4 py-2 text-xs font-mono truncate max-w-[200px]" title={row.deskripsi}>{row.deskripsi}</td>
                          <td className="px-4 py-2 text-right font-bold text-slate-800 text-xs">{formatRp(row.nominal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {reconciled.length === 0 && savedTransactions.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Pilih bulan di grid atas untuk mulai crosscheck.</p>
            </div>
          )}
        </div>
      )}

      {/* -- DEBIT EDC TAB -- */}
      {activeTab === 'debit' && (
        <div className="space-y-4">
          {/* Header: filter bulan + upload */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
                <select
                  value={debitFilterMonth}
                  onChange={(e) => setDebitFilterMonth(e.target.value)}
                  className="h-10 px-3 rounded-md border border-input bg-white text-sm outline-none min-w-[160px]"
                >
                  {generateMonthList().map(({ year, month }) => {
                    const key = `${year}-${String(month).padStart(2, '0')}`;
                    return <option key={key} value={key}>{MONTH_NAMES[month - 1]} {year}</option>;
                  })}
                </select>
                <label className={cn(
                  'flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border-2 border-dashed transition-all text-sm font-medium',
                  debitParsing ? 'border-blue-300 bg-blue-50 text-blue-400 cursor-not-allowed' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50 text-slate-600'
                )}>
                  {debitParsing ? <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" /> : <FilePlus2 className="w-4 h-4 text-blue-500" />}
                  {debitParsing ? 'Memproses File...' : 'Upload Settlement Debit (PDF/CSV)'}
                  <input type="file" accept=".pdf,.csv" multiple className="hidden" onChange={handleDebitPdfUpload} disabled={debitParsing} />
                </label>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Menampilkan settlement bulan <strong>{MONTH_NAMES[parseInt(debitFilterMonth.split('-')[1]) - 1]} {debitFilterMonth.split('-')[0]}</strong>.
                {' '}Upload PDF "Ringkasan Tagihan" atau CSV "Merchant Statement" EDC BSI. Bisa pilih banyak file sekaligus, boleh campur PDF & CSV.
              </p>
            </CardContent>
          </Card>

          {/* Daftar settlement per bulan */}
          {debitEntries.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Belum ada data settlement debit untuk bulan ini.</p>
              <p className="text-xs mt-1 text-slate-300">Upload PDF untuk mulai.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {debitEntries.map(entry => {
                const recapsForEntry = debitRecaps[entry.id] || null;
                const checkedRecaps = recapsForEntry ? recapsForEntry.filter(r => debitChecks[`${entry.id}::${r.id}`]?.is_checked) : [];
                const totalChecked = checkedRecaps.reduce((s, r) => s + Number(r.amount), 0);
                const isLoaded = recapsForEntry !== null;
                const selisih = Math.round(entry.sales_volume) - Math.round(totalChecked);

                return (
                  <Card key={entry.id} className={cn('border-2', 
                    checkedRecaps.length > 0 && selisih === 0 ? 'border-green-300' :
                    checkedRecaps.length > 0 ? 'border-amber-300' : 'border-slate-200'
                  )}>
                    <CardContent className="pt-4 pb-4">
                      {/* Header settlement */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          {checkedRecaps.length > 0 && selisih === 0
                            ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                            : <CreditCard className="w-4 h-4 text-blue-400 shrink-0" />}
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{entry.file_name}</p>
                            <p className="text-xs text-slate-400">{entry.account_name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Tgl Masuk Rekening</p>
                            <p className="text-sm font-bold text-slate-800">{entry.report_date}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Sales Volume</p>
                            <p className="text-sm font-bold text-slate-800">{formatRp(entry.sales_volume)}</p>
                          </div>
                          {entry.net_amount != null && (
                            <div className="text-right">
                              <p className="text-xs text-slate-500">Net Amount</p>
                              <p className="text-sm font-bold text-emerald-700">{formatRp(entry.net_amount)}</p>
                            </div>
                          )}
                          {checkedRecaps.length > 0 && (
                            <div className="text-right">
                              <p className="text-xs text-slate-500">Total Dicentang</p>
                              <p className={cn("text-sm font-bold", selisih === 0 ? 'text-green-600' : 'text-amber-600')}>{formatRp(totalChecked)}</p>
                            </div>
                          )}
                          {checkedRecaps.length > 0 && selisih !== 0 && (
                            <div className="text-right">
                              <p className="text-xs text-slate-500">Selisih</p>
                              <p className="text-sm font-bold text-red-600">{formatRp(Math.abs(selisih))}</p>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Button
                              size="sm" variant="outline"
                              onClick={() => handleAutoMatchDebit(entry)}
                              disabled={autoMatchingId === entry.id}
                              className="text-xs gap-1 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                            >
                              {autoMatchingId === entry.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                              Auto Match
                            </Button>
                            <Button
                              size="sm" variant="outline"
                              onClick={() => !isLoaded ? loadDebitRecapsForSettlement(entry) : setDebitRecaps(prev => { const n = {...prev}; delete n[entry.id]; return n; })}
                              className="text-xs gap-1"
                            >
                              {debitLoadingRecaps ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FileSearch2 className="w-3 h-3" />}
                              {isLoaded ? 'Tutup' : 'Lihat Recap'}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleRemoveDebitEntry(entry.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Tabel recap debit — muncul saat diklik "Lihat Recap" */}
                      {isLoaded && (
                        <div className="mt-3 border rounded-xl overflow-hidden">
                          <div className="bg-slate-50 px-4 py-2 flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                              Transaksi Debit Daily Recap (10 hari sebelum {entry.report_date})
                            </p>
                            <p className="text-xs text-slate-400">{recapsForEntry.length} transaksi ditemukan</p>
                          </div>
                          {recapsForEntry.length === 0 ? (
                            <div className="px-4 py-6 text-center text-slate-400 text-xs">
                              Tidak ada transaksi debit di daily recap dalam 10 hari sebelum tanggal ini.
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b text-xs text-slate-500 uppercase tracking-wide">
                                  <th className="px-4 py-2 text-left w-10">✓</th>
                                  <th className="px-4 py-2 text-left">Pasien</th>
                                  <th className="px-4 py-2 text-left">Tgl Transaksi</th>
                                  <th className="px-4 py-2 text-left">Status</th>
                                  <th className="px-4 py-2 text-right">Nominal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {recapsForEntry.map(recap => {
                                  const isChecked = debitChecks[`${entry.id}::${recap.id}`]?.is_checked || false;
                                  const usage = debitRecapUsage[recap.id];
                                  const isUsedElsewhere = !!usage && usage.settlementId !== entry.id && !isChecked;
                                  return (
                                    <tr
                                      key={recap.id}
                                      className={cn('border-b transition-colors cursor-pointer hover:bg-slate-50',
                                        isChecked ? 'bg-green-50' : isUsedElsewhere ? 'bg-amber-50/60' : ''
                                      )}
                                      onClick={() => {
                                        if (!isChecked && isUsedElsewhere) {
                                          if (!confirm(`Pasien ini sudah dicentang di settlement tanggal ${usage.reportDate || '-'}. Pindahkan ke settlement ini?`)) return;
                                        }
                                        handleDebitCheck(entry, recap, !isChecked);
                                      }}
                                    >
                                      <td className="px-4 py-2.5">
                                        <div className={cn(
                                          'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                                          isChecked ? 'bg-green-500 border-green-500' : 'border-slate-300'
                                        )}>
                                          {isChecked && <CheckCircle2 className="w-3 h-3 text-white" />}
                                        </div>
                                      </td>
                                      <td className="px-4 py-2.5 text-xs font-medium text-slate-800">{recap.patient_name}</td>
                                      <td className="px-4 py-2.5 text-xs text-slate-500">{recap.recap_date}</td>
                                      <td className="px-4 py-2.5">
                                        {isChecked ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                            <CheckCircle2 className="w-3 h-3" /> Dipilih di sini
                                          </span>
                                        ) : isUsedElsewhere ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                            ⚠ Sudah dipakai settlement {usage.reportDate || '-'}
                                          </span>
                                        ) : (
                                          <span className="text-xs text-slate-400">Belum dipakai</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-800">{formatRp(recap.amount)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="bg-slate-50 border-t">
                                  <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-slate-600">Total dicentang</td>
                                  <td className="px-4 py-2 text-right text-xs font-bold text-green-700">{formatRp(totalChecked)}</td>
                                </tr>
                              </tfoot>
                            </table>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* -- AUDIT RECAP TAB -- */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Dari tanggal</label>
                  <input type="date" value={recapAuditRange.start} onChange={e => setRecapAuditRange(prev => ({ ...prev, start: e.target.value }))} className="h-10 px-3 rounded-md border border-input bg-white text-sm outline-none" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Sampai tanggal</label>
                  <input type="date" value={recapAuditRange.end} onChange={e => setRecapAuditRange(prev => ({ ...prev, end: e.target.value }))} className="h-10 px-3 rounded-md border border-input bg-white text-sm outline-none" />
                </div>
                <Button onClick={runRecapAudit} disabled={recapAuditLoading} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                  {recapAuditLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Cek Recap
                </Button>
                {recapAuditResult && (
                  <select value={recapAuditFilter} onChange={e => setRecapAuditFilter(e.target.value)} className="h-10 px-3 rounded-md border border-input bg-white text-sm outline-none">
                    <option value="unmatched">Tampilkan yang Belum Match saja</option>
                    <option value="all">Tampilkan Semua</option>
                  </select>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-2">Cek daily recap (QRIS/Debit/Transfer) mana yang belum ketemu pasangannya di mutasi rekening BSI ataupun settlement EDC.</p>
            </CardContent>
          </Card>

          {recapAuditResult && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="border-slate-200">
                  <CardContent className="pt-4">
                    <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">Total Dicek</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{recapAuditResult.length}</p>
                  </CardContent>
                </Card>
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="pt-4">
                    <p className="text-xs text-green-700 uppercase font-semibold tracking-wide">Sudah Match</p>
                    <p className="text-2xl font-bold text-green-700 mt-1">{recapAuditResult.filter(r => r.matched).length}</p>
                  </CardContent>
                </Card>
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="pt-4">
                    <p className="text-xs text-red-700 uppercase font-semibold tracking-wide">Belum Match</p>
                    <p className="text-2xl font-bold text-red-700 mt-1">{recapAuditResult.filter(r => !r.matched).length}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="p-0">
                  {/* Mobile: kartu */}
                  <div className="sm:hidden divide-y">
                    {recapAuditResult
                      .filter(r => recapAuditFilter === 'all' || !r.matched)
                      .map(r => (
                        <div key={r.id} className={cn('p-3 space-y-1.5', !r.matched ? 'bg-red-50/50' : '')}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <TypeBadge tipe={r.tipe} />
                              <StatusBadge status={r.matched ? 'matched' : 'unmatched'} />
                            </div>
                            <span className="text-xs font-bold text-slate-800">{formatRp(r.amount)}</span>
                          </div>
                          <div className="text-sm font-medium text-slate-800">{r.patient_name}</div>
                          <div className="text-[11px] text-slate-500">{r.recap_date}</div>
                          {!r.matched && r.reason && (
                            <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">{r.reason}</div>
                          )}
                        </div>
                      ))}
                    {recapAuditResult.filter(r => recapAuditFilter === 'all' || !r.matched).length === 0 && (
                      <div className="px-4 py-10 text-center text-slate-400 text-sm">
                        {recapAuditFilter === 'unmatched' ? '🎉 Semua recap sudah match!' : 'Tidak ada data.'}
                      </div>
                    )}
                  </div>
                  {/* Desktop: tabel */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                          <th className="text-left px-4 py-3 font-semibold">Tipe</th>
                          <th className="text-left px-4 py-3 font-semibold">Tgl Recap</th>
                          <th className="text-left px-4 py-3 font-semibold">Pasien</th>
                          <th className="text-right px-4 py-3 font-semibold">Nominal</th>
                          <th className="text-left px-4 py-3 font-semibold">Status</th>
                          <th className="text-left px-4 py-3 font-semibold">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recapAuditResult
                          .filter(r => recapAuditFilter === 'all' || !r.matched)
                          .map(r => (
                            <tr key={r.id} className={cn('border-b', !r.matched ? 'bg-red-50/50' : '')}>
                              <td className="px-4 py-3"><TypeBadge tipe={r.tipe} /></td>
                              <td className="px-4 py-3 text-xs text-slate-700">{r.recap_date}</td>
                              <td className="px-4 py-3 text-sm font-medium text-slate-800">{r.patient_name}</td>
                              <td className="px-4 py-3 text-right font-bold text-slate-800 text-xs">{formatRp(r.amount)}</td>
                              <td className="px-4 py-3"><StatusBadge status={r.matched ? 'matched' : 'unmatched'} /></td>
                              <td className="px-4 py-3 text-xs text-slate-500">{r.matched ? '-' : r.reason}</td>
                            </tr>
                          ))}
                        {recapAuditResult.filter(r => recapAuditFilter === 'all' || !r.matched).length === 0 && (
                          <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                            {recapAuditFilter === 'unmatched' ? '🎉 Semua recap sudah match!' : 'Tidak ada data.'}
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
        <Info className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
        <span>
          <strong>Catatan:</strong> QRIS dicocokkan berdasarkan tanggal scan QR (dari deskripsi) +/-Rp 15.000.
          Debit dicocokkan berdasarkan nominal +/-Rp 20.000 tanpa filter tanggal.
          Transfer dicocokkan berdasarkan tanggal masuk rekening dengan nominal exact.
        </span>
      </div>
    </div>
  );
};

export default BSIMutasiReconciliation;
