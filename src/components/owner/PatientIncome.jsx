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

const PatientIncome = () => {
  // Default to current month
  const [dateRange, setDateRange] = useState({
  startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
  endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd')
});

  const [loading, setLoading] = useState(true);
  const [incomeData, setIncomeData] = useState([]);
  const [summary, setSummary] = useState({ totalIncome: 0, totalPatients: 0, totalVisits: 0 });
  const [error, setError] = useState(null);

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

        // 1. Fetch Data with Relationships
        // We explicitly select patients and package_tracking to handle relations
        const { data: rawData, error: fetchError } = await supabase
          .from('daily_recaps')
          .select(`
  id,
recap_date,
amount,
amount_package,
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
          setSummary({ totalIncome: 0, totalPatients: 0, totalVisits: 0 });
          setLoading(false);
          return;
        }

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

          return {
  ...record,
  calculatedAmount,
  source,

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
    packagePrice: item.packagePrice,
    recapDate: item.recap_date,
    totalRevenue: item.calculatedAmount
  }))
  .sort((a, b) => new Date(b.recapDate) - new Date(a.recapDate));

        console.log("📊 Processed Patient List:", groupedList);

        // 4. Calculate Summary
        const totalIncome = groupedList.reduce((sum, p) => sum + p.totalRevenue, 0);
        const totalVisits = groupedList.length;

        setIncomeData(groupedList);
        setSummary({
          totalIncome,
          totalPatients: new Set(groupedList.map(item => item.patientId)).size,
          totalVisits
        });

      } catch (err) {
        console.error("❌ Error fetching patient income:", err);
        setError(err.message || "Gagal memuat data pendapatan pasien");
      } finally {
        setLoading(false);
      }
    };

    fetchIncomeData();
  }, [dateRange]);

  const handleDownload = () => {
    // Simple CSV export logic
    const headers = ["Nama Pasien", "No RM", "Jumlah Kunjungan", "Total Pendapatan (Est)", "Kunjungan Terakhir"];
    const rows = incomeData.map(p => [
      `"${p.patientName}"`,
      p.mrn,
      p.visitCount,
      Math.round(p.totalRevenue), // CSV usually better without currency formatting symbols
      p.lastVisit
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `laporan_pendapatan_pasien_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Laporan Pendapatan per Pasien</h2>
          <p className="text-muted-foreground">Analisis kontribusi pendapatan dari setiap pasien (Accrual Basis)</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter
  startDate={dateRange.startDate}
  endDate={dateRange.endDate}
  onDateChange={setDateRange}
/>
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
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
               <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(summary.totalIncome)}</div>
            )}
            <p className="text-xs text-muted-foreground">Estimasi revenue (termasuk alokasi paket)</p>
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
              <div className="text-2xl font-bold">{summary.totalPatients}</div>
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
              <div className="text-2xl font-bold">{summary.totalVisits}</div>
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
          <div className="rounded-md border">
            <Table>
              <TableHeader>
  <TableRow>
    <TableHead>Tanggal Daily Recap</TableHead>
    <TableHead>Nama Pasien</TableHead>
    <TableHead>Tipe Pasien</TableHead>
<TableHead className="text-right">Harga Paket</TableHead>
<TableHead className="text-right">Pendapatan</TableHead>
  </TableRow>
</TableHeader>

<TableBody>
  {loading ? (
    <TableRow>
      <TableCell colSpan={4} className="h-24 text-center">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Memuat data...</span>
        </div>
      </TableCell>
    </TableRow>
  ) : incomeData.length === 0 ? (
    <TableRow>
      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
        Tidak ada data pendapatan untuk periode ini.
      </TableCell>
    </TableRow>
  ) : (
    incomeData.map((item, index) => (
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