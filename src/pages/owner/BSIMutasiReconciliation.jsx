import React, { useState, useCallback, useEffect } from 'react';
import {
  Upload, FileText, AlertTriangle, CheckCircle2, XCircle,
  QrCode, CreditCard, ArrowLeftRight, Search, RefreshCw,
  ChevronDown, ChevronUp, Info, Calendar, CloudUpload,
  CheckCircle, Clock, Trash2
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

  // Tab: 'upload' | 'check'
  const [activeTab, setActiveTab] = useState(readOnly ? 'check' : 'upload');

  // Load month status on mount
  useEffect(() => {
    loadMonthStatus();
  }, []);

  const loadMonthStatus = async () => {
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
  };

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
        .order('tgl_masuk'),
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

      // Insert upload record
      const { data: uploadRecord, error: upErr } = await supabase
        .from('bsi_mutasi_uploads')
        .insert({
          periode_start: periodeStart,
          periode_end: periodeEnd,
          jumlah_transaksi: csvRows.length,
          uploaded_by: user?.id || null,
          notes: fileName,
        })
        .select()
        .single();

      if (upErr) throw upErr;

      // Insert transactions in batches of 100
      const txRows = csvRows.map(r => ({
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
      for (let i = 0; i < txRows.length; i += batchSize) {
        const { error } = await supabase
          .from('bsi_mutasi_transactions')
          .insert(txRows.slice(i, i + batchSize));
        if (error) throw error;
      }

      toast({ title: 'Berhasil disimpan', description: `${csvRows.length} transaksi tersimpan ke database.` });
      setCsvRows([]);
      setFileName('');
      await loadMonthStatus();

      // Auto-select month dari data yang baru disimpan
      const firstRow = csvRows[0];
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
        .select('id, recap_date, amount, payment_method, patient_id, actual_patient_id')
        .gte('recap_date', minDate)
        .lte('recap_date', maxDate)
        .not('amount', 'is', null)
        .gt('amount', 0);

      if (error) throw error;

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

      const getPatientName = (r) => patientMap[r.actual_patient_id] || patientMap[r.patient_id] || '-';

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

      const result = txList.map(row => {
        let matched = null;
        let candidates = [];
        const mutasiAmt = Math.round(Number(row.nominal || row.amount));
        const tglTransaksi = row.tgl_transaksi;
        const tglMasuk = row.tgl_masuk;

        if (row.tipe === 'qris') {
          candidates = qrisRecaps.filter(r => {
            const recapAmt = Math.round(Number(r.amount));
            return !usedIds.has(r.id) && r.recap_date === tglTransaksi &&
              recapAmt >= mutasiAmt && recapAmt <= mutasiAmt + 15000;
          });
        } else if (row.tipe === 'debit') {
          candidates = debitRecaps.filter(r => {
            const recapAmt = Math.round(Number(r.amount));
            return !usedIds.has(r.id) && recapAmt >= mutasiAmt && recapAmt <= mutasiAmt + 20000;
          });
        } else if (row.tipe === 'transfer') {
          candidates = transferRecaps.filter(r => {
            const recapAmt = Math.round(Number(r.amount));
            return !usedIds.has(r.id) && recapAmt === mutasiAmt && r.recap_date === tglMasuk;
          });
        }

        if (candidates.length > 0) {
          matched = candidates[0];
          usedIds.add(matched.id);
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

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {readOnly ? 'Check Transaksi BSI' : 'Rekonsiliasi Mutasi BSI'}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {readOnly
            ? 'Crosscheck transaksi mutasi BSI dengan Daily Recap.'
            : 'Upload dan simpan mutasi rekening BSI, lalu cocokkan dengan Daily Recap.'}
        </p>
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
            <CloudUpload className="w-4 h-4 inline mr-1.5" />
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
                      {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
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
                <div className="overflow-x-auto max-h-80">
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
                  <p className="text-xs text-slate-500 mt-0.5">{formatRp(summary.totalAmt)}</p>
                </CardContent>
              </Card>
              <Card className="border-green-200 bg-green-50">
                <CardContent className="pt-4">
                  <p className="text-xs text-green-700 uppercase font-semibold tracking-wide">Cocok</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">{summary.matched}</p>
                  <p className="text-xs text-green-600 mt-0.5">{formatRp(summary.matchedAmt)}</p>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-4">
                  <p className="text-xs text-red-700 uppercase font-semibold tracking-wide">Belum Cocok</p>
                  <p className="text-2xl font-bold text-red-700 mt-1">{summary.unmatched}</p>
                  <p className="text-xs text-red-600 mt-0.5">{formatRp(summary.unmatchedAmt)}</p>
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
                <div className="overflow-x-auto">
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
                                ) : (
                                  <span className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Tidak ditemukan</span>
                                )}
                              </td>
                            </tr>
                            {isExpanded && row.matchedRecap && (
                              <tr className="bg-green-50 border-b">
                                <td colSpan={7} className="px-4 py-3">
                                  <div className="flex flex-wrap gap-4 text-sm">
                                    <div><span className="text-slate-500 text-xs uppercase font-semibold">Pasien</span><p className="font-semibold text-slate-800">{row.matchedRecap.patient_name}</p></div>
                                    <div><span className="text-slate-500 text-xs uppercase font-semibold">Tgl Daily Recap</span><p className="font-semibold text-slate-800">{row.matchedRecap.recap_date}</p></div>
                                    <div><span className="text-slate-500 text-xs uppercase font-semibold">Metode</span><p className="font-semibold text-slate-800">{row.matchedRecap.payment_method}</p></div>
                                    <div><span className="text-slate-500 text-xs uppercase font-semibold">Nominal Recap</span><p className="font-semibold text-green-700">{formatRp(row.matchedRecap.amount)}</p></div>
                                  </div>
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
                <div className="overflow-x-auto max-h-80">
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
