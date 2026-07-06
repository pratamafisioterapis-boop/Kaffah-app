import { supabase } from '@/lib/customSupabaseClient';
import { debounce } from '@/lib/utils';

/**
 * Service to handle synchronization between Appointments and Daily Recaps
 */

const AppointmentSyncService = {
  
  /**
   * Sync appointment changes with Daily Recaps
   * @param {Object} appointment - The new/updated appointment object
   * @param {Object} oldAppointment - The original appointment object before changes
   */
  syncAppointmentWithDailyRecaps: async (appointment, oldAppointment) => {
    if (!appointment || !appointment.id) return { success: false, message: "Invalid appointment data" };

    const status = (appointment.status || '').toLowerCase();
    const oldStatus = (oldAppointment?.status || '').toLowerCase();
    
    console.log(`[SyncService] Syncing Appt ${appointment.id}: ${oldStatus} -> ${status}`);

    try {
      // 1. Handle Cancellation
      if (status === 'cancelled') {
        // Find and delete related daily recaps linked by appointment_id
        const { error: deleteError } = await supabase
          .from('daily_recaps')
          .delete()
          .eq('appointment_id', appointment.id);
          
        if (deleteError) throw deleteError;
        return { success: true, message: "Appointment cancelled, related recaps removed." };
      }

      // 2. Handle Rescheduling (Task 7)
      // When appointment status changes to "Rescheduled" OR Date Changed significantly
      if (status === 'rescheduled' || (oldAppointment && appointment.appointment_date !== oldAppointment.appointment_date)) {
        
        // Find if a recap already exists for the OLD date
        // Note: Task 7 says "Find daily_recap with: patient_name = appointment.patient_name AND date = old_appointment_date"
        // But we have appointment_id linkage which is safer. We'll prioritize ID match.
        
        const { data: existingRecap } = await supabase
          .from('daily_recaps')
          .select('id, start_time')
          .eq('appointment_id', appointment.id)
          .maybeSingle();

        if (existingRecap) {
          const newDate = new Date(appointment.appointment_date);
          const dateStr = newDate.toISOString().split('T')[0];

          // Tanggal "hari ini" versi WITA, dipakai untuk cek apakah tanggal baru sudah lewat/hari ini
          const todayWITA = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit'
          }).format(new Date());

          if (dateStr > todayWITA && !existingRecap.start_time) {
            // Tanggal baru masih di masa depan & sesi belum pernah dimulai:
            // hapus recap-nya sekarang, biar generate_today_daily_recaps() yang bikin ulang
            // otomatis pas hari-H tiba (recap tidak boleh nongol sebelum waktunya).
            const { error: deleteError } = await supabase
              .from('daily_recaps')
              .delete()
              .eq('id', existingRecap.id);

            if (deleteError) throw deleteError;
            return { success: true, message: "Rescheduled ke masa depan: recap lama dihapus, akan dibuat otomatis pada hari-H." };
          }

          // Tanggal baru = hari ini (atau sudah lewat), atau sesi sudah pernah dimulai:
          // update seperti biasa
          const timeStr = newDate.toISOString();

          const { error: updateError } = await supabase
            .from('daily_recaps')
            .update({
              recap_date: dateStr,
              start_time: timeStr,
              end_time: null 
            })
            .eq('id', existingRecap.id);

          if (updateError) throw updateError;
          return { success: true, message: "Rescheduled: Daily recap updated to new date." };
        } 
        // If no recap exists (e.g. was virtual), nothing to delete/update. Virtual logic handles new date automatically.
      }

      return { success: true, message: "Sync complete." };

    } catch (error) {
      console.error("[SyncService] Error:", error);
      return { success: false, message: error.message };
    }
  },

  getAppointmentDailyRecaps: async (appointmentId) => {
    if (!appointmentId) return { data: [], error: "No ID provided" };
    return await supabase.from('daily_recaps').select('*').eq('appointment_id', appointmentId);
  },

  deleteOldDailyRecaps: async (patientId, date) => {
    return { success: true }; 
  }
};

export const debouncedSync = debounce(AppointmentSyncService.syncAppointmentWithDailyRecaps, 300);

export default AppointmentSyncService;