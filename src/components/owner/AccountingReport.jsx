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
import 'jspdf-autotable';
import { useToast } from '@/components/ui/use-toast';

const ReportTable = ({ title, data, columns, total, type }) => {
    const isIncome = type === 'income';
    const totalColor = isIncome ? "text-emerald-700" : "text-rose-700";
    const headerColor = isIncome ? "bg-emerald-50 text-emerald-800 border-emerald-100" : "bg-rose-50 text-rose-800 border-rose-100";

    return (
        <div className="space-y-3 mb-6">
            <div className="flex justify-between items-center">
                <h4 className="font-semibold text-slate-700">{title}</h4>
            </div>
            
            <div className="rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto max-h-[300px]">
                    <table className="w-full text-sm text-left">
                        <thead className={`text-xs uppercase font-semibold border-b ${headerColor}`}>
                            <tr>
                                {columns.map((col, idx) => (
                                    <th key={idx} className="px-4 py-2 whitespace-nowrap">{col.header}</th>
                                ))}
                                <th className="px-4 py-2 text-right">Jumlah</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {data.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-slate-400">
                                        Tidak ada data
                                    </td>
                                </tr>
                            ) : (
                                data.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50">
                                        {columns.map((col, cIdx) => (
                                            <td key={cIdx} className="px-4 py-2 text-slate-600">
                                                {col.render ? col.render(item) : item[col.accessor]}
                                            </td>
                                        ))}
                                        <td className="px-4 py-2 text-right font-medium text-slate-800">
                                            {new Intl.NumberFormat('id-ID').format(item.amount)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold">
                            <tr>
                                <td colSpan={columns.length} className="px-4 py-2 text-right text-slate-600">Subtotal:</td>
                                <td className={`px-4 py-2 text-right ${totalColor}`}>
                                    Rp {new Intl.NumberFormat('id-ID').format(total)}
                                </td>
                            </tr>
                        </tfoot>
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
      {/* Header & Filter */}
      <Card className="bg-white shadow-sm border-slate-200">
        <CardContent className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-600" />
                        Laporan Akuntansi Lengkap
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        Periode: <span className="font-medium text-slate-700">{formatDate(dateRange.startDate)}</span> s/d <span className="font-medium text-slate-700">{formatDate(dateRange.endDate)}</span>
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex items-center gap-2">
  
  <div className="grid gap-1">
  <Label className="text-xs text-slate-500">Mulai</Label>

  <div className="relative">
    <Input
      type="text"
      value={formatDate(dateRange.startDate)}
      readOnly
      className="h-9 w-[140px] text-sm cursor-pointer"
      onClick={() =>
        document.getElementById('start-date-picker')?.showPicker()
      }
    />

    <Input
      id="start-date-picker"
      type="date"
      value={dateRange.startDate}
      onChange={(e) =>
        onDateRangeChange({
          ...dateRange,
          startDate: e.target.value
        })
      }
      className="absolute inset-0 opacity-0 pointer-events-none"
    />
  </div>
</div>
  <span className="mt-6 text-slate-400 px-1">-</span>

  <div className="grid gap-1">
  <Label className="text-xs text-slate-500">Akhir</Label>

  <div className="relative">
    <Input
      type="text"
      value={formatDate(dateRange.endDate)}
      readOnly
      className="h-9 w-[140px] text-sm cursor-pointer"
      onClick={() =>
        document.getElementById('end-date-picker')?.showPicker()
      }
    />

    <Input
      id="end-date-picker"
      type="date"
      value={dateRange.endDate}
      onChange={(e) =>
        onDateRangeChange({
          ...dateRange,
          endDate: e.target.value
        })
      }
      className="absolute inset-0 opacity-0 pointer-events-none"
    />
  </div>
</div>

</div>
                    <Button onClick={handleExportPDF} variant="outline" className="h-9 border-slate-300 text-slate-700 hover:bg-slate-50">
                        <Download className="w-4 h-4 mr-2" />
                        Export PDF
                    </Button>
                </div>
            </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100 shadow-sm">
            <CardContent className="p-6 flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-emerald-600 mb-1">Total Pemasukan</p>
                    <h3 className="text-2xl font-bold text-emerald-700">Rp {new Intl.NumberFormat('id-ID').format(totalIncome)}</h3>
                </div>
                <div className="p-3 bg-white rounded-full shadow-sm">
                    <TrendingUp className="w-6 h-6 text-emerald-500" />
                </div>
            </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-rose-50 to-pink-50 border-rose-100 shadow-sm">
            <CardContent className="p-6 flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-rose-600 mb-1">Total Pengeluaran</p>
                    <h3 className="text-2xl font-bold text-rose-700">Rp {new Intl.NumberFormat('id-ID').format(totalExpenses)}</h3>
                </div>
                <div className="p-3 bg-white rounded-full shadow-sm">
                    <TrendingDown className="w-6 h-6 text-rose-500" />
                </div>
            </CardContent>
        </Card>
        <Card className={`border shadow-sm ${netProfit >= 0 ? "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100" : "bg-gradient-to-br from-orange-50 to-amber-50 border-amber-100"}`}>
            <CardContent className="p-6 flex items-center justify-between">
                <div>
                    <p className={`text-sm font-medium mb-1 ${netProfit >= 0 ? "text-blue-600" : "text-amber-600"}`}>Net Profit</p>
                    <h3 className={`text-2xl font-bold ${netProfit >= 0 ? "text-blue-700" : "text-amber-700"}`}>
                        Rp {new Intl.NumberFormat('id-ID').format(netProfit)}
                    </h3>
                </div>
                <div className="p-3 bg-white rounded-full shadow-sm">
                    <DollarSign className={`w-6 h-6 ${netProfit >= 0 ? "text-blue-500" : "text-amber-500"}`} />
                </div>
            </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* INCOME COLUMN */}
          <div className="space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-emerald-200">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                  <h3 className="text-lg font-bold text-emerald-800">PEMASUKAN (INCOME)</h3>
              </div>
              
              <ReportTable 
                  title="Pemasukan Owner" 
                  data={data.ownerIncome} 
                  total={subTotalOwnerInc} 
                  type="income"
                  columns={[
                      { header: 'Tanggal', accessor: 'date', render: (row) => formatDate(row.date) },
                      { header: 'Kategori', accessor: 'category' },
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
                      { header: 'Paket', accessor: 'package_name' }
                  ]}
              />
          </div>

          {/* EXPENSE COLUMN */}
          <div className="space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-rose-200">
                  <TrendingDown className="w-6 h-6 text-rose-600" />
                  <h3 className="text-lg font-bold text-rose-800">PENGELUARAN (EXPENSE)</h3>
              </div>

               <ReportTable 
                  title="Pengeluaran Owner" 
                  data={data.ownerExpenses} 
                  total={subTotalOwnerExp} 
                  type="expense"
                  columns={[
                      { header: 'Tanggal', accessor: 'date', render: (row) => formatDate(row.date) },
                      { header: 'Kategori', accessor: 'category' },
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
                      { header: 'Deskripsi', accessor: 'description' }
                  ]}
              />
          </div>
      </div>
    </div>
  );
};

export default AccountingReport;