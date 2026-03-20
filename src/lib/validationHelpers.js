import { toast } from '@/components/ui/use-toast';

export const isValidUUID = (uuid) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuid && typeof uuid === 'string' && regex.test(uuid);
};

export const validatePatientId = (patientId, context = 'Operation') => {
  if (!patientId || patientId === 'undefined' || patientId === 'null') {
    console.error(`[${context}] Invalid Patient ID:`, patientId);
    return { valid: false, error: 'Patient ID is missing or invalid' };
  }
  if (!isValidUUID(patientId)) {
    console.error(`[${context}] Malformed Patient ID:`, patientId);
    return { valid: false, error: 'Patient ID format is incorrect' };
  }
  return { valid: true };
};

export const handleUndefinedPatientId = (patientId, context) => {
  const validation = validatePatientId(patientId, context);
  if (!validation.valid) {
    toast({
      variant: "destructive",
      title: "Data Error",
      description: `Cannot proceed: ${validation.error}`
    });
    return true; 
  }
  return false;
};

export const validateTherapistTimeOff = (data) => {
  const errors = [];
  
  if (!data.therapist_id) {
    errors.push("Terapis belum dipilih.");
  } else if (!isValidUUID(data.therapist_id)) {
    errors.push("ID Terapis tidak valid (format UUID salah).");
  }

  if (!data.start_date) {
    errors.push("Tanggal mulai wajib diisi.");
  }
  
  if (!data.end_date) {
    errors.push("Tanggal selesai wajib diisi.");
  }

  // Ensure dates are valid formats and logically correct
  if (data.start_date && data.end_date) {
    const start = new Date(data.start_date);
    const end = new Date(data.end_date);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      errors.push("Format tanggal tidak valid.");
    } else {
      if (start > end) {
        errors.push("Tanggal mulai tidak boleh melebihi tanggal selesai.");
      }
      
      // Warning if dates are in the past (optional logic, we just log it but don't strictly fail unless required)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (start < today) {
        console.warn("Peringatan: Tanggal mulai berada di masa lalu.");
      }
    }
  }

  if (data.start_time && data.end_time) {
     const st = data.start_time;
     const et = data.end_time;
     if (st >= et) {
        errors.push("Waktu mulai harus lebih awal dari waktu selesai.");
     }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};