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
export const getUnfilledSOAPVisits = async (_unusedName, therapistId, startDate = null, endDate = null) => {
  if (!therapistId) {
    return { count: 0, error: null };
  }

  try {
    // ambil semua recap therapist dalam periode
    let query = supabase
      .from('daily_recaps')
      .select('id')
      .eq('therapist_id', therapistId);

    if (startDate) query = query.gte('recap_date', startDate);
    if (endDate) query = query.lte('recap_date', endDate);

    const { data: recaps, error: recapsError } = await query;

    if (recapsError) throw recapsError;

    if (!recaps || recaps.length === 0) {
      return { count: 0, error: null };
    }

    const recapIds = recaps.map(r => r.id);

    if (!recapIds.length) {
      return { count: 0, error: null };
    }

    // ambil medical records berdasarkan recap therapist
    const chunkSize = 200;
    let medicalRecords = [];

    for (let i = 0; i < recapIds.length; i += chunkSize) {

      const chunk = recapIds.slice(i, i + chunkSize);

      const { data, error } = await supabase
        .from('medical_records')
        .select('daily_recap_id')
        .in('daily_recap_id', chunk);

      if (error) throw error;

      if (data) {
        medicalRecords.push(...data);
      }
    }

    // recap yg sudah punya SOAP
    const filledRecapIds = new Set(
      medicalRecords
        .map(r => r.daily_recap_id)
        .filter(Boolean)
    );

    // hitung yg belum punya SOAP
    const unfilledCount = recaps.filter(
      r => !filledRecapIds.has(r.id)
    ).length;

    return {
      count: unfilledCount,
      error: null
    };

  } catch (error) {
    console.error('Error calculating unfilled SOAP:', error);

    return {
      count: 0,
      error
    };
  }
};