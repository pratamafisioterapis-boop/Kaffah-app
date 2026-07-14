import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, XCircle, Clock, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { startOfDay, endOfDay } from 'date-fns';

const OverviewCard = ({ title, value, icon: Icon, colorClass, loading }) => (
  <Card className="shadow-sm hover:shadow-md transition-all duration-200 border-slate-200">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-slate-600">
        {title}
      </CardTitle>
      <div className={`p-2 rounded-full ${colorClass}`}>
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

const TodaysOverviewWidget = () => {
  const [metrics, setMetrics] = useState({
    totalAppointments: 0,
    cancelled: 0,
    emptySlots: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTodayData = async () => {
    setLoading(true);
    setError(null);
    
    const todayStart = startOfDay(new Date()).toISOString();
    const todayEnd = endOfDay(new Date()).toISOString();

    try {
      // 1. Total Appointments Today
      const { count: appointmentCount, error: appError } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .gte('appointment_date', todayStart)
        .lte('appointment_date', todayEnd);

      if (appError) throw appError;

      // 2. Cancelled Appointments Today
      // Note: Querying 'appointments' table as 'daily_recaps' typically records completed sessions 
      // and does not have a status column in the schema provided.
      const { count: cancelledCount, error: cancelError } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .gte('appointment_date', todayStart)
        .lte('appointment_date', todayEnd)
        .ilike('status', '%cancelled%');

      if (cancelError) throw cancelError;

      // 3. Total Slot Kosong (Empty Slots) Hari Ini - Menggunakan Function Database
const { data: sessionData } = await supabase.auth.getSession();
const currentUserId = sessionData?.session?.user?.id;
const { data: currentUserRow } = await supabase.from('users').select('clinic_id').eq('id', currentUserId).single();

const { data: slotData, error: slotError } = await supabase
  .rpc('get_available_slots_with_status_by_date', {
    p_date: new Date().toISOString().split('T')[0],
    p_clinic_id: currentUserRow?.clinic_id
  });

if (slotError) throw slotError;

// Hitung hanya status 'aktif'
const emptySlotsCount = slotData?.filter(slot => slot.status === 'aktif').length || 0;

      setMetrics({
        totalAppointments: appointmentCount || 0,
        cancelled: cancelledCount || 0,
        emptySlots: emptySlotsCount
      });

    } catch (err) {
      console.error("Error fetching today's overview:", err);
      setError("Failed to load today's data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayData();
  }, []);

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
            onClick={fetchTodayData}
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
    <div className="grid gap-4 md:grid-cols-3 mb-8">
      <OverviewCard 
        title="Total Appointment" 
        value={metrics.totalAppointments} 
        icon={Calendar} 
        colorClass="bg-blue-600" 
        loading={loading} 
      />
      <OverviewCard 
        title="Cancelled" 
        value={metrics.cancelled} 
        icon={XCircle} 
        colorClass="bg-red-500" 
        loading={loading} 
      />
      <OverviewCard 
        title="Total Slot Kosong" 
        value={metrics.emptySlots} 
        icon={Clock} 
        colorClass="bg-amber-500" 
        loading={loading} 
      />
    </div>
  );
};

export default TodaysOverviewWidget;