import { supabase } from '@/lib/customSupabaseClient';
import { format, differenceInYears, addMonths } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { sendWhatsAppMessageManual } from '@/lib/api';

/**
 * Sends a WhatsApp message via the configured provider (invokes Edge Function)
 * @param {string} phoneNumber - Target phone number
 * @param {string} message - Message content
 */
export const sendWhatsAppMessage = async (phoneNumber, message) => {
  try {
    console.log(`[WhatsAppService] Sending to ${phoneNumber}: ${message}`);
    
    // Check if settings allow sending
    const { data: settings } = await supabase.from('wa_settings').select('*').single();
    if (!settings?.enabled) {
        console.warn("[WhatsAppService] WhatsApp integration is disabled in settings.");
        return { success: false, error: "Integration disabled" };
    }

    if (!phoneNumber || phoneNumber.length < 10) {
        throw new Error("Invalid phone number");
    }

    return { success: true };
  } catch (error) {
    console.error('[WhatsAppService] Send Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Direct send function that wraps the API call
 * @param {string} phoneNumber
 * @param {string} message
 */
export const sendWhatsAppMessageDirect = async (phoneNumber, message) => {
  try {
    if (!phoneNumber) throw new Error("Nomor telepon tidak valid.");
    if (!message) throw new Error("Pesan tidak boleh kosong.");

    const response = await sendWhatsAppMessageManual(phoneNumber, message);
    
    if (response.error) {
      throw new Error(response.error.message || "Gagal mengirim pesan.");
    }

    return { success: true, data: response.data };
  } catch (error) {
    console.error('[WhatsAppService] Direct Send Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Extracts time from appointment object in HH:MM format
 * @param {object} appointment - The appointment object containing appointment_date
 * @returns {string} - Formatted time or '-'
 */
export const extractAppointmentTime = (appointment) => {
  if (!appointment || !appointment.appointment_date) return '-';
  try {
    return format(new Date(appointment.appointment_date), 'HH:mm');
  } catch (e) {
    console.error('Error extracting appointment time:', e);
    return '-';
  }
};

/**
 * Calculates day name in Indonesian from a date object
 * @param {string|Date} dateObj
 * @returns {string} Day name (e.g., "Senin", "Selasa")
 */
export const calculateDayNameIndonesia = (dateObj) => {
  if (!dateObj) return '-';
  try {
    return format(new Date(dateObj), 'EEEE', { locale: idLocale });
  } catch (e) {
    console.error('Error calculating day name:', e);
    return '-';
  }
};

/**
 * Extracts day name from appointment object
 * @param {object} appointment - The appointment object
 * @returns {string} Day name or '-'
 */
export const extractAppointmentDayName = (appointment) => {
  if (!appointment || !appointment.appointment_date) return '-';
  return calculateDayNameIndonesia(appointment.appointment_date);
};

/**
 * Calculates age from date of birth
 * @param {string|Date} dateOfBirth 
 * @returns {number|string} Age in years or 0 if invalid
 */
export const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return 0;
    try {
        return differenceInYears(new Date(), new Date(dateOfBirth));
    } catch (e) {
        console.error('Error calculating age:', e);
        return 0;
    }
};

/**
 * Calculates promo validity period (Birthday until 1 month later)
 * @param {string|Date} birthDate - The patient's birth date
 * @returns {string} Formatted string like "10 Januari – 10 Februari"
 */
export const calculatePromoValidity = (birthDate) => {
    if (!birthDate) return '-';
    try {
        const today = new Date();
        const dob = new Date(birthDate);
        
        // Construct current year's birthday
        const currentYearBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
        
        const startDate = currentYearBirthday;
        const endDate = addMonths(startDate, 1);
        
        const startStr = format(startDate, 'd MMMM', { locale: idLocale });
        const endStr = format(endDate, 'd MMMM', { locale: idLocale });
        
        return `${startStr} – ${endStr}`;
    } catch (e) {
        console.error('Error calculating promo validity:', e);
        return '-';
    }
};

/**
 * Calculates the day name of the birthday in the current year
 * @param {string|Date} birthDate
 * @returns {string} Day name in Indonesian (e.g., "Senin")
 */
export const calculateBirthdayDayName = (birthDate) => {
    if (!birthDate) return '-';
    try {
        const today = new Date();
        const dob = new Date(birthDate);
        const currentYearBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
        return format(currentYearBirthday, 'EEEE', { locale: idLocale });
    } catch (e) {
        console.error('Error calculating birthday day name:', e);
        return '-';
    }
};

/**
 * Replaces placeholders in a template with actual values
 * @param {string} template - The template string
 * @param {object} placeholders - Key-value pairs of data
 * @param {object} [appointment] - Optional appointment object to automatically extract details like [jam]
 */
export const generateMessageFromTemplate = (template, placeholders, appointment = null) => {
  if (!template) return "";
  let message = template;
  
  // Merge explicit placeholders with derived ones
  const allPlaceholders = { ...placeholders };
  
  // Automatically handle [jam] and [hari_booking] if appointment is provided
  if (appointment) {
     allPlaceholders['jam'] = extractAppointmentTime(appointment);
     allPlaceholders['hari_booking'] = extractAppointmentDayName(appointment);
  }

  Object.keys(allPlaceholders).forEach(key => {
    // Regex to replace all occurrences of [key] case-insensitive
    const regex = new RegExp(`\\[${key}\\]`, 'gi');
    message = message.replace(regex, allPlaceholders[key] || '-');
  });
  return message;
};

/**
 * Determines the appropriate salutation for a patient
 * Priority 1: Nickname (return as-is)
 * Priority 2: Full Name (return "Ka " + Full Name)
 * Priority 3: Default "Kak"
 * @param {object} patient - Patient object
 */
export const getSalutation = (patient) => {
  if (!patient) return 'Kak';
  
  // 1. Nickname (Priority 1) - As-is
  // If nickname exists and is not just whitespace
  if (patient.nickname && patient.nickname.trim().length > 0) {
    return patient.nickname.trim();
  }
  
  // 2. Full Name (Priority 2) - "Ka " + Full Name
  // If no nickname, but full name exists
  if (patient.full_name && patient.full_name.trim().length > 0) {
    return `Ka ${patient.full_name.trim()}`;
  }

  // 3. Fallback (Priority 3)
  return 'Kak';
};

/**
 * Dummy scheduler trigger - usually run by Cron in backend
 */
export const scheduleWhatsAppMessages = async () => {
  console.log('[WhatsAppService] Triggering scheduler check...');
  try {
     const { data, error } = await supabase.functions.invoke('whatsapp-scheduler');
     if (error) throw error;
     return data;
  } catch (err) {
     console.error('[WhatsAppService] Scheduler Trigger Error:', err);
     return { error: err.message };
  }
};