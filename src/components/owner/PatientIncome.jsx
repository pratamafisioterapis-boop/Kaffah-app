import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import { formatCurrency } from '@/lib/utils';
import { Download, Loader2, AlertCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { id } from 'date-fns/locale';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const PatientIncome = () => {
  // Default to current month
  const [dateRange, setDateRange] = useState({
  startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
  endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd')
});

  const [loading, setLoading] = useState(true);
  const [incomeData, setIncomeData] = useState([]);
  const [error, setError] = useState(null);
const [paymentFilter, setPaymentFilter] = useState('all');
  useEffect(() => {
    const fetchIncomeData = async () => {
      if (!dateRange?.startDate || !dateRange?.endDate) return;

      setLoading(true);
      setError(null);
     console.log("🚀 Starting Fetch Income Data...", { 
  startDate: dateRange.startDate, 
  endDate: dateRange.endDate 
});

      try {
        // Format dates for Supabase (YYYY-MM-DD)
       const startDate = dateRange.startDate;
const endDate = dateRange.endDate;
// Fetch payment methods
const { data: paymentMethods, error: paymentError } =
  await supabase
    .from('operational_options')
    .select('id, label')
    .eq('category', 'payment_method');

if (paymentError) throw paymentError;

const paymentMethodMap = {};

paymentMethods?.forEach(method => {
  paymentMethodMap[method.id] = method.label;
});

        // 1. Fetch Data with Relationships
        // We explicitly select patients and package_tracking to handle relations
        const { data: rawData, error: fetchError } = await supabase
          .from('daily_recaps')
          .select(`
  id,
recap_date,
amount,
amount_package,
payment_method,
patient_type,
status,
patient_id,
package_tracking_id,
            patients!patient_id (
              full_name,
              medical_record_number
            ),
            package_tracking:package_tracking_id (
            id,
              nominal,
              total_sessions
            )
          `)
          .gte('recap_date', startDate)
.lte('recap_date', endDate)
          .not('patient_id', 'is', null) // Filter out records without patients
          .order('recap_date', { ascending: false });

        if (fetchError) throw fetchError;

        console.log("📦 Raw Data Fetched:", rawData?.length, "records");

        if (!rawData || rawData.length === 0) {
  setIncomeData([]);
  setLoading(false);
  return;
}
// Mapping payment method package
const packagePaymentMap = {};

rawData.forEach(item => {
  const hasPayment =
  Number(item.amount || 0) > 0 ||
  Number(item.amount_package || 0) > 0;

  if (
    item.package_tracking_id &&
    hasPayment &&
    item.payment_method
  ) {
    packagePaymentMap[item.package_tracking_id] =
  paymentMethodMap[item.payment_method] ||
  item.payment_method ||
  '-';
  }
});
        // 2. Process & Calculate Revenue (Accrual Basis)
        const processedData = rawData.map(record => {
          let calculatedAmount = 0;
          let source = 'direct';

          // Logic: Prioritize direct amount. If 0, try to calculate from package.
          if (Number(record.amount_package) > 0) {
  calculatedAmount = Number(record.amount_package);
  source = 'package_amount';

} else if (Number(record.amount) > 0) {
  calculatedAmount = Number(record.amount);
  source = 'direct_amount';

} else {
  calculatedAmount = 0;
  source = 'none';
}
const paymentMethod =
  record.package_tracking_id
    ? packagePaymentMap[record.package_tracking_id] || '-'
    : paymentMethodMap[record.payment_method] ||
      record.payment_method ||
      '-';
          return {
  ...record,
  calculatedAmount,
  realAmount: Number(record.amount || 0),
  source,
  paymentMethod,

  patientName: record.patients?.full_name || 'Unknown Patient',

 patientType: record.patient_type || '-',

  packagePrice:
    record.package_tracking?.nominal || 0
};
        });

        // 3. Group by Patient
        const groupedList = processedData
  .map(item => ({
    patientId: item.patient_id,
    patientName: item.patientName,
    patientType: item.patientType,
    paymentMethod: item.paymentMethod,
    packagePrice: item.packagePrice,
    recapDate: item.recap_date,

    totalRevenue: item.calculatedAmount,

    realAmount: item.realAmount
  }))
  .sort((a, b) => new Date(b.recapDate) - new Date(a.recapDate));

        console.log("📊 Processed Patient List:", groupedList);

        // 4. Calculate Summary
        setIncomeData(groupedList);

      } catch (err) {
        console.error("❌ Error fetching patient income:", err);
        setError(err.message || "Gagal memuat data pendapatan pasien");
      } finally {
        setLoading(false);
      }
    };

    fetchIncomeData();
  }, [dateRange]);
const paymentMethodOptions = [
  'all',
  ...new Set(
    incomeData
      .map(item => item.paymentMethod)
      .filter(Boolean)
  )
];

const filteredIncomeData =
  paymentFilter === 'all'
    ? incomeData
    : incomeData.filter(
        item => item.paymentMethod === paymentFilter
      );
      const filteredSummary = {
  totalIncome: filteredIncomeData.reduce(
    (sum, item) => sum + item.totalRevenue,
    0
  ),

  totalPatients: new Set(
    filteredIncomeData.map(item => item.patientId)
  ).size,

  totalVisits: filteredIncomeData.length
};
const realIncome = filteredIncomeData.reduce(
  (sum, item) => sum + Number(item.realAmount || 0),
  0
);
  const handleDownload = () => {
  const exportData = incomeData.map((item) => ({
    "Tanggal Daily Recap": item.recapDate
      ? format(new Date(item.recapDate), 'dd MMM yyyy', { locale: id })
      : '-',

    "Nama Pasien": item.patientName,

    "Tipe Pasien": item.patientType || '-',
    "Payment Method": item.paymentMethod || '-',

    "Harga Paket":
      item.packagePrice > 0
        ? item.packagePrice
        : 0,

    "Pendapatan":
      item.totalRevenue || 0
  }));

  // Buat worksheet
  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Auto width column
  const columnWidths = [
    { wch: 20 },
    { wch: 30 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 }
  ];

  worksheet['!cols'] = columnWidths;

  // Workbook
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    'Income Report'
  );

  // Generate excel buffer
  const excelBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array'
  });

  // Save file
  const fileData = new Blob(
    [excelBuffer],
    {
      type:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
    }
  );

  saveAs(
    fileData,
    `laporan_pendapatan_pasien_${format(new Date(), 'yyyy-MM-dd')}.xlsx`
  );
};

  return (
    <div className="space-y-6">
      {/* Header & Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Laporan Pendapatan per Pasien</h2>
          <p className="text-muted-foreground">Analisis kontribusi pendapatan dari setiap pasien (Accrual Basis)</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeFilter
  startDate={dateRange.startDate}
  endDate={dateRange.endDate}
  onDateChange={setDateRange}
/>
          <div className="flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm">
  <div className="flex flex-col">
    <span className="text-xs text-muted-foreground">
      Payment Method
    </span>

    <select
      value={paymentFilter}
      onChange={(e) => setPaymentFilter(e.target.value)}
      className="h-10 min-w-[140px] bg-transparent text-sm outline-none"
    >
      {paymentMethodOptions.map(method => (
        <option key={method} value={method}>
          {method === 'all'
            ? 'Semua Payment'
            : method}
        </option>
      ))}
    </select>
  </div>
</div>
  


<Button variant="outline" size="icon" onClick={handleDownload} disabled={loading || incomeData.length === 0}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
               <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(filteredSummary.totalIncome)}</div>
            )}
            <p className="text-xs text-muted-foreground">Estimasi revenue (termasuk alokasi paket)</p>
          </CardContent>
        </Card>
        <Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className="text-sm font-medium">
      Pendapatan Real
    </CardTitle>
  </CardHeader>

  <CardContent>
    {loading ? (
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    ) : (
      <div className="text-2xl font-bold text-emerald-600">
        {formatCurrency(realIncome)}
      </div>
    )}

    <p className="text-xs text-muted-foreground">
      Hanya amount langsung dari daily recaps
    </p>
  </CardContent>
</Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pasien Aktif</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
               <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-2xl font-bold">{filteredSummary.totalPatients}</div>
            )}
            <p className="text-xs text-muted-foreground">Pasien dengan kunjungan di periode ini</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Kunjungan</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
               <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-2xl font-bold">{filteredSummary.totalVisits}</div>
            )}
            <p className="text-xs text-muted-foreground">Jumlah sesi terapi selesai</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Rincian Pasien</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Memuat data...</span>
              </div>
            ) : filteredIncomeData.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">Tidak ada data pendapatan untuk periode ini.</div>
            ) : (
              filteredIncomeData.map((item, index) => (
                <div key={`${item.patientId}-${index}`} className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {item.recapDate ? format(new Date(item.recapDate), 'dd MMM yyyy', { locale: id }) : '-'}
                    </span>
                    <span className="font-bold text-green-600 shrink-0 whitespace-nowrap">{formatCurrency(item.totalRevenue)}</span>
                  </div>
                  <p className="font-medium truncate">{item.patientName}</p>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className={`px-2 py-1 rounded font-medium ${item.patientType === 'Paket' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                      {item.patientType}
                    </span>
                    <span className="text-slate-500 truncate">{item.paymentMethod || '-'}</span>
                  </div>
                  {item.packagePrice > 0 && (
                    <p className="text-xs text-blue-600 font-medium">Harga Paket: {formatCurrency(item.packagePrice)}</p>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="hidden sm:block rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
  <TableRow>
    <TableHead>Tanggal Daily Recap</TableHead>
    <TableHead>Nama Pasien</TableHead>
    <TableHead>Tipe Pasien</TableHead>
    <TableHead>Payment Method</TableHead>
<TableHead className="text-right">Harga Paket</TableHead>
<TableHead className="text-right">Pendapatan</TableHead>
  </TableRow>
</TableHeader>

<TableBody>
  {loading ? (
    <TableRow>
      <TableCell colSpan={6} className="h-24 text-center">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Memuat data...</span>
        </div>
      </TableCell>
    </TableRow>
  ) : filteredIncomeData.length === 0 ? (
    <TableRow>
      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
        Tidak ada data pendapatan untuk periode ini.
      </TableCell>
    </TableRow>
  ) : (
    filteredIncomeData.map((item, index) => (
      <TableRow key={`${item.patientId}-${index}`}>
        <TableCell className="font-medium">
          {item.recapDate
            ? format(new Date(item.recapDate), 'dd MMM yyyy', { locale: id })
            : '-'}
        </TableCell>

        <TableCell className="font-medium">
          {item.patientName}
        </TableCell>

        <TableCell>
  <span
    className={`px-2 py-1 rounded text-xs font-medium ${
      item.patientType === 'Paket'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-slate-100 text-slate-500'
    }`}
  >
    {item.patientType}
  </span>
</TableCell>
<TableCell>
  <span className="font-medium text-slate-700">
    {item.paymentMethod || '-'}
  </span>
</TableCell>

<TableCell className="text-right font-medium text-blue-600">
  {item.packagePrice > 0
    ? formatCurrency(item.packagePrice)
    : '-'}
</TableCell>

        <TableCell className="text-right font-bold text-green-600">
          {formatCurrency(item.totalRevenue)}
        </TableCell>
      </TableRow>
    ))
  )}
</TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PatientIncome;