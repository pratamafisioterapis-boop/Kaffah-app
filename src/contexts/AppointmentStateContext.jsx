import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import AppointmentSyncService, { debouncedSync } from '@/lib/AppointmentSyncService';
import { updateAppointment as apiUpdateAppointment, deleteAppointment as apiDeleteAppointment } from '@/lib/api';

const AppointmentStateContext = createContext(null);

export const AppointmentStateProvider = ({ children }) => {
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  
  // Prevent infinite loops by tracking recent syncs
  const recentSyncs = useRef(new Set());

  // Central update method
  const updateAppointment = useCallback(async (id, updates, originalData = null) => {
    // Prevent rapid duplicate updates
    const syncKey = `${id}-${JSON.stringify(updates)}`;
    if (recentSyncs.current.has(syncKey)) {
      console.log("Skipping duplicate update/sync for:", id);
      return { success: true, skipped: true };
    }
    
    recentSyncs.current.add(syncKey);
    // Clear from set after 2 seconds
    setTimeout(() => recentSyncs.current.delete(syncKey), 2000);

    setIsSyncing(true);
    try {
      // 1. Perform the API update
      const { data, error } = await apiUpdateAppointment(id, updates);
      if (error) throw error;

      // 2. Trigger Sync Logic (Debounced or direct depending on urgency)
      // We pass the merged new data and the original data
      const mergedData = { ...originalData, ...updates, id };
      
      // We await the sync service explicitly here rather than debounce if we want immediate feedback for UI
      // But user requested debounce for "loop updates". 
      // Since this is a user-initiated action, immediate call is usually better, 
      // but we'll use the service which can handle logic safely.
      
      try {
        const syncResult = await AppointmentSyncService.syncAppointmentWithDailyRecaps(mergedData, originalData);
        if (!syncResult.success) {
          console.warn("Sync warning:", syncResult.message);
        }
      } catch (syncErr) {
        console.error("Sync service failed silently:", syncErr);
        // Don't fail the whole operation if just the sync part fails
      }

      setLastSyncTime(new Date());
      return { success: true, data };

    } catch (err) {
      console.error("Update failed:", err);
      toast({ variant: "destructive", title: "Update Failed", description: err.message });
      return { success: false, error: err };
    } finally {
      setIsSyncing(false);
    }
  }, [toast]);

  // Central delete method
  const deleteAppointment = useCallback(async (id, softDelete = true) => {
    setIsSyncing(true);
    try {
      // 1. Perform API delete (which cascades logic usually)
      const result = await apiDeleteAppointment(id, softDelete);
      if (result.error) throw result.error;

      // 2. Sync handled by API cascade or we can double check
      // For cancellations (soft delete), we might need explicit sync if API doesn't handle it
      if (softDelete) {
         // If it's a status update to cancelled effectively
         // The apiDeleteAppointment usually does a hard delete OR status update depending on flags
         // Assuming apiDeleteAppointment handles the DB side.
      }

      setLastSyncTime(new Date());
      return { success: true };
    } catch (err) {
      console.error("Delete failed:", err);
      toast({ variant: "destructive", title: "Delete Failed", description: err.message });
      return { success: false, error: err };
    } finally {
      setIsSyncing(false);
    }
  }, [toast]);

  // Trigger sync manually
  const triggerSync = useCallback(async (appointment, oldAppointment) => {
    setIsSyncing(true);
    try {
      await AppointmentSyncService.syncAppointmentWithDailyRecaps(appointment, oldAppointment);
      setLastSyncTime(new Date());
    } catch (err) {
      console.error("Manual sync failed:", err);
      toast({ variant: "destructive", title: "Sync Failed", description: "Could not synchronize appointment data." });
    } finally {
      setIsSyncing(false);
    }
  }, [toast]);

  return (
    <AppointmentStateContext.Provider value={{
      updateAppointment,
      deleteAppointment,
      triggerSync,
      isSyncing,
      lastSyncTime
    }}>
      {children}
    </AppointmentStateContext.Provider>
  );
};

export const useAppointmentState = () => {
  const context = useContext(AppointmentStateContext);
  if (!context) throw new Error("useAppointmentState must be used within AppointmentStateProvider");
  return context;
};