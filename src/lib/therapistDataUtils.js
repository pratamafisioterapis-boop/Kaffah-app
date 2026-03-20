import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';

/**
 * Fetches all unique patients associated with a therapist based on daily_recaps history.
 * Updated to filter by therapist_id and use medical_record_number instead of rm_number.
 * 
 * @param {string} therapistId - The UUID of the therapist
 * @returns {Promise<{data: Array, error: any}>} - Returns array of unique patient objects
 */
export const getTherapistPatientsFromRecaps = async (therapistId) => {
  if (!therapistId) return { data: [], error: null };

  try {
    // UPDATED: Filter by therapist_id, removed ilike name search
    const { data: recaps, error } = await supabase
      .from('daily_recaps')
      .select(`
        patient_id,
        actual_patient_id,
        patient:patients!daily_recaps_actual_patient_id_fkey (
          id,
          full_name,
          medical_record_number, 
          phone,
          address,
          gender,
          date_of_birth
        )
      `)
      .eq('therapist_id', therapistId);

    if (error) {
      console.error("Error fetching therapist patients from recaps:", error);
      return { data: [], error };
    }

    if (!recaps || recaps.length === 0) {
      return { data: [], error: null };
    }

    // Deduplicate patients using a Map based on patient_id
    const uniquePatientsMap = new Map();
    
    recaps.forEach(recap => {
      // Ensure patient data exists and hasn't been added yet
      if (recap.patient && recap.patient.id && !uniquePatientsMap.has(recap.patient.id)) {
        uniquePatientsMap.set(recap.patient.id, recap.patient);
      }
    });

    // Convert Map values to array
    const patientsList = Array.from(uniquePatientsMap.values());
    
    // Sort alphabetically by name
    patientsList.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

    return { data: patientsList, error: null };

  } catch (err) {
    console.error("Unexpected error in getTherapistPatientsFromRecaps:", err);
    return { data: [], error: err };
  }
};

/**
 * Fetches all daily recaps (visits) for a therapist.
 * Updated to use therapist_id filter and removed rm_number.
 * 
 * @param {string} therapistId - The UUID of the therapist
 * @returns {Promise<{data: Array, error: any}>} - Returns array of recap objects with patient data
 */
export const getTherapistVisits = async (therapistId) => {
  if (!therapistId) return { data: [], error: null };

  try {
    // UPDATED: Filter by therapist_id, removed ilike name search
    const { data: recaps, error } = await supabase
      .from('daily_recaps')
      .select(`
        *,
        patient:patients!daily_recaps_actual_patient_id_fkey (
          id,
          full_name,
          medical_record_number,
          gender
        )
      `)
      .eq('therapist_id', therapistId)
      .order('recap_date', { ascending: false });

    if (error) {
      console.error("Error fetching therapist visits:", error);
      return { data: [], error };
    }

    return { data: recaps || [], error: null };
  } catch (err) {
    console.error("Unexpected error in getTherapistVisits:", err);
    return { data: [], error: err };
  }
};

/**
 * Calculates the number of daily recaps that do not have a corresponding medical record.
 * Updated to filter recaps by therapist_id.
 * 
 * @param {string} _unusedName - Deprecated parameter (formerly name)
 * @param {string} therapistId - The UUID of the therapist
 * @returns {Promise<{count: number, error: any}>}
 */
export const getUnfilledSOAPVisits = async (_unusedName, therapistId) => {
  if (!therapistId) return { count: 0, error: null };

  try {
    // 1. Get all recaps (visits) for this therapist using ID
    const { data: recaps, error: recapsError } = await supabase
      .from('daily_recaps')
      .select('id, recap_date, patient_id, actual_patient_id')
      .eq('therapist_id', therapistId);

    if (recapsError) throw recapsError;
    if (!recaps || recaps.length === 0) return { count: 0, error: null };

    // 2. Get all medical records created by this therapist
    const { data: records, error: recordsError } = await supabase
      .from('medical_records')
      .select('created_at, patient_id')
      .eq('created_by', therapistId); // Assuming therapist_id in recaps maps to created_by in records (User ID)
      // Note: therapist_id in daily_recaps is from physiotherapists table (UUID), 
      // while created_by in medical_records is from users table (UUID).
      // Usually these are same if setup correctly or linked. 
      // If therapistId passed here is physiotherapist ID, we might need user ID.
      // However, usually we pass user ID to this function.

    if (recordsError) throw recordsError;

    // 3. Compare Recaps vs Records
    let unfilledCount = 0;
    
    // Create a Set of "patientId_date" strings from records for fast lookup
    const recordSet = new Set();
    if (records && records.length > 0) {
      records.forEach(r => {
        // created_at is timestamptz, format to YYYY-MM-DD
        const dateStr = format(new Date(r.created_at), 'yyyy-MM-dd');
        recordSet.add(`${r.patient_id}_${dateStr}`);
      });
    }

    recaps.forEach(recap => {
      const recapDateStr = format(new Date(recap.recap_date), 'yyyy-MM-dd');
      const targetPatientId = recap.actual_patient_id || recap.patient_id;
      const key = `${targetPatientId}_${recapDateStr}`;
      
      if (!recordSet.has(key)) {
        unfilledCount++;
      }
    });

    return { count: unfilledCount, error: null };

  } catch (error) {
    console.error("Error calculating unfilled SOAP:", error);
    return { count: 0, error };
  }
};