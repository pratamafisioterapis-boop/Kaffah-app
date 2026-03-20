import React, { useState, useEffect } from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Loader2, Calendar, Clock, User, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { getTherapistRecaps, getTherapistTimeOff, getAppointments } from '@/lib/api';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const TherapistSchedule = ({ therapist }) => {
  const [items, setItems] = useState([]);
  const [timeOff, setTimeOff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    if (therapist?.id) {
      fetchSchedule();
    }
  }, [therapist, selectedDate]);

  const fetchSchedule = async () => {
    setLoading(true);
    // Use ISO string for date
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    // 1. Fetch Daily Recaps (Completed items typically)
    // Updated to use therapist.id UUID
    const { data: recapData } = await getTherapistRecaps(therapist.id, {
      startDate: dateStr,
      endDate: dateStr
    });

    // 2. Fetch Appointments (Scheduled/Pending/Confirmed)
    // Filtered by therapist ID and date
    // Use ISO strings for ranges
    const { data: appointmentData } = await getAppointments({
        startDate: `${dateStr}T00:00:00`,
        endDate: `${dateStr}T23:59:59`,
        therapistId: therapist.id
    });

    // 3. Fetch Time Off
    const { data: offData } = await getTherapistTimeOff(therapist.id);
    setTimeOff(offData || []);

    // 4. Merge Data
    // We want to display all unique interactions.
    // Filter out cancelled appointments to keep it clean
    const recaps = (recapData || []).map(r => ({ ...r, type: 'recap', displayTime: r.start_time }));
    const appointments = (appointmentData || [])
        .filter(a => a.status !== 'cancelled')
        .map(a => ({ ...a, type: 'appointment', displayTime: a.appointment_date }));

    // Combined list - inherent filtering: only shows patients attached to THESE records
    const combined = [...recaps, ...appointments];
    
    // Sort by time
    combined.sort((a, b) => {
        const timeA = new Date(a.displayTime).getTime();
        const timeB = new Date(b.displayTime).getTime();
        return timeA - timeB;
    });

    setItems(combined);
    setLoading(false);
  };

  const isDayOff = timeOff.some(off => {
    const start = new Date(off.start_date);
    const end = new Date(off.end_date);
    // Normalize time to compare dates only
    start.setHours(0,0,0,0);
    end.setHours(23,59,59,999);
    const check = new Date(selectedDate);
    check.setHours(12,0,0,0);
    
    return check >= start && check <= end;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Jadwal Saya</h2>
          <p className="text-slate-500">
            {format(selectedDate, 'EEEE, dd MMMM yyyy', { locale: idLocale })}
          </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg overflow-x-auto max-w-full">
          {[-1, 0, 1, 2, 3].map(offset => {
             const date = addDays(new Date(), offset);
             const isSelected = isSameDay(date, selectedDate);
             return (
               <button
                 key={offset}
                 onClick={() => setSelectedDate(date)}
                 className={`px-3 py-2 rounded-md text-sm transition-all whitespace-nowrap ${
                    isSelected ? 'bg-white shadow text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                 }`}
               >
                 <div className="text-xs uppercase">{format(date, 'EEE', { locale: idLocale })}</div>
                 <div className="text-lg">{format(date, 'd')}</div>
               </button>
             );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-600" /></div>
      ) : isDayOff ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
           <Calendar className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
           <h3 className="text-xl font-semibold text-yellow-800">Hari Libur / Cuti</h3>
           <p className="text-yellow-600">Anda sedang tidak memiliki jadwal praktik hari ini.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
           <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
           <h3 className="text-lg font-medium text-slate-600">Tidak ada jadwal</h3>
           <p className="text-slate-400">Belum ada pasien yang terdaftar untuk hari ini.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((item, idx) => (
            <Card key={`${item.type}-${item.id}-${idx}`} className={`hover:shadow-md transition-shadow border-l-4 ${item.type === 'recap' ? 'border-l-emerald-500' : 'border-l-blue-500'}`}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                   <div className={`px-3 py-2 rounded-lg font-mono font-bold text-lg min-w-[80px] text-center ${item.type === 'recap' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                      {item.displayTime ? format(new Date(item.displayTime), 'HH:mm') : '--:--'}
                   </div>
                   <div>
                      <h4 className="font-bold text-slate-800">
                          {item.patient?.full_name || item.guest_name || 'Pasien Baru'}
                      </h4>
                      <p className="text-sm text-slate-500 flex items-center gap-2">
                        <User className="w-3 h-3" /> 
                        {/* Removed RM Number reference as requested */}
                        Pasien Terdaftar 
                        {item.type === 'recap' && <span className="text-xs bg-emerald-100 text-emerald-800 px-1 rounded ml-1">Selesai</span>}
                      </p>
                   </div>
                </div>
                <div className="text-right flex items-center gap-3 justify-end">
                   <div className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                      {item.patient_type || (item.patient ? 'Terdaftar' : 'Pasien Baru')}
                   </div>
                   {item.type === 'appointment' && (
                       <div className={`text-xs px-2 py-1 rounded-full ${item.status === 'confirmed' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                           {item.status}
                       </div>
                   )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TherapistSchedule;