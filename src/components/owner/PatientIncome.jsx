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
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });

  const [loading, setLoading] = useState(true);
  const [incomeData, setIncomeData] = useState([]);
  const [summary, setSummary] = useState({ totalIncome: 0, totalPatients: 0, totalVisits: 0 });
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchIncomeData = async () => {
      if (!dateRange?.from || !dateRange?.to) return;

      setLoading(true);
      setError(null);
      console.log("🚀 Starting Fetch Income Data...", { from: dateRange.from, to: dateRange.to });

      try {
        // Format dates for Supabase (YYYY-MM-DD)
        const startDate = format(dateRange.from, 'yyyy-MM-dd');
        const endDate = format(dateRange.to, 'yyyy-MM-dd');

        // 1. Fetch Data with Relationships
        // We explicitly select patients and package_tracking to handle relations
        const { data: rawData, error: fetchError } = await supabase
          .from('daily_recaps')
          .select(`
            id,
            recap_date,
            amount,
            status,
            patient_id,
            package_tracking_id,
            patients!patient_id (
              full_name,
              medical_record_number
            ),
            package_tracking:package_tracking_id (
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
          if (record.amount > 0) {
            calculatedAmount = Number(record.amount);
            source = 'direct';
          } else if (record.package_tracking && record.package_tracking.nominal > 0) {
            // Avoid division by zero
            const totalSessions = record.package_tracking.total_sessions || 1;
            calculatedAmount = Number(record.package_tracking.nominal) / totalSessions;
            source = 'package_allocation';
          } else {
            // Fallback: use 0 if everything fails
            calculatedAmount = 0;
            source = 'none';
          }

          return {
            ...record,
            calculatedAmount,
            source,
            patientName: record.patients?.full_name || 'Unknown Patient',
            mrn: record.patients?.medical_record_number || '-'
          };
        });

        // 3. Group by Patient
        const patientMap = {};

        processedData.forEach(item => {
          const pId = item.patient_id;
          if (!patientMap[pId]) {
            patientMap[pId] = {
              patientId: pId,
              patientName: item.patientName,
              mrn: item.mrn,
              visitCount: 0,
              totalRevenue: 0,
              lastVisit: item.recap_date
            };
          }

          patientMap[pId].visitCount += 1;
          patientMap[pId].totalRevenue += item.calculatedAmount;
          
          // Keep track of most recent visit
          if (new Date(item.recap_date) > new Date(patientMap[pId].lastVisit)) {
            patientMap[pId].lastVisit = item.recap_date;
          }
        });

        const groupedList = Object.values(patientMap).sort((a, b) => b.totalRevenue - a.totalRevenue);

        console.log("📊 Processed Patient List:", groupedList);

        // 4. Calculate Summary
        const totalIncome = groupedList.reduce((sum, p) => sum + p.totalRevenue, 0);
        const totalVisits = groupedList.reduce((sum, p) => sum + p.visitCount, 0);

        setIncomeData(groupedList);
        setSummary({
          totalIncome,
          totalPatients: groupedList.length,
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
          <DateRangeFilter date={dateRange} setDate={setDateRange} />
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
                  <TableHead>Nama Pasien</TableHead>
                  <TableHead>No. RM</TableHead>
                  <TableHead className="text-right">Kunjungan</TableHead>
                  <TableHead className="text-right">Total Pendapatan</TableHead>
                  <TableHead className="text-right">Rata-rata / Visit</TableHead>
                  <TableHead className="text-right">Terakhir Berkunjung</TableHead>
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
                ) : incomeData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Tidak ada data pendapatan untuk periode ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  incomeData.map((patient) => (
                    <TableRow key={patient.patientId}>
                      <TableCell className="font-medium">{patient.patientName}</TableCell>
                      <TableCell>{patient.mrn}</TableCell>
                      <TableCell className="text-right">{patient.visitCount}</TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {formatCurrency(patient.totalRevenue)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(patient.totalRevenue / (patient.visitCount || 1))}
                      </TableCell>
                      <TableCell className="text-right">
                        {patient.lastVisit ? format(new Date(patient.lastVisit), 'dd MMM yyyy', { locale: id }) : '-'}
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