import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, TrendingDown, DollarSign, Download, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import FinanceTile from '@/components/owner/finance/FinanceTile';
import TxSection from '@/components/owner/finance/TxSection';
import SegControl from '@/components/owner/finance/SegControl';
import { Ring } from '@/components/owner/finance/charts';
import { fmtShort, fmtRp, fmtPct } from '@/components/owner/finance/financeTheme';
import { 
  getOwnerExpenditures, 
  getOwnerIncome, 
  getAdminExpenses, 
  getAdminIncome, 
  getPatientIncomeFromPackages 
} from '@/lib/api';
import * as XLSX from 'xlsx';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { generateAccountingReportPDF } from '@/lib/accountingReportPdfGenerator';

const AccountingReport = ({
  dateRange,
  onDateRangeChange
}) => {
  const { toast } = useToast();
  const { clinicName } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('income');
  // Sumber yang disorot di bar (owner/admin/pasien); null = tampilkan semua.
  const [source, setSource] = useState(null);
  

  const [data, setData] = useState({
    ownerIncome: [],
    adminIncome: [],
    patientIncome: [],
    ownerExpenses: [],
    adminExpenses: []
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
          ownerIncRes,
          adminIncRes,
          patientIncRes,
          ownerExpRes,
          adminExpRes
      ] = await Promise.all([
          getOwnerIncome(dateRange),
          getAdminIncome(dateRange),
          getPatientIncomeFromPackages(dateRange),
          getOwnerExpenditures(dateRange),
          getAdminExpenses(dateRange)
      ]);

      if (ownerIncRes.error) throw ownerIncRes.error;
      // Other error checks omitted for brevity but recommended

      setData({
        ownerIncome: ownerIncRes.data || [],
        adminIncome: adminIncRes.data || [],
        patientIncome: patientIncRes.data || [],
        ownerExpenses: ownerExpRes.data || [],
        adminExpenses: adminExpRes.data || []
      });

    } catch (error) {
      console.error("Report fetch error:", error);
      toast({ variant: "destructive", title: "Gagal memuat data", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  // Calculations
  const sum = (arr) => arr.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  
  const subTotalOwnerInc = sum(data.ownerIncome);
  const subTotalAdminInc = sum(data.adminIncome);
  const subTotalPatientInc = sum(data.patientIncome);
  const totalIncome = subTotalOwnerInc + subTotalAdminInc + subTotalPatientInc;

  const subTotalOwnerExp = sum(data.ownerExpenses);
  const subTotalAdminExp = sum(data.adminExpenses);
  const totalExpenses = subTotalOwnerExp + subTotalAdminExp;

  const netProfit = totalIncome - totalExpenses;

  const formatDate = (dateStr) => {
  if (!dateStr) return '-';

  const date = new Date(dateStr);
  if (isNaN(date)) return '-';

  return format(date, 'dd/MM/yyyy');
};
const handleExportExcel = (mode = 'accrual') => {
  const isCashBasis = mode === 'cash';

  // =========================
  // GABUNG PEMASUKAN
  // =========================
  const combinedIncome = [
    ...data.ownerIncome.map(item => ({
      tanggal: formatDate(item.date),
      deskripsi: item.description || '-',
      nama: '-',
      paket: '-',
      bank: item.bank_accounts?.bank_name || '-',
      metode_pembayaran: item.payment_method || '-',
      jumlah: Number(item.amount) || 0
    })),

    ...data.adminIncome.map(item => ({
      tanggal: formatDate(item.transaction_date || item.date),
      deskripsi: item.description || '-',
      nama: '-',
      paket: '-',
      bank: item.bank_accounts?.bank_name || '-',
      metode_pembayaran: item.payment_method || '-',
      jumlah: Number(item.amount) || 0
    })),

    // Mode "Real-time (Kas Masuk)": nominal paket hanya ditulis pada sesi
    // yang benar-benar ada pembayaran (cash_amount > 0). Sesi lanjutan
    // paket yang belum ada pembayaran baru tetap ditulis 0.
    //
    // Label kolom paket: sesi pertama tetap "Paket X", sesi ke-2 dst
    // ditulis "Sesi ke-N (Paket X)". Baris tanpa paket ("Visit") tidak
    // diubah.
    ...data.patientIncome.map(item => {
      const packageLabel = item.package_name || '-';
      const paket = item.session_number && item.session_number >= 2
        ? `Sesi ke-${item.session_number} (${packageLabel})`
        : packageLabel;

      return {
        tanggal: formatDate(item.date),
        deskripsi: '-',
        nama: item.patient_name || '-',
        paket,
        bank: '-',
        metode_pembayaran: item.payment_method || '-',
        jumlah: isCashBasis ? (Number(item.cash_amount) || 0) : (Number(item.amount) || 0)
      };
    })
  ];
  combinedIncome.sort((a, b) => {
  const [dayA, monthA, yearA] = a.tanggal.split('/');
  const [dayB, monthB, yearB] = b.tanggal.split('/');

  const dateA = new Date(yearA, monthA - 1, dayA);
  const dateB = new Date(yearB, monthB - 1, dayB);

  return dateA - dateB;
});

  // =========================
  // GABUNG PENGELUARAN
  // =========================
  const combinedExpenses = [
    ...data.ownerExpenses.map(item => ({
      tanggal: formatDate(item.date),
      deskripsi: item.description || '-',
      bank: item.bank_accounts?.bank_name || '-',
      metode_pembayaran: item.payment_method || '-',
      jumlah: Number(item.amount) || 0
    })),

    ...data.adminExpenses.map(item => ({
      tanggal: formatDate(item.transaction_date || item.date),
      deskripsi: item.description || '-',
      bank: item.bank_accounts?.bank_name || '-',
      metode_pembayaran: item.payment_method || '-',
      jumlah: Number(item.amount) || 0
    }))
  ];
combinedExpenses.sort((a, b) => {
  const [dayA, monthA, yearA] = a.tanggal.split('/');
  const [dayB, monthB, yearB] = b.tanggal.split('/');

  const dateA = new Date(yearA, monthA - 1, dayA);
  const dateB = new Date(yearB, monthB - 1, dayB);

  return dateA - dateB;
});
  // Total pemasukan mengikuti mode yang dipilih (akrual vs kas riil)
  const exportTotalIncome = combinedIncome.reduce((acc, item) => acc + (Number(item.jumlah) || 0), 0);
  const exportNetProfit = exportTotalIncome - totalExpenses;

  // =========================
  // WORKBOOK
  // =========================
  const workbook = XLSX.utils.book_new();

  // =========================
  // SHEET PEMASUKAN
  // =========================
  const incomeSheet = XLSX.utils.json_to_sheet(
  combinedIncome.map(item => ({
    ...item,
    jumlah: `Rp ${new Intl.NumberFormat('id-ID').format(item.jumlah)}`
  }))
);

  XLSX.utils.sheet_add_aoa(
    incomeSheet,
    [
      [],
      ['TOTAL PEMASUKAN', exportTotalIncome]
    ],
    { origin: -1 }
  );

  // Rekap per metode pembayaran per tanggal — hanya untuk mode Real-time
  // (Kas Masuk). Hanya baris dengan uang yang benar-benar masuk (jumlah > 0)
  // yang direkap.
  if (isCashBasis) {
    const recapMap = new Map();
    combinedIncome.forEach(item => {
      const jumlah = Number(item.jumlah) || 0;
      if (jumlah <= 0) return;
      const key = `${item.tanggal}||${item.metode_pembayaran || '-'}`;
      recapMap.set(key, (recapMap.get(key) || 0) + jumlah);
    });

    const recapRows = Array.from(recapMap.entries())
      .map(([key, total]) => {
        const [tanggal, metode] = key.split('||');
        return { tanggal, metode, total };
      })
      .sort((a, b) => {
        const [dayA, monthA, yearA] = a.tanggal.split('/');
        const [dayB, monthB, yearB] = b.tanggal.split('/');
        const dateA = new Date(yearA, monthA - 1, dayA);
        const dateB = new Date(yearB, monthB - 1, dayB);
        if (dateA - dateB !== 0) return dateA - dateB;
        return a.metode.localeCompare(b.metode);
      });

    XLSX.utils.sheet_add_aoa(
      incomeSheet,
      [
        [],
        ['REKAP PER METODE PEMBAYARAN PER TANGGAL'],
        ['Tanggal', 'Metode Pembayaran', 'Total'],
        ...recapRows.map(r => [r.tanggal, r.metode, r.total])
      ],
      { origin: -1 }
    );
  }

  // =========================
  // SHEET PENGELUARAN
  // =========================
  const expenseSheet = XLSX.utils.json_to_sheet(
  combinedExpenses.map(item => ({
    ...item,
    jumlah: `Rp ${new Intl.NumberFormat('id-ID').format(item.jumlah)}`
  }))
);

  XLSX.utils.sheet_add_aoa(
    expenseSheet,
    [
      [],
      ['TOTAL PENGELUARAN', totalExpenses]
    ],
    { origin: -1 }
  );

  // =========================
  // SHEET RINGKASAN
  // =========================
  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['LAPORAN AKUNTANSI'],
    [],
    ['Periode', `${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`],
    ['Format', isCashBasis ? 'Real-time (Kas Masuk)' : 'Standar (Akrual per Sesi)'],
    [],
    ['Total Pemasukan', exportTotalIncome],
    ['Total Pengeluaran', totalExpenses],
    ['Net Profit', exportNetProfit]
  ]);

  // =========================
  // APPEND
  // =========================
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Ringkasan');
  XLSX.utils.book_append_sheet(workbook, incomeSheet, 'Pemasukan');
  XLSX.utils.book_append_sheet(workbook, expenseSheet, 'Pengeluaran');

  // =========================
  // EXPORT
  // =========================
  const fileSuffix = isCashBasis ? 'realtime' : 'standar';
  XLSX.writeFile(
    workbook,
    `laporan_akuntansi_${fileSuffix}_${dateRange.startDate}_${dateRange.endDate}.xlsx`
  );
};
  const handleExportPDF = () => {
    generateAccountingReportPDF(data, {
      dateRange,
      clinicName,
      totals: {
        totalIncome,
        totalExpenses,
        netProfit,
        subTotalOwnerInc,
        subTotalAdminInc,
        subTotalPatientInc,
        subTotalOwnerExp,
        subTotalAdminExp,
      },
    });
  };

  if (loading) {
      return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-app-accent" /></div>;
  }

  const isIncome = activeSection === 'income';
  const chooseSection = (key) => { setActiveSection(key); setSource(null); };
  const toggleSource = (key) => setSource(prev => (prev === key ? null : key));

  const sources = isIncome
    ? [
        { key: 'owner', label: 'Owner', value: subTotalOwnerInc, color: '#0d9488' },
        { key: 'admin', label: 'Admin', value: subTotalAdminInc, color: '#2563eb' },
        { key: 'patient', label: 'Pasien', value: subTotalPatientInc, color: '#7c3aed' },
      ]
    : [
        { key: 'owner', label: 'Owner', value: subTotalOwnerExp, color: '#d97706' },
        { key: 'admin', label: 'Admin', value: subTotalAdminExp, color: '#e11d48' },
      ];

  const incomeRow = (row, idx) => ({
    id: row.id ?? idx,
    date: row.transaction_date || row.date,
    cat: row.category,
    sub: row.subcategory?.subcategory_name || row.sub_category,
    desc: row.description,
    bank: row.bank_accounts?.bank_name,
    amt: Number(row.amount) || 0,
  });
  const patientRow = (row, idx) => ({
    id: row.id ?? idx,
    date: row.date,
    cat: row.patient_type,
    sub: row.package_name,
    desc: row.patient_name,
    amt: Number(row.amount) || 0,
  });

  const kpis = [
    { key: 'in', label: 'Pemasukan', icon: TrendingUp, tone: 'pos', value: totalIncome },
    { key: 'out', label: 'Pengeluaran', icon: TrendingDown, tone: 'neg', value: totalExpenses },
    { key: 'net', label: 'Net Profit', icon: DollarSign, tone: netProfit >= 0 ? 'sky' : 'warn', value: netProfit },
  ];
  const margin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Periode + ekspor */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="px-3 py-1.5 rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
          {formatDate(dateRange.startDate)} – {formatDate(dateRange.endDate)}
        </span>
        <div className="flex gap-2 ml-auto">
          <Button onClick={handleExportPDF} variant="outline" className="h-9 px-3 text-xs rounded-[10px] border-slate-200 text-slate-600 hover:bg-slate-50">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            PDF
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9 px-3 text-xs rounded-[10px] border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Excel
                <ChevronDown className="w-3 h-3 ml-1.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="text-xs">Pilih Format Laporan</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExportExcel('accrual')} className="flex flex-col items-start gap-0.5 py-2">
                <span className="text-xs font-semibold">Standar (Akrual per Sesi)</span>
                <span className="text-xs text-slate-500">Nominal paket dibagi rata per sesi terapi</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportExcel('cash')} className="flex flex-col items-start gap-0.5 py-2">
                <span className="text-xs font-semibold">Real-time (Kas Masuk)</span>
                <span className="text-xs text-slate-500">Nominal hanya dicatat saat uang benar-benar diterima; sesi lanjutan tertulis 0</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {kpis.map(({ key, label, icon, tone, value }) => (
          <FinanceTile key={key} tone={tone} icon={icon} title={label} tinted>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className={cn('text-3xl font-black tabular-nums leading-none', value < 0 ? 'text-rose-600' : 'text-app-ink')}>{fmtShort(value)}</p>
                <p className="text-xs text-slate-500 mt-1.5 break-words">{fmtRp(value)}</p>
              </div>
              {key === 'net' && (
                <Ring pct={margin} color={netProfit >= 0 ? '#2563eb' : '#d97706'} className="w-[84px] shrink-0">
                  <b className="text-sm font-black tabular-nums text-app-ink">{fmtPct(margin)}</b>
                </Ring>
              )}
            </div>
          </FinanceTile>
        ))}
      </div>

      {/* Pemasukan / Pengeluaran */}
      <SegControl
        items={[{ value: 'income', label: 'Pemasukan', icon: TrendingUp }, { value: 'expense', label: 'Pengeluaran', icon: TrendingDown }]}
        value={activeSection}
        onChange={chooseSection}
      />

      {/* Bar sumber: ketuk untuk menyorot satu sumber */}
      <FinanceTile tone={isIncome ? 'pos' : 'neg'} title={isIncome ? 'Sumber pemasukan' : 'Sumber pengeluaran'}>
        <div className="flex h-[30px] gap-0.5 rounded-xl overflow-hidden bg-slate-100">
          {sources.map(sc => (
            <button
              key={sc.key}
              type="button"
              aria-label={sc.label}
              onClick={() => toggleSource(sc.key)}
              className="h-full transition-opacity duration-200"
              style={{ flexGrow: Math.max(sc.value, 1), flexBasis: 0, minWidth: 3, backgroundColor: sc.color, opacity: source && source !== sc.key ? 0.3 : 1 }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {sources.map(sc => (
            <button
              key={sc.key}
              type="button"
              onClick={() => toggleSource(sc.key)}
              aria-pressed={source === sc.key}
              className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors', source === sc.key ? 'bg-slate-100 border-slate-300' : 'border-slate-200 hover:bg-slate-50')}
            >
              <span className="w-2 h-2 rounded-[3px]" style={{ backgroundColor: sc.color }} />
              {sc.label} <b className="tabular-nums">{fmtShort(sc.value)}</b>
            </button>
          ))}
        </div>
      </FinanceTile>

      {isIncome ? (
        <>
          {(!source || source === 'owner') && (
            <TxSection tone="pos" icon={TrendingUp} title="Pemasukan Owner" kind="in" items={data.ownerIncome.map(incomeRow)} emptyText="Tidak ada data" />
          )}
          {(!source || source === 'admin') && (
            <TxSection tone="pos" icon={TrendingUp} title="Pemasukan Admin" kind="in" items={data.adminIncome.map(incomeRow)} emptyText="Tidak ada data" />
          )}
          {(!source || source === 'patient') && (
            <TxSection tone="pos" icon={TrendingUp} title="Pendapatan Pasien (Paket/Visit)" kind="in" items={data.patientIncome.map(patientRow)} emptyText="Tidak ada data" />
          )}
        </>
      ) : (
        <>
          {(!source || source === 'owner') && (
            <TxSection tone="neg" icon={TrendingDown} title="Pengeluaran Owner" kind="out" items={data.ownerExpenses.map(incomeRow)} emptyText="Tidak ada data" />
          )}
          {(!source || source === 'admin') && (
            <TxSection tone="neg" icon={TrendingDown} title="Pengeluaran Admin" kind="out" items={data.adminExpenses.map(incomeRow)} emptyText="Tidak ada data" />
          )}
        </>
      )}
    </div>
  );
};

export default AccountingReport;
