import { parse, format, isValid, differenceInYears } from 'date-fns';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Generates a Medical Record Number by querying the last one from DB
 * Format: RMxxxxx (e.g., RM00001)
 * @returns {Promise<string>}
 */
export const generateMedicalRecordNumber = async () => {
    try {
        // Fetch the last created patient's RM number
        const { data, error } = await supabase
            .from('patients')
            .select('medical_record_number')
            .order('created_at', { ascending: false }) // Assuming created_at or id is a good proxy for sequence
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
            console.error("Error fetching last RM:", error);
            return 'RM00001'; // Fallback
        }

        if (!data || !data.medical_record_number) {
            return 'RM00001';
        }

        // Extract number part
        const lastRm = data.medical_record_number;
        const numberPart = lastRm.replace(/\D/g, ''); // Remove non-digits
        
        if (!numberPart) return 'RM00001';

        const nextNumber = parseInt(numberPart, 10) + 1;
        return `RM${String(nextNumber).padStart(5, '0')}`;

    } catch (e) {
        console.error("RM Generation Exception:", e);
        return 'RM00001';
    }
};

/**
 * Calculates age from birth date string (DD/MM/YYYY)
 * @param {string} birthDateStr - DD/MM/YYYY
 * @returns {number|null} Age in years or null if invalid
 */
export const calculateAge = (birthDateStr) => {
    if (!birthDateStr) return null;
    
    // Parse DD/MM/YYYY
    const date = parse(birthDateStr, 'dd/MM/yyyy', new Date());
    if (!isValid(date)) return null;

    return differenceInYears(new Date(), date);
};

/**
 * Auto-fills nickname based on Name, Age (derived from BirthDate), and Gender
 * @param {string} fullName 
 * @param {string} birthDateStr - DD/MM/YYYY
 * @param {string} gender - 'Laki-laki' or 'Perempuan' (or 'L'/'P')
 * @returns {string} Generated nickname
 */
export const autoFillNickname = (fullName, birthDateStr, gender) => {
    if (!fullName || !fullName.trim()) return '';

    const firstName = fullName.trim().split(' ')[0];
    const age = calculateAge(birthDateStr);

    // If date is invalid or age cannot be calculated, just return first name
    if (age === null) return firstName;

    // Logic based on age ranges
    // 0-12: "An. " + first name
    if (age >= 0 && age <= 12) {
        return `An. ${firstName}`;
    }
    
    // 13-26: "Ka " + first name
    if (age >= 13 && age <= 26) {
        return `Ka ${firstName}`;
    }

    // Determine normalized gender
    const isMale = gender?.toLowerCase().startsWith('l') || gender?.toLowerCase() === 'laki-laki';
    const isFemale = gender?.toLowerCase().startsWith('p') || gender?.toLowerCase() === 'perempuan';

    // 27-39: "Mas " (male) or "Mba " (female)
    if (age >= 27 && age <= 39) {
        if (isMale) return `Mas ${firstName}`;
        if (isFemale) return `Mba ${firstName}`;
        return firstName; // Fallback if gender unknown
    }

    // ≥40: "Bapak " (male) or "Ibu " (female)
    if (age >= 40) {
        if (isMale) return `Bapak ${firstName}`;
        if (isFemale) return `Ibu ${firstName}`;
        return firstName;
    }

    return firstName;
};

/**
 * Converts ISO date (YYYY-MM-DD) to Display date (DD/MM/YYYY)
 * @param {string} isoDate 
 * @returns {string}
 */
export const formatDateToDisplay = (isoDate) => {
    if (!isoDate) return '';
    try {
        const date = parse(isoDate, 'yyyy-MM-dd', new Date());
        if (!isValid(date)) return isoDate; // Fallback if already formatted or invalid
        return format(date, 'dd/MM/yyyy');
    } catch (error) {
        return isoDate;
    }
};

/**
 * Converts Display date (DD/MM/YYYY) to ISO date (YYYY-MM-DD)
 * @param {string} displayDate 
 * @returns {string|null}
 */
export const parseDateFromDisplay = (displayDate) => {
    if (!displayDate) return null;
    try {
        const date = parse(displayDate, 'dd/MM/yyyy', new Date());
        if (!isValid(date)) return null;
        return format(date, 'yyyy-MM-dd');
    } catch (error) {
        return null;
    }
};

/**
 * Validates if a string is strictly in DD/MM/YYYY format
 * @param {string} dateStr 
 * @returns {boolean}
 */
export const isValidDateFormat = (dateStr) => {
    // Strict Regex for DD/MM/YYYY
    // Day: 01-31, Month: 01-12, Year: 19xx or 20xx
    const regex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[012])\/(19|20)\d\d$/;
    if (!regex.test(dateStr)) return false;
    
    // Logical Date Check (e.g. reject 31/02/2023)
    const date = parse(dateStr, 'dd/MM/yyyy', new Date());
    return isValid(date);
};

/**
 * Formats phone number for display (visual only)
 * @param {string} phone 
 * @returns {string}
 */
export const formatPhoneForDisplay = (phone) => {
    if (!phone) return '';
    // Remove existing formatting to re-format consistently
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 0) return '';
    
    // Format: 0812-3456-7890
    if (cleaned.length > 8) {
        return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    } else if (cleaned.length > 4) {
        return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
    }
    return cleaned;
};

/**
 * Normalizes phone number for database storage (only digits)
 * @param {string} phone 
 * @returns {string}
 */
export const normalizePhone = (phone) => {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
};

/**
 * Validates the patient form data
 * @param {object} data Form data object
 * @returns {object} { isValid: boolean, errors: object }
 */
export const validatePatientForm = (data) => {
    const errors = {};
    
    // Required: Full Name
    if (!data.full_name || !data.full_name.trim()) {
        errors.full_name = "Nama Pasien wajib diisi";
    }

    // Required: Nickname
    if (!data.nickname || !data.nickname.trim()) {
        errors.nickname = "Nama Panggilan wajib diisi";
    }

    // Required: Birth Date
    if (!data.birth_date || !data.birth_date.trim()) {
        errors.birth_date = "Tanggal Lahir wajib diisi";
    } else if (!isValidDateFormat(data.birth_date)) {
        errors.birth_date = "Format tanggal tidak valid (gunakan DD/MM/YYYY)";
    }

    // Required: Gender
    if (!data.gender) {
        errors.gender = "Gender wajib dipilih";
    }

    // Required: Phone
    if (!data.phone || !data.phone.trim()) {
        errors.phone = "Nomor HP wajib diisi";
    } else if (data.phone.replace(/\D/g, '').length < 8) {
        errors.phone = "Nomor HP minimal 8 digit";
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};