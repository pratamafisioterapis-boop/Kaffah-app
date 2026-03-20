import React, { useState, useEffect } from 'react';
import { getAvailableSlotsToday } from '@/lib/api';
import { supabase } from '@/lib/customSupabaseClient';
import { Clock, Loader2, AlertCircle, CheckCircle2, Zap, CalendarOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const AvailableSlotsWidget = ({ therapistId }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState([]);
  const [leaveStatus, setLeaveStatus] = useState(null);
  const [error, setError] = useState(null);

  const fetchSlots = async () => {
    if (!therapistId) {
        setLoading(false);
        return;
    }
    
    try {
      setLoading(true);
      const result = await getAvailableSlotsToday(therapistId);
      
      if (result.error) throw result.error;

      // Handle Leave
      if (result.leaveStatus) {
         setLeaveStatus(result.leaveStatus);
         setSlots([]); 
      } else {
         setLeaveStatus(null);
         setSlots(result.data || []);
      }
      
      setError(null);
    } catch (err) {
      console.error("Failed to fetch slots:", err);
      setError("Gagal memuat slot.");
      setSlots([]); 
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (therapistId) {
        fetchSlots();

        const aptSubscription = supabase
        .channel('public:appointments:widget')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `therapist_id=eq.${therapistId}` }, () => fetchSlots())
        .subscribe();
        
        const leaveSubscription = supabase
        .channel('public:time_off:widget')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'therapist_time_off', filter: `therapist_id=eq.${therapistId}` }, () => fetchSlots())
        .subscribe();

        return () => {
          supabase.removeChannel(aptSubscription);
          supabase.removeChannel(leaveSubscription);
        };
    }
  }, [therapistId]);

  if (!therapistId) return null;

  // Render Leave State
  if (leaveStatus?.isOnLeave) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl shadow-sm p-6 mb-6">
         <div className="flex items-center justify-between mb-4">
             <h2 className="text-xl font-bold text-amber-900 flex items-center gap-2">
                 <Clock className="w-5 h-5 text-amber-500" />
                 Status Operasional
             </h2>
             <div className="text-xs font-medium px-2 py-1 bg-amber-200 text-amber-800 rounded-full">
                 Cuti / Off
             </div>
         </div>
         
         <div className="bg-white/60 border border-amber-100 rounded-lg p-6 text-center space-y-3">
             <div className="mx-auto w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                 <CalendarOff className="w-6 h-6 text-amber-600" />
             </div>
             <div>
                <h3 className="text-lg font-semibold text-amber-800">Sedang Dalam Masa Cuti</h3>
                <p className="text-amber-700 text-sm mt-1">
                   Kembali aktif pada <span className="font-bold">{format(new Date(leaveStatus.details.end_date), 'd MMMM yyyy', { locale: id })}</span>.
                </p>
             </div>
         </div>
      </div>
    );
  }

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-emerald-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            Slot Tersedia
            <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1 ml-2">
               <Zap className="w-3 h-3 fill-emerald-800" /> Operasional
            </span>
          </h2>
        </div>
        <div className="text-xs font-medium px-2 py-1 bg-white/50 text-emerald-700 rounded-full border border-emerald-100">
          {loading ? 'Syncing...' : 'Live Data'}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading && slots.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </motion.div>
        ) : error ? (
           <div className="text-center py-6 text-red-500 bg-red-50 rounded-lg border border-red-100">
             <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-50" />
             <p>{error}</p>
           </div>
        ) : slots.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-8 text-emerald-600/70 bg-white/40 rounded-lg border border-dashed border-emerald-200">
            <div className="bg-emerald-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
               <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="font-bold text-emerald-800 text-lg">Hari ini sudah maksimal</p>
            <p className="text-sm text-emerald-600">Semua slot penuh. Kerja bagus! 👏</p>
          </motion.div>
        ) : (
          <div>
            <motion.div layout className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {slots.map((slot) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.03, y: -2 }}
                  transition={{ duration: 0.2 }}
                  key={slot.id}
                  onClick={() => navigate('/therapist/schedule-appointment', { state: { selectedSlot: slot.raw } })}
                  className="group cursor-pointer bg-white hover:bg-emerald-600 hover:text-white border border-emerald-100 hover:border-emerald-600 shadow-sm hover:shadow-md rounded-lg p-3 flex flex-col items-center justify-center transition-all"
                >
                  <span className="text-xl font-bold text-slate-700 group-hover:text-white transition-colors">
                    {slot.time}
                  </span>
                  <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-1 group-hover:bg-white/20 group-hover:text-emerald-50 transition-colors">
                    Kosong
                  </span>
                </motion.div>
              ))}
            </motion.div>
            <div className="mt-4 pt-3 border-t border-emerald-100 text-center">
               <p className="text-sm text-emerald-700 font-medium flex items-center justify-center gap-2">
                  ✨ Masih ada kesempatan bantu pasien hari ini
               </p>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AvailableSlotsWidget;