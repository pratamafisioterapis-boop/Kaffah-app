import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Package, Users, Gift, RefreshCcw, Stethoscope } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';

const MetricCard = ({ title, value, icon: Icon, colorClass, loading }) => (
  <Card className="shadow-sm hover:shadow-md transition-all duration-200 border-slate-200">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-slate-600">
        {title}
      </CardTitle>
      <div className={cn("p-2 rounded-full", colorClass)}>
        <Icon className="h-4 w-4 text-white" />
      </div>
    </CardHeader>
    <CardContent>
      {loading ? (
        <div className="h-8 w-24 bg-slate-100 animate-pulse rounded" />
      ) : (
        <div className="text-2xl font-bold text-slate-900 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {value.toLocaleString('id-ID')}
        </div>
      )}
    </CardContent>
  </Card>
);

const AdminDashboardMetrics = ({ dateRange }) => {
  const [metrics, setMetrics] = useState({
    totalSesi: 0,
    totalPaket: 0,
    totalNonPaket: 0,
    totalPasien: 0,
    totalFree: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    if (!dateRange?.startDate || !dateRange?.endDate) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Fetch Daily Recaps
      const { data: recaps, error: recapsError } = await supabase
        .from('daily_recaps')
        .select('id, patient_id, package_type, amount, patient_type')
        .gte('recap_date', dateRange.startDate)
        .lte('recap_date', dateRange.endDate);

      if (recapsError) throw recapsError;

      // 2. Fetch Operational Options (Package Definitions)
      // We need this to determine if a package_type is a multi-session package or single session
      const { data: options, error: optionsError } = await supabase
        .from('operational_options')
        .select('label, session_count')
        .in('category', ['tipe_paket', 'package_type']);

      if (optionsError) throw optionsError;

      // 3. Calculate Metrics
      
      // Helper: Normalize label for comparison
      const normalize = (str) => str ? str.toLowerCase().trim() : '';

      // Create lookup map for session counts: normalized label -> session_count
      const packageSessionMap = {};
      options?.forEach(opt => {
        if (opt.label) {
          packageSessionMap[normalize(opt.label)] = opt.session_count || 1;
        }
      });

      let totalPaketCount = 0;
      let totalNonPaketCount = 0;
      let totalFreeCount = 0;
      const uniquePatientIds = new Set();

      recaps.forEach(recap => {
        // Total Pasien (Distinct)
        if (recap.patient_id) {
          uniquePatientIds.add(recap.patient_id);
        }

        // Total Free
        if (recap.patient_type && normalize(recap.patient_type).includes('free')) {
          totalFreeCount++;
        }

        // Logic for Paket vs Non Paket based on sales (amount > 0)
        // Note: Total Sesi counts ALL recaps, regardless of amount
        const amount = Number(recap.amount) || 0;
        
        if (amount > 0 && recap.package_type) {
          const type = normalize(recap.package_type);
          
          // Check if exists in operational_options map (as per requirement)
          if (Object.prototype.hasOwnProperty.call(packageSessionMap, type)) {
            const sessionCount = packageSessionMap[type];
            // If session_count > 1, it's a "Paket" purchase
            if (sessionCount > 1) {
              totalPaketCount++;
            } else {
              // If session_count <= 1 (or default 1), it's a "Non Paket" (Single Session) purchase
              totalNonPaketCount++; 
            }
          }
        }
      });

      setMetrics({
        totalSesi: recaps.length,
        totalPaket: totalPaketCount,
        totalNonPaket: totalNonPaketCount,
        totalPasien: uniquePatientIds.size,
        totalFree: totalFreeCount
      });

    } catch (err) {
      console.error("Error fetching dashboard metrics:", err);
      setError("Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  if (error) {
    return (
      <Card className="bg-red-50 border-red-200 mb-6">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2 text-red-700">
            <span className="text-sm font-medium">{error}</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchData}
            className="border-red-200 hover:bg-red-100 text-red-700 h-8"
          >
            <RefreshCcw className="h-3 w-3 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5 mb-6">
      <MetricCard 
        title="Total Sesi" 
        value={metrics.totalSesi} 
        icon={Activity} 
        colorClass="bg-blue-500" 
        loading={loading} 
      />
      <MetricCard 
        title="Total Paket" 
        value={metrics.totalPaket} 
        icon={Package} 
        colorClass="bg-emerald-500" 
        loading={loading} 
      />
      <MetricCard 
        title="Total Non Paket" 
        value={metrics.totalNonPaket} 
        icon={Stethoscope} 
        colorClass="bg-amber-500" 
        loading={loading} 
      />
      <MetricCard 
        title="Total Pasien" 
        value={metrics.totalPasien} 
        icon={Users} 
        colorClass="bg-violet-500" 
        loading={loading} 
      />
      <MetricCard 
        title="Total Free" 
        value={metrics.totalFree} 
        icon={Gift} 
        colorClass="bg-slate-500" 
        loading={loading} 
      />
    </div>
  );
};

export default AdminDashboardMetrics;