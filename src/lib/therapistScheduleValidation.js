import { isValidUUID } from '@/lib/utils';

export const validateTherapistId = (id) => {
  if (!id) return { valid: false, error: 'Therapist ID is required' };
  if (!isValidUUID(id)) return { valid: false, error: 'Therapist ID must be a valid UUID' };
  return { valid: true, error: null };
};

export const validateClinicId = (id) => {
    if (!id) return { valid: false, error: 'Clinic ID is required' };
    if (!isValidUUID(id)) return { valid: false, error: 'Clinic ID must be a valid UUID' };
    return { valid: true, error: null };
};

export const validateDayOfWeek = (day) => {
  const dayInt = parseInt(day, 10);
  if (isNaN(dayInt) || dayInt < 0 || dayInt > 6) {
    return { valid: false, error: 'Day of week must be between 0 (Sunday) and 6 (Saturday)' };
  }
  return { valid: true, error: null };
};

export const validateTimeFormat = (time) => {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;
  if (!time || !timeRegex.test(time)) {
    return { valid: false, error: 'Time must be in HH:MM or HH:MM:SS format' };
  }
  return { valid: true, error: null };
};

export const validateTimeRange = (start, end) => {
  const startValid = validateTimeFormat(start);
  const endValid = validateTimeFormat(end);

  if (!startValid.valid) return startValid;
  if (!endValid.valid) return endValid;

  // Simple string comparison works for HH:MM format (24h)
  if (start >= end) {
    return { valid: false, error: 'Start time must be before end time' };
  }
  return { valid: true, error: null };
};

export const validateSchedulePayload = (payload) => {
  const errors = [];

  const therapistVal = validateTherapistId(payload.therapist_id);
  if (!therapistVal.valid) errors.push(`Therapist: ${therapistVal.error}`);
  
  // Optional but recommended check for clinic_id if your schema requires it
  if (payload.clinic_id) {
      const clinicVal = validateClinicId(payload.clinic_id);
      if (!clinicVal.valid) errors.push(`Clinic: ${clinicVal.error}`);
  }

  const dayVal = validateDayOfWeek(payload.day_of_week);
  if (!dayVal.valid) errors.push(`Day: ${dayVal.error}`);

  const startVal = validateTimeFormat(payload.start_time);
  if (!startVal.valid) errors.push(`Start Time: ${startVal.error}`);

  const endVal = validateTimeFormat(payload.end_time);
  if (!endVal.valid) errors.push(`End Time: ${endVal.error}`);

  if (startVal.valid && endVal.valid) {
    const rangeVal = validateTimeRange(payload.start_time, payload.end_time);
    if (!rangeVal.valid) errors.push(`Range: ${rangeVal.error}`);
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    errorString: errors.join(', ')
  };
};