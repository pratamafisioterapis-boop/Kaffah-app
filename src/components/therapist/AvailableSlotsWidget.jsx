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

  return null;
};

export default AvailableSlotsWidget;