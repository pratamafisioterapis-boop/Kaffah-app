import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, TrendingUp, TrendingDown, DollarSign, FileText, Download, Calendar } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  getOwnerExpenditures, 
  getOwnerIncome, 
  getAdminExpenses, 
  getAdminIncome, 
  getPatientIncomeFromPackages 
} from '@/lib/api';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import 'jspdf-autotable';
import { useToast } from '@/components/ui/use-toast';

const ReportTable = ({ title, data, columns, total, type }) => {
    const isIncome = type === 'income';
    const accentColor = isIncome ? '#059669' : '#e11d48';
    const accentLight = isIncome ? '#f0fdf4' : '#fff1f2';
    const accentPill = isIncome ? '#dcfce7' : '#ffe4e6';
    const accentMid = isIncome ? '#bbf7d0' : '#fecdd3';
    const fmt = (n) => new Intl.NumberFormat('id-ID').format(n);

    return (
        <div className="overflow-hidden mb-3" style={{
            borderRadius: '14px',
            border: `1px solid ${accentMid}`,
            boxShadow: `0 1px 4px ${accentColor}10`
        }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3" style={{ background: accentLight }}>
                <div className="flex items-center gap-2.5">
                    <div className="w-1 h-5 rounded-full" style={{ background: accentColor }} />
                    <div>
                        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: accentColor }}>{title}</span>
                        <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-md" style={{ background: accentPill, color: accentColor }}>
                            {data.length} entri
                        </span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-medium" style={{ color: accentColor + 'aa' }}>Subtotal</div>
                    <div className="text-sm font-bold tabular-nums" style={{ color: accentColor }}>
                        Rp {fmt(total)}
                    </div>
                </div>
            </div>

            {/* Thead */}
            <div className="overflow-x-auto" style={{ borderTop: `1px solid ${accentMid}` }}>
                <table className="w-full text-left table-fixed" style={{ fontSize: '11px' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc' }}>
                            {columns.map((col, idx) => (
                                <th key={idx} className="px-4 py-2 whitespace-nowrap"
                                    style={{ color: '#94a3b8', fontWeight: 600, letterSpacing: '0.06em', fontSize: '10px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>
                                    {col.header}
                                </th>
                            ))}
                            <th className="px-4 py-2 text-right w-28 whitespace-nowrap"
                                style={{ color: '#94a3b8', fontWeight: 600, letterSpacing: '0.06em', fontSize: '10px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>
                                Jumlah
                            </th>
                        </tr>
                    </thead>
                </table>
                {/* Scrollable body */}
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    <table className="w-full text-left table-fixed" style={{ fontSize: '11px' }}>
                        <tbody>
                            {data.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length + 1} style={{ padding: '28px 16px', textAlign: 'center', color: '#cbd5e1' }}>
                                        <div style={{ fontSize: '13px' }}>Tidak ada data</div>
                                    </td>
                                </tr>
                            ) : (
                                data.map((item, idx) => (
                                    <tr key={idx}
                                        style={{ background: idx % 2 === 0 ? 'white' : accentLight + '80', transition: 'background 0.12s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = accentLight}
                                        onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'white' : accentLight + '80'}>
                                        {columns.map((col, cIdx) => (
                                            <td key={cIdx} className="px-4 truncate"
                                                style={{ padding: '9px 16px', color: '#475569', borderBottom: '1px solid #f1f5f9' }}>
                                                {col.render ? col.render(item) : item[col.accessor]}
                                            </td>
                                        ))}
                                        <td className="w-28 text-right tabular-nums"
                                            style={{ padding: '9px 16px', fontWeight: 700, color: accentColor, borderBottom: '1px solid #f1f5f9' }}>
                                            {fmt(item.amount)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const AccountingReport = ({
  dateRange,
  onDateRangeChange
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('income');
  

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
const handleExportExcel = () => {
  // =========================
  // GABUNG PEMASUKAN
  // =========================
  const combinedIncome = [
    ...data.ownerIncome.map(item => ({
      tanggal: formatDate(item.date),
      sumber: 'Pemasukan Owner',
      kategori: item.category || '-',
      deskripsi: item.description || '-',
      nama: '-',
      paket: '-',
      jumlah: Number(item.amount) || 0
    })),

    ...data.adminIncome.map(item => ({
      tanggal: formatDate(item.transaction_date || item.date),
      sumber: 'Pemasukan Admin',
      kategori: item.category || '-',
      deskripsi: item.description || '-',
      nama: '-',
      paket: '-',
      jumlah: Number(item.amount) || 0
    })),

    ...data.patientIncome.map(item => ({
      tanggal: formatDate(item.date),
      sumber: 'Pendapatan Pasien',
      kategori: '-',
      deskripsi: '-',
      nama: item.patient_name || '-',
      paket: item.package_name || '-',
      jumlah: Number(item.amount) || 0
    }))
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
      sumber: 'Pengeluaran Owner',
      kategori: item.category || '-',
      deskripsi: item.description || '-',
      jumlah: Number(item.amount) || 0
    })),

    ...data.adminExpenses.map(item => ({
      tanggal: formatDate(item.transaction_date || item.date),
      sumber: 'Pengeluaran Admin',
      kategori: item.category || '-',
      deskripsi: item.description || '-',
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
      ['TOTAL PEMASUKAN', totalIncome]
    ],
    { origin: -1 }
  );

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
    [],
    ['Total Pemasukan', totalIncome],
    ['Total Pengeluaran', totalExpenses],
    ['Net Profit', netProfit]
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
  XLSX.writeFile(
    workbook,
    `laporan_akuntansi_${dateRange.startDate}_${dateRange.endDate}.xlsx`
  );
};
  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.text("Laporan Akuntansi Lengkap", 14, 22);
    doc.setFontSize(11);
    doc.text(`Periode: ${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`, 14, 30);
    
    let finalY = 35;

    // Helper for sections
    const addSection = (title, tableData, columns, subtotal, theme = 'green') => {
        doc.setFontSize(12);
        doc.setTextColor(theme === 'green' ? 0 : 200, theme === 'green' ? 100 : 0, 0);
        doc.text(title, 14, finalY + 10);
        doc.setTextColor(0, 0, 0);

        doc.autoTable({
            startY: finalY + 15,
            head: [columns.map(c => c.header)],
            body: tableData.map(row => columns.map(c => {
                 if (c.id === 'amount') return new Intl.NumberFormat('id-ID').format(row.amount);
                 if (c.id === 'date') return formatDate(row[c.accessor]);
                 return row[c.accessor];
            })),
            theme: 'grid',
            headStyles: { fillColor: theme === 'green' ? [46, 139, 87] : [178, 34, 34] },
            styles: { fontSize: 8 },
        });

        finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(10);
        doc.text(`Subtotal: Rp ${new Intl.NumberFormat('id-ID').format(subtotal)}`, 140, finalY - 2, { align: 'right' });
    };

    // Income Sections
    addSection("Pemasukan Owner", data.ownerIncome, [
        { header: "Tanggal", accessor: "date", id: "date" },
        { header: "Kategori", accessor: "category" },
        { header: "Deskripsi", accessor: "description" },
        { header: "Jumlah", accessor: "amount", id: "amount" }
    ], subTotalOwnerInc, 'green');

    addSection("Pemasukan Admin", data.adminIncome, [
        { header: "Tanggal", accessor: "transaction_date", id: "date" },
        { header: "Kategori", accessor: "category" },
        { header: "Deskripsi", accessor: "description" },
        { header: "Jumlah", accessor: "amount", id: "amount" }
    ], subTotalAdminInc, 'green');

    addSection("Pendapatan Pasien (Paket/Visit)", data.patientIncome, [
        { header: "Tanggal", accessor: "date", id: "date" },
        { header: "Pasien", accessor: "patient_name" },
        { header: "Paket", accessor: "package_name" },
        { header: "Jumlah", accessor: "amount", id: "amount" }
    ], subTotalPatientInc, 'green');

    // Expense Sections
    doc.addPage();
    finalY = 20;

    addSection("Pengeluaran Owner", data.ownerExpenses, [
        { header: "Tanggal", accessor: "date", id: "date" },
        { header: "Kategori", accessor: "category" },
        { header: "Deskripsi", accessor: "description" },
        { header: "Jumlah", accessor: "amount", id: "amount" }
    ], subTotalOwnerExp, 'red');

    addSection("Pengeluaran Admin", data.adminExpenses, [
        { header: "Tanggal", accessor: "transaction_date", id: "date" },
        { header: "Kategori", accessor: "category" },
        { header: "Deskripsi", accessor: "description" },
        { header: "Jumlah", accessor: "amount", id: "amount" }
    ], subTotalAdminExp, 'red');

    // Summary
    doc.setDrawColor(200, 200, 200);
    doc.line(14, finalY + 5, 196, finalY + 5);
    
    doc.setFontSize(12);
    doc.text("Ringkasan Akhir", 14, finalY + 15);
    
    doc.setFontSize(10);
    doc.text(`Total Pemasukan: Rp ${new Intl.NumberFormat('id-ID').format(totalIncome)}`, 14, finalY + 25);
    doc.text(`Total Pengeluaran: Rp ${new Intl.NumberFormat('id-ID').format(totalExpenses)}`, 14, finalY + 32);
    
    doc.setFontSize(14);
    doc.setTextColor(netProfit >= 0 ? 46 : 220, netProfit >= 0 ? 139 : 20, netProfit >= 0 ? 87 : 60);
    doc.text(`Net Profit: Rp ${new Intl.NumberFormat('id-ID').format(netProfit)}`, 14, finalY + 45);

    doc.save(`laporan_akuntansi_${dateRange.startDate}_${dateRange.endDate}.pdf`);
  };

  if (loading) {
      return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#eef2ff' }}>
            <FileText className="w-4 h-4" style={{ color: '#4f46e5' }} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Laporan Akuntansi Lengkap</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Periode: {formatDate(dateRange.startDate)} s/d {formatDate(dateRange.endDate)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportPDF} variant="outline" className="h-8 px-3 text-xs border-slate-200 text-slate-600 hover:bg-slate-50">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            PDF
          </Button>
          <Button onClick={handleExportExcel} variant="outline" className="h-8 px-3 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Excel
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Pemasukan', value: totalIncome, icon: TrendingUp, bg: '#f0fdf4', iconBg: '#dcfce7', color: '#16a34a' },
          { label: 'Total Pengeluaran', value: totalExpenses, icon: TrendingDown, bg: '#fff1f2', iconBg: '#ffe4e6', color: '#e11d48' },
          { label: 'Net Profit', value: netProfit, icon: DollarSign,
            bg: netProfit >= 0 ? '#eff6ff' : '#fffbeb',
            iconBg: netProfit >= 0 ? '#dbeafe' : '#fef3c7',
            color: netProfit >= 0 ? '#2563eb' : '#d97706' },
        ].map(({ label, value, icon: Icon, bg, iconBg, color }) => (
          <div key={label} className="rounded-xl p-4 flex items-center gap-3" style={{ background: bg }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: iconBg }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate" style={{ color }}>{label}</p>
              <p className="text-lg font-bold leading-tight" style={{ color }}>
                Rp {new Intl.NumberFormat('id-ID').format(value)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 w-fit" style={{ background: '#f1f5f9', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        {[
          { key: 'income', label: 'Pemasukan', icon: TrendingUp, color: '#059669', activeBg: '#ecfdf5', activeBorder: '#bbf7d0' },
          { key: 'expense', label: 'Pengeluaran', icon: TrendingDown, color: '#e11d48', activeBg: '#fff1f2', activeBorder: '#fecdd3' },
        ].map(({ key, label, icon: Icon, color, activeBg, activeBorder }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold transition-all"
            style={{
              borderRadius: '9px',
              background: activeSection === key ? activeBg : 'transparent',
              color: activeSection === key ? color : '#94a3b8',
              border: activeSection === key ? `1px solid ${activeBorder}` : '1px solid transparent',
              boxShadow: activeSection === key ? `0 1px 4px ${color}18` : 'none',
              letterSpacing: '0.02em',
            }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Income Section */}
      {activeSection === 'income' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Pemasukan (Income)</span>
            <span className="ml-auto text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
              Total: Rp {new Intl.NumberFormat('id-ID').format(totalIncome)}
            </span>
          </div>
          <ReportTable
            title="Pemasukan Owner"
            data={data.ownerIncome}
            total={subTotalOwnerInc}
            type="income"
            columns={[
              { header: 'Tanggal', accessor: 'date', render: (row) => formatDate(row.date) },
              { header: 'Kategori', accessor: 'category' },
              { header: 'Sub Category', accessor: 'subcategory', render: (row) => row.subcategory?.subcategory_name || row.sub_category || '-' },
              { header: 'Deskripsi', accessor: 'description' }
            ]}
          />
          <ReportTable
            title="Pemasukan Admin"
            data={data.adminIncome}
            total={subTotalAdminInc}
            type="income"
            columns={[
              { header: 'Tanggal', accessor: 'date', render: (row) => formatDate(row.date) },
              { header: 'Kategori', accessor: 'category' },
              { header: 'Sub Category', accessor: 'subcategory', render: (row) => row.subcategory?.subcategory_name || row.sub_category || '-' },
              { header: 'Deskripsi', accessor: 'description' }
            ]}
          />
          <ReportTable
            title="Pendapatan Pasien (Paket/Visit)"
            data={data.patientIncome}
            total={subTotalPatientInc}
            type="income"
            columns={[
              { header: 'Tanggal', accessor: 'date', render: (row) => formatDate(row.date) },
              { header: 'Pasien', accessor: 'patient_name' },
              { header: 'Tipe Pasien', accessor: 'patient_type' },
              { header: 'Paket', accessor: 'package_name' }
            ]}
          />
        </div>
      )}

      {/* Expense Section */}
      {activeSection === 'expense' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <TrendingDown className="w-4 h-4 text-rose-500" />
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Pengeluaran (Expense)</span>
            <span className="ml-auto text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg">
              Total: Rp {new Intl.NumberFormat('id-ID').format(totalExpenses)}
            </span>
          </div>
          <ReportTable
            title="Pengeluaran Owner"
            data={data.ownerExpenses}
            total={subTotalOwnerExp}
            type="expense"
            columns={[
              { header: 'Tanggal', accessor: 'date', render: (row) => formatDate(row.date) },
              { header: 'Kategori', accessor: 'category' },
              { header: 'Sub Category', accessor: 'subcategory', render: (row) => row.subcategory?.subcategory_name || row.sub_category || '-' },
              { header: 'Deskripsi', accessor: 'description' }
            ]}
          />
          <ReportTable
            title="Pengeluaran Admin"
            data={data.adminExpenses}
            total={subTotalAdminExp}
            type="expense"
            columns={[
              { header: 'Tanggal', accessor: 'transaction_date', render: (row) => formatDate(row.transaction_date) },
              { header: 'Kategori', accessor: 'category' },
              { header: 'Sub Category', accessor: 'subcategory', render: (row) => row.subcategory?.subcategory_name || row.sub_category || '-' },
              { header: 'Deskripsi', accessor: 'description' }
            ]}
          />
        </div>
      )}
    </div>
  );
};

export default AccountingReport;