import { differenceInYears, parseISO, isValid, format, parse } from 'date-fns';
import { id } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Calculates age from birth date
 * @param {string|Date} birthDate 
 * @returns {number|null} Age in years or null
 */
export const calculateAge = (birthDate) => {
  if (!birthDate) return null;
  try {
    const date = typeof birthDate === 'string' ? parseISO(birthDate) : birthDate;
    if (!isValid(date)) return null;
    return differenceInYears(new Date(), date);
  } catch (e) {
    return null;
  }
};

/**
 * Normalizes gender to display code (L/P)
 * @param {string} gender 
 * @returns {string} "L", "P" or "-"
 */
export const normalizeGender = (gender) => {
  if (!gender) return '-';
  const g = String(gender).toLowerCase().trim();
  
  if (g === 'l' || g === 'laki-laki' || g === 'male' || g === 'laki') return 'L';
  if (g === 'p' || g === 'perempuan' || g === 'female' || g === 'wanita') return 'P';
  
  return '-';
};

/**
 * Returns full gender label if needed
 */
export const getGenderLabel = (gender) => {
  const code = normalizeGender(gender);
  if (code === 'L') return 'Laki-laki';
  if (code === 'P') return 'Perempuan';
  return '-';
};

/**
 * Formats date to DD/MM/YYYY (Short format)
 */
export const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
        const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
        if (!isValid(date)) return '-';
        return format(date, 'dd/MM/yyyy');
    } catch (e) {
        return '-';
    }
};

/**
 * Formats date to "Senin, 31/12/1975" format
 */
export const formatDateLong = (dateStr) => {
    if (!dateStr) return '-';
    try {
        const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
        if (!isValid(date)) return '-';
        return format(date, 'EEEE, dd/MM/yyyy', { locale: id });
    } catch (e) {
        return '-';
    }
};

/**
 * Formats phone number
 */
export const formatPhone = (phone) => {
    if (!phone) return '-';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 4) return cleaned;
    if (cleaned.length < 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
};

/**
 * Validates patient fields
 */
export const validatePatientCompleteness = (patient) => {
    const missing = [];
    if (!patient.full_name || patient.full_name === '-') missing.push('full_name');
    if (!patient.nickname || patient.nickname === '-') missing.push('nickname');
    if (!patient.gender || patient.gender === '-' || patient.gender === '') missing.push('gender');
    if (!patient.birth_date || patient.birth_date === '-') missing.push('birth_date');
    if (!patient.phone || patient.phone === '-' || patient.phone === '') missing.push('phone');

    return { 
        isComplete: missing.length === 0, 
        missing 
    };
};

export const getStatusColor = (status) => {
    const s = String(status).toLowerCase();
    if (s === 'aktif') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    return 'bg-slate-100 text-slate-500 border-slate-200';
};

export const getCompletenessColor = (isComplete) => {
    if (isComplete) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-yellow-50 text-yellow-700 border-yellow-200';
};

/**
 * Normalizes patient object
 */
export const normalizePatient = (patient) => {
    if (!patient) return null;
    
    const phone = patient.phone || patient.phone_number || '';
    const rawGender = patient.gender;
    const genderCode = normalizeGender(rawGender);
    const age = calculateAge(patient.birth_date);
    
    // Construct validation object
    const validationObj = {
        ...patient,
        phone,
        gender: rawGender,
        birth_date: patient.birth_date,
        nickname: patient.nickname
    };

    const completeness = validatePatientCompleteness(validationObj);

    return {
        ...patient,
        phone, 
        gender: genderCode, 
        genderLabel: getGenderLabel(rawGender),
        age, 
        formattedAge: age !== null ? `${age} thn` : '-',
        formattedBirthDate: formatDateLong(patient.birth_date),
        formattedPhone: formatPhone(phone),
        completeness, 
        isComplete: completeness.isComplete,
        statusClass: getStatusColor(patient.status || 'aktif'),
        completenessClass: getCompletenessColor(completeness.isComplete),
        additionalInfoLabel: patient.patient_info_options?.label || patient.additional_info_label || '-'
    };
};

/**
 * Generates the next Medical Record Number (RM) via the atomic DB-side RPC
 * (generate_next_medical_record_number), scoped to the current user's
 * clinic. The RPC locks per clinic so concurrent callers can never be
 * handed the same number.
 * Format: RM + 5 digits (e.g. RM00001)
 */
export const generateNextRM = async () => {
    try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

        if (!userRow?.clinic_id) {
            console.error("RM Generation: missing clinic_id for current user");
            return 'RM-----';
        }

        const { data, error } = await supabase.rpc('generate_next_medical_record_number', {
            p_clinic_id: userRow.clinic_id
        });

        if (error || !data) throw error || new Error('Empty RM response');

        return data;
    } catch (error) {
        console.error("Error generating RM:", error);
        return 'RM-----'; // Fallback
    }
};

/**
 * Generates nickname based on rules
 */
export const generateNickname = (fullName, birthDate, gender) => {
    if (!fullName || !birthDate || !gender) return '';

    const age = calculateAge(birthDate);
    if (age === null) return '';

    const firstName = fullName.trim().split(' ')[0];
    const genderCode = normalizeGender(gender); // L or P

    let prefix = '';

    if (age <= 12) {
        prefix = 'An.';
    } else if (age >= 13 && age <= 26) {
        prefix = 'Ka';
    } else if (age >= 27 && age <= 39) {
        prefix = genderCode === 'L' ? 'Mas' : 'Mba';
    } else if (age >= 40) {
        prefix = genderCode === 'L' ? 'Bapak' : 'Ibu';
    }

    return `${prefix} ${firstName}`;
};

/**
 * Parses dd/mm/yyyy to yyyy-MM-dd
 */
export const parseBirthDate = (displayDate) => {
    if (!displayDate) return '';
    try {
        const parsedDate = parse(displayDate, 'dd/MM/yyyy', new Date());
        if (isValid(parsedDate)) {
             // Basic sanity check for year range
             const year = parsedDate.getFullYear();
             if (year < 1900 || year > 2100) return '';
             return format(parsedDate, 'yyyy-MM-dd');
        }
        return '';
    } catch (e) {
        return '';
    }
};

/**
 * Formats yyyy-MM-dd to dd/mm/yyyy
 */
export const formatBirthDateDisplay = (isoDate) => {
    if (!isoDate) return '';
    try {
        const date = parseISO(isoDate);
        if (isValid(date)) {
            return format(date, 'dd/MM/yyyy');
        }
        return '';
    } catch (e) {
        return '';
    }
};