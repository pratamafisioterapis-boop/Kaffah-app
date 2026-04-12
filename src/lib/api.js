import { supabase } from '@/lib/customSupabaseClient';
import { 
    validatePackageTypeId, 
    validateBirthDate, 
    validateGender, 
    validateUUIDFormatted,
    isValidUUID
} from '@/lib/utils';
import { validatePatientId } from '@/lib/validationHelpers';
import { validateSchedulePayload } from '@/lib/therapistScheduleValidation';
import { format, parseISO, isValid } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { safeQuery } from '@/lib/supabaseErrorHandler';

// ============================================
// HELPERS
// ============================================
const cleanDailyRecapPayload = (data) => {
  if (!data) return data;
  
  const cleaned = { ...data };
  const fieldsToRemove = [
    'patient_name',
    'service_type_id', 
    'therapist_name',
    'is_auto_filled',
    'discount_label',
    'package_type_id'
  ];

  fieldsToRemove.forEach(field => {
    delete cleaned[field];
  });

  const uuidFields = [
    'patient_id', 
    'actual_patient_id', 
    'therapist_id', 
    'appointment_id', 
    'package_tracking_id'
  ];

  uuidFields.forEach(field => {
    if (cleaned[field] === '') {
      cleaned[field] = null;
    }
  });
  
  return cleaned;
};

const enrichRecapsWithOptions = async (recaps) => {
  if (!recaps || recaps.length === 0) return recaps;

  const { data: options } = await supabase
    .from('operational_options')
    .select('id, label, category')
    .in('category', ['diagnosa', 'service_type', 'patient_type', 'tipe_paket', 'service', 'payment_method'])
    .eq('is_active', true);

  if (!options) return recaps;

  const optionsMap = options.reduce((acc, opt) => {
    acc[opt.id] = opt.label;
    return acc;
  }, {});

  return recaps.map(recap => {
    let diagArray = [];

try {
  diagArray = typeof recap.diagnosis === 'string'
    ? JSON.parse(recap.diagnosis)
    : recap.diagnosis;
} catch {
  diagArray = [];
}

if (!Array.isArray(diagArray)) {
  diagArray = diagArray ? [diagArray] : [];
}

// 🔥 flatten + mapping aman
diagArray = diagArray.flat();

const enrichedDiagnosis = diagArray.map(d => optionsMap[d] || d);

const enrichedServiceType = optionsMap[recap.service_type] || recap.service_type;
const enrichedPatientType = optionsMap[recap.patient_type] || recap.patient_type;
const enrichedPackageType = optionsMap[recap.package_type] || recap.package_type;
const enrichedPaymentMethod = optionsMap[recap.payment_method] || recap.payment_method;

return {
  ...recap,
  diagnosis: enrichedDiagnosis,
  service_type: enrichedServiceType,
  patient_type: enrichedPatientType,
  package_type: enrichedPackageType,
  payment_method: enrichedPaymentMethod,
  raw_diagnosis: diagArray,
  raw_service_type: recap.service_type,
  raw_patient_type: recap.patient_type
};
  });
};
// ============================================
// DAILY RECAP SESSIONS
// ============================================

export const startDailyRecapSession = async (recapId) => {
  return safeQuery(async () => {
    return await supabase
      .from('daily_recaps')
      .update({ 
        start_time: new Date().toISOString(), 
        status: 'ongoing', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', recapId)
      .select()
      .single();
  }, 'startDailyRecapSession', { retry: true });
};

export const endDailyRecapSession = async (recapId) => {
  return safeQuery(async () => {
    return await supabase
      .from('daily_recaps')
      .update({ 
        end_time: new Date().toISOString(), 
        status: 'completed', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', recapId)
      .select()
      .single();
  }, 'endDailyRecapSession', { retry: true });
};

export const interpolateTemplate = (template, item) => {
  if (!template) return '';

  const isGuest = !item.patient_id;

  const patient = item.patient || item.patients || {};

  let message = template;

  const nama = isGuest
  ? `Ka ${item.guest_name || ''}`.trim()
  : patient.nickname || patient.full_name || 'Pasien';

  message = message.replace(/\[nickname\]/gi, nama);
  message = message.replace(/\[nama_pasien\]/gi, nama);
  message = message.replace(/\[nama\]/gi, nama);

  let sapaan = 'Kak';

  if (isGuest) {
    sapaan = `Ka ${item.guest_name || ''}`.trim();
  } else {
    const gender = patient.gender || '';

    if (patient.nickname) {
      sapaan = patient.nickname;
    } else if (gender) {
      const g = gender.toLowerCase();
      if (g.includes('female') || g.includes('wanita') || g.includes('p')) {
        sapaan = 'Ibu';
      } else if (g.includes('male') || g.includes('pria') || g.includes('l')) {
        sapaan = 'Bapak';
      }
    } else if (patient.full_name) {
      sapaan = `Ka ${patient.full_name}`;
    }
  }

  message = message.replace(/\[sapaan\]/gi, sapaan);

  let usia = '';
  if (!isGuest && patient.birth_date) {
    const birth = new Date(patient.birth_date);
    const today = new Date();
    usia = today.getFullYear() - birth.getFullYear();

    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      usia--;
    }
  }

  message = message.replace(/\[usia\]/gi, usia);

  const masaDate = new Date();
  masaDate.setMonth(masaDate.getMonth() + 1);

  const masaBerlaku = masaDate.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  message = message.replace(/\[masa_berlaku\]/gi, masaBerlaku);

  let tanggalFormatted = '';
  let hariBooking = '';
  let jamFormatted = '';

  let dateObj = null;

  if (item.scheduled_date) {
    dateObj = parseISO(item.scheduled_date);
  }

  if (!dateObj && item.appointment_data?.appointment_date) {
    dateObj = parseISO(item.appointment_data.appointment_date);
  }

  if (dateObj && isValid(dateObj)) {
    tanggalFormatted = format(dateObj, 'dd MMMM yyyy', { locale: idLocale });
    hariBooking = format(dateObj, 'EEEE', { locale: idLocale });
  }

  if (item.scheduled_time) {
    jamFormatted = item.scheduled_time.substring(0, 5);
  }

  message = message.replace(/\[tanggal\]/gi, tanggalFormatted);
  message = message.replace(/\[hari_booking\]/gi, hariBooking);
  message = message.replace(/\[jam\]/gi, jamFormatted);
  message = message.replace(/\[jam_terapi\]/gi, jamFormatted);

  return message;
};

export const generateFollowUps = async (type) => {
    return safeQuery(async () => {
        let rpcName = '';

        if (type === 'therapy_reminder') {
            rpcName = 'generate_appointment_reminders';
        }
        else if (type === 'expiry_package') {
            rpcName = 'generate_package_expiry_reminders';
        }
        else if (type === 'birthday_greeting') {
            rpcName = 'generate_birthday_greetings';
        }
        else if (type === 'follow_up') {
            rpcName = 'generate_post_therapy_followup';
        }

        if (!rpcName) {
            return { error: { message: 'Invalid follow up type' } };
        }

        const { error } = await supabase.rpc(rpcName);
        if (error) return { error };

        return { data: { success: true }, error: null };
    }, `generateFollowUps:${type}`);
};

export const getFollowUpQueue = async (status = 'pending', type = null) => {
  return safeQuery(async () => {
    let query = supabase
      .from('follow_up_queue')
      .select(`
        *,
        patient:patients(id, full_name, phone, medical_record_number, gender, nickname, birth_date)
      `)
      .eq('is_expired', false);
    
    if (status) query = query.eq('status', status);
    if (type) query = query.eq('follow_up_type', type);
    
    query = query.order('scheduled_date', { ascending: true })
                 .order('scheduled_time', { ascending: true });

    const { data: queueData, error: queueError } = await query;

    if (queueError) return { error: queueError };

    const appointmentIds = queueData
      .filter(item => item.source_table === 'appointments' && item.source_id)
      .map(item => item.source_id);

    let appointmentsMap = {};
    if (appointmentIds.length > 0) {
      const { data: appointments, error: appError } = await supabase
        .from('appointments')
        .select('id, appointment_date, duration_minutes')
        .in('id', appointmentIds);
        
      if (!appError && appointments) {
        appointmentsMap = appointments.reduce((acc, app) => {
          acc[app.id] = app;
          return acc;
        }, {});
      }
    }

    const enrichedData = queueData.map(item => {
      let appointmentData = null;

      if (item.source_table === 'appointments' && item.source_id) {
        appointmentData = appointmentsMap[item.source_id] || null;
      }

      return {
        ...item,
        patient: item.patient || item.patients || null,
        appointment_data: appointmentData
      };
    });

    return { 
      data: enrichedData || [], 
      success: true, 
      error: null 
    };
  }, 'getFollowUpQueue', { retry: true });
};

export const sendFollowUpWhatsApp = async (id) => {
  return safeQuery(async () => {
    return await supabase
      .from('follow_up_queue')
      .update({ 
        status: 'sent', 
        sent_at: new Date().toISOString()
      })
      .eq('id', id);
  }, 'sendFollowUpWhatsApp', { retry: true });
};

export const markFollowUpAsCompleted = async (id) => {
  return safeQuery(async () => {
    return await supabase
      .from('follow_up_queue')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
  }, 'markFollowUpAsCompleted', { retry: true });
};

export const deleteFollowUpQueue = async (id) => {
  return safeQuery(async () => {
    return await supabase
      .from('follow_up_queue')
      .delete()
      .eq('id', id);
  }, 'deleteFollowUpQueue');
};

export const generateFollowUpQueue = async (type) => {
    return safeQuery(async () => {
        let rpcName = '';
        if (type === 'recap') rpcName = 'generate_post_therapy_followup';
        if (type === 'expiry_package') rpcName = 'generate_package_expiry';
        if (type === 'therapy_reminder') rpcName = 'generate_appointment_reminder';
        if (type === 'birthday_greeting') rpcName = 'generate_birthday_followup';
        
        if (!rpcName) return { error: { message: 'Invalid generation type' } };

        const { error } = await supabase.rpc(rpcName);
        if (error) return { error };
        
        return { data: { success: true }, error: null };
    }, `generateFollowUpQueue:${type}`);
};

export const checkFollowUpQueueExists = async (patientId, date) => {
  return safeQuery(async () => {
    return await supabase
      .from('follow_up_queue')
      .select('id, status')
      .eq('patient_id', patientId)
      .eq('scheduled_date', date)
      .limit(1)
      .maybeSingle();
  }, 'checkFollowUpQueueExists');
};

export const deleteFollowUpQueueEntry = async (id) => {
  return safeQuery(async () => {
    return await supabase
      .from('follow_up_queue')
      .delete()
      .eq('id', id);
  }, 'deleteFollowUpQueueEntry');
};

export const deleteFollowUpQueueBulk = async (ids) => {
  return safeQuery(async () => {
    return await supabase
      .from('follow_up_queue')
      .delete()
      .in('id', ids);
  }, 'deleteFollowUpQueueBulk');
};

export const markFollowUpAsSent = async (id) => {
  return safeQuery(async () => {
    return await supabase
      .from('follow_up_queue')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', id);
  }, 'markFollowUpAsSent', { retry: true });
};

export const deleteFollowUp = async (id) => {
    return deleteFollowUpQueueEntry(id);
};

export const sendWhatsAppFollowUp = sendFollowUpWhatsApp;

export const getFollowUpPatients = async (days) => getFollowUpQueue('pending', 'follow_up');
export const getPackageExpiryPatients = async (days) => getFollowUpQueue('pending', 'expiry_package');
export const getTodayTherapyPatients = async () => 
  getFollowUpQueue('pending', 'therapy_reminder');
export const getBirthdayPatients = async () => getFollowUpQueue('pending', 'birthday_greeting');

// ============================================
// APPOINTMENTS & SLOTS
// ============================================

export const getAvailableSlots = async (date, therapistId) => {
  return safeQuery(async () => {
    const { data, error } = await supabase.rpc('get_available_slots_with_status_by_date', { 
      p_date: date
    });
    
    if (error) return { error };
    
    let result = data;
    if (therapistId && result) {
      result = result.filter(s => s.therapist_id === therapistId);
    }
    
    return { data: result, error: null };
  }, 'getAvailableSlots', { retry: true });
};

export const getAvailableSlotsToday = async (therapistId) => {
  const today = new Date().toISOString().split('T')[0];
  return getAvailableSlots(today, therapistId);
};

export const getAppointments = async (filters = {}) => {
  return safeQuery(async () => {
    let query = supabase
      .from('appointments')
      .select(`
        *,
        patient:patients(full_name, phone, medical_record_number),
        therapist:physiotherapists(id, name, theme_color)
      `);

    if (filters.date) query = query.gte('appointment_date', `${filters.date}T00:00:00`).lte('appointment_date', `${filters.date}T23:59:59`);
    if (filters.startDate) query = query.gte('appointment_date', filters.startDate);
    if (filters.endDate) query = query.lte('appointment_date', filters.endDate);
    if (filters.therapistId) query = query.eq('therapist_id', filters.therapistId);
    if (filters.patientId) query = query.eq('patient_id', filters.patientId);

    return await query.order('appointment_date', { ascending: true });
  }, 'getAppointments', { retry: true });
};

export const createAppointment = async (params) => {
  try {
    let finalDate =
      params.p_appointment_date ||
      params.appointmentDate ||
      params.p_start_time ||
      params.startTime;

    if (finalDate instanceof Date) {
      finalDate = finalDate.toISOString();
    }

    if (!finalDate) {
      throw new Error("Appointment date is required");
    }

    const payload = {
  p_therapist_id: params.p_therapist_id || params.therapistId,
  p_appointment_date: finalDate,
  p_duration_minutes: parseInt(
    params.p_duration_minutes || params.durationMinutes || 60
  ),
  p_patient_id: params.p_patient_id || params.patientId || null,
  p_status: params.p_status || params.status || "confirmed",
  p_clinic_id: params.p_clinic_id || params.clinicId || null,
  p_notes: params.p_notes || params.notes || null,
  p_service_id: params.p_service_id || params.serviceId || null,
  p_guest_name: params.p_guest_name || params.guestName || null,
  p_guest_phone: params.p_guest_phone || params.guestPhone || null,
  p_is_homecare: params.p_is_homecare ?? false,

  // 🔥 TAMBAHAN WAJIB
  p_allow_overlap: params.p_allow_overlap ?? false
};

    const { data, error } = await supabase.rpc(
      "create_appointment_safe",
      payload
    );

    if (error) {
      return { error };
    }

    supabase.functions
  .invoke("process-booking-whatsapp-now")
  .then(() => {})
  .catch(() => {});

    return { data: { id: data }, error: null };

  } catch (err) {
    return { error: err };
  }
};

export const updateAppointment = async (id, updates) => {
  return safeQuery(async () => {
    return await supabase.from('appointments').update(updates).eq('id', id).select().single();
  }, 'updateAppointment');
};

export const updateAppointmentStatus = async (id, status) => {
  return updateAppointment(id, { status });
};

export const deleteAppointment = async (id) => {
  return safeQuery(async () => {
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (error) return { error };
    return { data: true, error: null };
  }, 'deleteAppointment');
};

export const bookAppointmentSafe = createAppointment;

export const checkRecurringSlotConflicts = async (params) => {
  return safeQuery(async () => {
      const { data, error } = await supabase.rpc('check_recurring_slot_conflicts', {
          p_therapist_id: params.therapist_id,
          p_start_date: params.start_date,
          p_end_date: params.end_date,
          p_weekday: params.weekday,
          p_time: params.time,
          p_duration_minutes: params.duration_minutes || 60
      });
      if (error) return { error };
      return { data, error: null };
  }, 'checkRecurringSlotConflicts');
};

export const createRecurringAppointmentSafe = async (params) => {
  return safeQuery(async () => {
      const { data, error } = await supabase.rpc('create_recurring_appointment_safe', {
          p_therapist_id: params.therapist_id,
          p_start_date: params.start_date,
          p_end_date: params.end_date,
          p_weekday: params.weekday,
          p_time: params.time,
          p_duration_minutes: params.duration_minutes || 60,
          p_patient_id: params.patient_id || null,
          p_status: params.status || 'confirmed',
          p_notes: params.notes || null,
          p_guest_name: params.guest_name || null,
          p_guest_phone: params.guest_phone || null
      });
      if (error) return { error };
      return { data, error: null };
  }, 'createRecurringAppointmentSafe');
};

export const getBookingAppointmentPatients = async () => {
  return getPatients();
};

export const getAppointmentSettings = async () => {
  return safeQuery(async () => {
    const { data, error } = await supabase.from('appointment_settings').select('*').single();
    if (error && error.code !== 'PGRST116') return { error };
    return { data: data || {}, error: null };
  }, 'getAppointmentSettings', { retry: true });
};

// ============================================
// PHYSIOTHERAPISTS
// ============================================

export const getPhysiotherapists = async () => {
  return safeQuery(async () => {
    return await supabase.from('physiotherapists').select('*');
  }, 'getPhysiotherapists', { retry: true });
};

export const getActivePhysiotherapists = async (filters = {}) => {
  return safeQuery(async () => {
    let query = supabase.from('physiotherapists').select('*').eq('is_active', true);
    
    if (filters.showOnBooking) {
      query = query.eq('show_on_booking', true);
    }
    if (filters.showOnLanding) {
      query = query.eq('show_on_landing', true);
    }
    
    return await query;
  }, 'getActivePhysiotherapists', { retry: true });
};

export const getTherapistPracticeHoursGrouped = async (therapistId) => {
  return safeQuery(async () => {
    return await supabase.rpc('get_therapist_practice_hours_grouped', { p_therapist_id: therapistId });
  }, 'getTherapistPracticeHoursGrouped', { retry: true });
};

export const fetchPhysiotherapists = getPhysiotherapists;
export const getAllPhysiotherapists = getPhysiotherapists;
export const getTherapists = getPhysiotherapists;
export const fetchAllTherapists = getPhysiotherapists;
export const fetchActiveTherapists = getActivePhysiotherapists;

export const getPhysiotherapistByUserId = async (userId) => {
  return safeQuery(async () => {
    const { data, error } = await supabase.from('physiotherapists').select('*').eq('user_id', userId).single();
    if (error && error.code !== 'PGRST116') return { error };
    return { data, error: null };
  }, 'getPhysiotherapistByUserId', { retry: true });
};

// ============================================
// PATIENTS
// ============================================

export const getPatients = async (searchTerm = '') => {
  return safeQuery(async () => {
    let query = supabase
      .from('patients')
      .select('id, full_name, medical_record_number, phone')
      .eq('status', 'aktif')
      .order('full_name', { ascending: true });

    if (searchTerm && searchTerm.trim()) {
      query = query.or(`full_name.ilike.%${searchTerm.trim()}%,phone.ilike.%${searchTerm.trim()}%`);
    }

    const { data, error } = await query.range(0, 4000);
    if (error) return { error };

    const formattedData = (data || []).map(p => ({
      id: p.id,
      value: p.id,
      label: `${p.medical_record_number || 'RM'} - ${p.full_name}`,
      full_name: p.full_name,
      medical_record_number: p.medical_record_number,
      phone: p.phone
    }));

    return { data: formattedData, error: null };
  }, 'getPatients', { retry: true });
};
export const searchPatientByBirthDateAndLastName = async (fullName, birthDate) => {
  return safeQuery(async () => {
    if (!fullName || !birthDate) {
      return { data: null, error: { message: "Nama dan tanggal lahir wajib diisi" } };
    }

    const nameParts = fullName.trim().split(" ");
    const lastName = nameParts.length > 1
      ? nameParts[nameParts.length - 1]
      : nameParts[0];

    const { data, error } = await supabase
      .from('patients')
      .select(`
        id,
        full_name,
        birth_date,
        phone,
        medical_record_number,
        gender,
        nickname
      `)
      .eq('birth_date', birthDate)
      .ilike('full_name', `%${lastName}`)
      .eq('status', 'aktif');

    if (error) return { error };

    return { data: data || [], error: null };
  }, 'searchPatientByBirthDateAndLastName', { retry: false });
};
export const getUser = async (id) => {
  return safeQuery(async () => {
    if (id) {
        const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
        if (error) return { error };
        return { data, error: null };
    }
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return { error };
    return { data: user, error: null };
  }, 'getUser', { retry: true });
};

export const getClinicLogo = async () => {
  return safeQuery(async () => {
    const { data, error } = await supabase.from('clinic_images').select('image_url, file_name').eq('image_type', 'logo').limit(1).single();
    if (error && error.code !== 'PGRST116') return { error };
    return { data: data ? { file_url: data.image_url } : null, error: null };
  }, 'getClinicLogo', { retry: true });
};

export const createOnlinePatient = async (patientData) => {
  return safeQuery(async () => {
    return await supabase.from('patients_booking_online').insert([patientData]).select().single();
  }, 'createOnlinePatient');
};

// ============================================
// OPTIONS & CONFIG
// ============================================

export const getWhatsAppScheduleConfig = async () => { return { data: [] } };
export const getWhatsAppTemplates = async () => { return { data: [] } };
export const createWhatsAppScheduleLog = async () => { return { data: null } };
export const getServiceOptions = async (term) => {
    return getOperationalOptionsByCategory('service', term);
};
export async function getOperationalOptionsByCategory(category, searchTerm = '') {
  return safeQuery(async () => {
    try {
      let query = supabase
        .from('operational_options')
        .select('id, label, category, parent_id')
        .eq('category', category)
        .eq('is_active', true);

      if (searchTerm) {
        query = query.ilike('label', `%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) return { error };

      return {
        data: (data || []).map(i => ({
          id: i.id,
          value: i.id,
          label: i.label,
          parent_id: i.parent_id || null
        })),
        error: null
      };

    } catch (err) {
      console.error("NETWORK ERROR:", err);
      return { data: [], error: null };
    }
  }, `getOperationalOptionsByCategory:${category}`, { retry: true });
}
export const getDiagnosisOptions = async (term) => getOperationalOptionsByCategory('diagnosa', term);
export const getPatientTypeOptions = async (term) => getOperationalOptionsByCategory('patient_type', term);
export const getPackageOptions = async (term) => getOperationalOptionsByCategory('tipe_paket', term);
export const getPaymentMethodOptions = async (term) => getOperationalOptionsByCategory('payment_method', term);
export const getDiscountTypeOptions = async (term) => getOperationalOptionsByCategory('discount_type', term);

export const getAllRecapOptions = async () => {
  const { data, error } = await supabase
    .from('operational_options')
    .select('id, label')
    .eq('is_active', true); // opsional tapi bagus

  return { data, error };
};

// ============================================
// PACKAGES & RECAPS
// ============================================

export const getPatientActivePackage = async (patientId) => {
  return safeQuery(async () => {

    const { data, error } = await supabase
      .from('package_tracking')
      .select('*')
      .eq('patient_id', patientId)
      .eq('status', 'aktif')
      .gt('sessions_remaining', 0)
      .order('start_date', { ascending: false }) // 🔥 FIX DI SINI
      .limit(1)
      .maybeSingle();

    if (error) return { error };

    return { data: data || null, error: null };

  }, 'getPatientActivePackage', { retry: true });
};
export const getPatientLatestPackage = async (patientId) => {
  return safeQuery(async () => {

    const { data, error } = await supabase
      .from('package_tracking')
      .select('*')
      .eq('patient_id', patientId)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { error };

    return { data: data || null, error: null };

  }, 'getPatientLatestPackage', { retry: true });
};
export const getActivePackage = async (patientId) => {
    return getPatientActivePackage(patientId);
};

export const extendPackage = async (id, days) => {
  return safeQuery(async () => {

    // 1️⃣ Ambil data package dulu
    const { data: pkg, error: errPkg } = await supabase
      .from('package_tracking')
      .select('end_date, extended_until')
      .eq('id', id)
      .single();

    if (errPkg) throw errPkg;

    // 2️⃣ Tentukan base date (kalau sudah pernah extend pakai extended_until)
    const today = new Date();

const baseDate = pkg.extended_until
  ? new Date(pkg.extended_until)
  : new Date(pkg.end_date);

// 🔥 kalau sudah expired → pakai hari ini
if (baseDate < today) {
  baseDate.setTime(today.getTime());
}

    const newDate = new Date(baseDate);
    newDate.setDate(newDate.getDate() + days);

    // 3️⃣ Update
    const { data, error } = await supabase
      .from('package_tracking')
      .update({
        end_date: newDate.toISOString(),
        extended_until: newDate.toISOString(),
        status: 'aktif', // 🔥 WAJIB aktif lagi
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return { data };

  }, 'extendPackage');
};

export const createDailyRecap = async (payload) => {
  return safeQuery(async () => {
    const cleanedPayload = cleanDailyRecapPayload(payload);
    
    if (cleanedPayload.package_type && typeof cleanedPayload.package_type !== 'string') {
      cleanedPayload.package_type = String(cleanedPayload.package_type);
    }

    const { data, error } = await supabase.rpc(
      'create_daily_recap_with_package',
      { p_payload: cleanedPayload }
    );

    if (error) return { error };

    if (!data || !data.recap_id) {
        return { error: { message: "Gagal membuat recap: ID tidak dikembalikan oleh server." } };
    }

    return { data, error: null };

  }, 'createDailyRecap');
};

export const updateDailyRecap = async (id, payload) => {
  return safeQuery(async () => {

    const cleanedPayload = cleanDailyRecapPayload(payload);

    const { data, error } = await supabase
      .from('daily_recaps')
      .update({
        ...cleanedPayload,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return { error };

    return { data, error: null };

  }, 'updateDailyRecap');
};

export const getDailyRecaps = async ({ startDate, endDate, search = '', limit = 20, offset = 0, sort = { key: 'recap_date', direction: 'desc' } }) => {
  return safeQuery(async () => {
    let query = supabase
  .from('daily_recaps')
  .select(`
  id,
  receipt_number,
  guest_name,
  guest_phone,
  patient_id,
  actual_patient_id,
  recap_date,
  diagnosis,
  service_type,
  patient_type,
  package_type,
  package_tracking_id,
  therapist_id,
  amount,
  payment_method,
  discount_type,
  discount_value,
  created_at,

  patients!patient_id(
    id,
    full_name,
    medical_record_number,
    birth_date,
    address,
    phone
  ),
  actual_patients:patients!actual_patient_id(
    id,
    full_name,
    medical_record_number,
    birth_date,
    address,
    phone
  ),
  therapist:physiotherapists!therapist_id(
  id,
  name,
  signature_url,
  stamp_url
)
`, { count: 'exact' });

    if (startDate) {
        query = query.gte('recap_date', startDate);
    }
    if (endDate) {
        query = query.lte('recap_date', endDate);
    }

    if (search && search.trim()) {
      const q = search.trim();
      const { data: foundPatients } = await supabase.from('patients').select('id').ilike('full_name', `%${q}%`);
      const foundIds = foundPatients?.map(p => p.id) || [];
      
      if (foundIds.length > 0) {
           query = query.or(`patient_id.in.(${foundIds.join(',')}),actual_patient_id.in.(${foundIds.join(',')}),guest_name.ilike.%${q}%`);
      } else {
           query = query.ilike('guest_name', `%${q}%`);
      }
    }

    if (sort.key) {
        query = query.order(sort.key, { ascending: sort.direction === 'asc' });
    } else {
        query = query.order('recap_date', { ascending: false });
    }

    if (limit && limit !== 'all') {
      const from = offset;
      const to = offset + limit - 1;
      query = query.range(from, to);
    }

    const { data, count, error } = await query;
    
    if (error) return { error };
    
    const enrichedData = await enrichRecapsWithOptions(data);

    return { data: enrichedData, count, error: null };
  }, 'getDailyRecaps', { retry: true });
};

// ============================================
// BANK ACCOUNTS
// ============================================

export const getBankAccounts = async () => {
  return safeQuery(async () => {
    return await supabase.from('bank_accounts').select('*').order('created_at', { ascending: false });
  }, 'getBankAccounts', { retry: true });
};

export const createBankAccount = async (payload) => {
  return safeQuery(async () => {
    return await supabase.from('bank_accounts').insert([payload]).select().single();
  }, 'createBankAccount');
};

export const updateBankAccount = async (id, payload) => {
  return safeQuery(async () => {
    return await supabase.from('bank_accounts').update(payload).eq('id', id).select().single();
  }, 'updateBankAccount');
};

export const deleteBankAccount = async (id) => {
  return safeQuery(async () => {
    const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
    if (error) return { error };
    return { data: true, error: null };
  }, 'deleteBankAccount');
};

// ============================================
// STUBS FOR OTHER FUNCTIONS
// ============================================
export const getAdminAccountingReport = async () => ({ data: [] });
export const getAccountingCategories = async () => {
  return safeQuery(async () => {
    return await supabase
      .from('accounting_categories')
      .select('*')
      .order('created_at', { ascending: true });
  }, 'getAccountingCategories', { retry: true });
};
export const getAccountingSubcategories = async () => {
  return safeQuery(async () => {
    return await supabase
      .from('accounting_subcategories')
      .select(`
        *,
        parent_category:accounting_categories (
          id,
          category_name
        )
      `)
      .order('created_at', { ascending: true });
  }, 'getAccountingSubcategories', { retry: true });
};
export const createAccountingCategory = async (category_name) => {
  return safeQuery(async () => {
    return await supabase
      .from('accounting_categories')
      .insert({ category_name })
      .select()
      .single();
  }, 'createAccountingCategory');
};
export const createAccountingSubcategory = async (subcategory_name, category_id) => {
  return safeQuery(async () => {
    return await supabase
      .from('accounting_subcategories')
      .insert({
        subcategory_name,
        category_id
      })
      .select()
      .single();
  }, 'createAccountingSubcategory');
};
export const updateAccountingCategory = async (id, category_name) => {
  return safeQuery(async () => {
    return await supabase
      .from('accounting_categories')
      .update({ category_name })
      .eq('id', id)
      .select()
      .single();
  }, 'updateAccountingCategory');
};
export const updateAccountingSubcategory = async (id, subcategory_name, category_id) => {
  return safeQuery(async () => {
    return await supabase
      .from('accounting_subcategories')
      .update({
        subcategory_name,
        category_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
  }, 'updateAccountingSubcategory');
};
export const deleteAccountingCategory = async (id) => {
  return safeQuery(async () => {
    const { error } = await supabase
      .from('accounting_categories')
      .delete()
      .eq('id', id);
    if (error) return { error };
    return { success: true, error: null };
  }, 'deleteAccountingCategory');
};
export const deleteAccountingSubcategory = async (id) => {
  return safeQuery(async () => {
    const { error } = await supabase
      .from('accounting_subcategories')
      .delete()
      .eq('id', id);
    if (error) return { error };
    return { success: true, error: null };
  }, 'deleteAccountingSubcategory');
};
export const getOwnerExpenditures = async () => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('owner_expenditures')
      .select(`
        *,
        subcategory:accounting_subcategories (
          id,
          subcategory_name
        )
      `)
      .order('date', { ascending: false });

    if (error) return { error };

    return { data, success: true, error: null };
  }, 'getOwnerExpenditures', { retry: true });
};
export const getOwnerIncome = async () => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('owner_income')
      .select(`
        *,
        subcategory:accounting_subcategories (
          id,
          subcategory_name
        )
      `)
      .order('date', { ascending: false });

    if (error) return { error };

    return { data, success: true, error: null };
  }, 'getOwnerIncome', { retry: true });
};
export const getAdminExpenses = async () => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('admin_expenses')
      .select(`
        *,
        bank_accounts (
          id,
          bank_name,
          account_number,
          holder_name
        )
      `)
      .order('transaction_date', { ascending: false });
    if (error) return { error };
    return { data, success: true, error: null };
  }, 'getAdminExpenses', { retry: true });
};
export const getAdminIncome = async () => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('admin_income')
      .select('*')
      .order('date', { ascending: false });
    if (error) return { error };
    return { data, success: true, error: null };
  }, 'getAdminIncome', { retry: true });
};
export const getPatientIncomeFromPackages = async () => ({ data: [] });
export const createAdminAccount = async () => ({ data: {} });
export const getOwnerReceivables = async () => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('owner_receivables')
      .select('*')
      .order('date', { ascending: true });
    if (error) return { error };
    return { data, success: true, error: null };
  }, 'getOwnerReceivables', { retry: true });
};
export const deleteOwnerExpenditure = async (id) => {
  return safeQuery(async () => {
    const { error } = await supabase
      .from('owner_expenditures')
      .delete()
      .eq('id', id);
    if (error) return { error };
    return { success: true, error: null };
  }, 'deleteOwnerExpenditure');
};
export const deleteOwnerIncome = async (id) => {
  return safeQuery(async () => {
    const { error } = await supabase
      .from('owner_income')
      .delete()
      .eq('id', id);
    if (error) return { error };
    return { success: true, error: null };
  }, 'deleteOwnerIncome');
};
export const deleteOwnerReceivable = async (id) => {
  return safeQuery(async () => {
    const { error } = await supabase
      .from('owner_receivables')
      .delete()
      .eq('id', id);
    if (error) return { error };
    return { success: true, error: null };
  }, 'deleteOwnerReceivable');
};
export const createOwnerExpenditure = async (payload) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('owner_expenditures')
      .insert({
        date: payload.date,
        amount: payload.amount,
        category: payload.category,
        sub_category: payload.sub_category || null,   
        description: payload.description || null,
        created_by: payload.created_by || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) return { error };

    return { data, success: true, error: null };
  }, 'createOwnerExpenditure');
};
export const createOwnerIncome = async (payload) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('owner_income')
      .insert({
        date: payload.date,
        amount: payload.amount,
        category: payload.category,
        sub_category: payload.sub_category || null, 
        description: payload.description || null,
        created_by: payload.created_by || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) return { error };
    return { data, success: true, error: null };
  }, 'createOwnerIncome');
};
export const createOwnerReceivable = async (payload) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('owner_receivables')
      .insert({
        due_date: payload.due_date,
        amount: payload.amount,
        description: payload.description || null,
        status: 'unpaid',
        created_by: payload.created_by || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) return { error };
    return { data, success: true, error: null };
  }, 'createOwnerReceivable');
};
export const getExpenses = async () => ({ data: [] });
export const createExpense = async () => ({ data: {} });
export const getAdditionalIncome = async () => ({ data: [] });
export const createAdditionalIncome = async () => ({ data: {} });
export const getReceivables = async () => ({ data: [] });
export const createReceivable = async () => ({ data: {} });
export const updateReceivable = async () => ({ data: {} });
export const deleteAdminExpense = async (id) => {
  return safeQuery(async () => {
    const { error } = await supabase
      .from('admin_expenses')
      .delete()
      .eq('id', id);
    if (error) return { error };
    return { success: true, error: null };
  }, 'deleteAdminExpense');
};
export const updateAdminExpense = async (id, payload) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('admin_expenses')
      .update({
        transaction_date: payload.transaction_date,
        input_time: payload.input_time || null,
        amount: payload.amount,
        category: payload.category,
        sub_category: payload.sub_category || null,
        description: payload.description || null,
        bank_account_id: payload.bank_account_id || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) return { error };
    return { data, success: true, error: null };
  }, 'updateAdminExpense');
};
export const createAdminExpense = async (payload) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('admin_expenses')
      .insert({
        transaction_date: payload.transaction_date,
        input_time: payload.input_time || null,
        amount: payload.amount,
        category: payload.category,
        sub_category: payload.sub_category || null,
        description: payload.description || null,
        bank_account_id: payload.bank_account_id || null,
        created_by: payload.created_by || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) return { error };
    return { data, success: true, error: null };
  }, 'createAdminExpense');
};
export const deleteAdminIncome = async (id) => {
  return safeQuery(async () => {
    const { error } = await supabase
      .from('admin_income')
      .delete()
      .eq('id', id);
    if (error) return { error };
    return { success: true, error: null };
  }, 'deleteAdminIncome');
};
export const updateAdminIncome = async (id, payload) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('admin_income')
      .update({
        date: payload.date,
        amount: payload.amount,
        category: payload.category,
        description: payload.description || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) return { error };
    return { data, success: true, error: null };
  }, 'updateAdminIncome');
};
export const createAdminIncome = async (payload) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('admin_income')
      .insert({
        date: payload.date,
        amount: payload.amount,
        category: payload.category,
        description: payload.description || null,
        created_by: payload.created_by || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) return { error };
    return { data, success: true, error: null };
  }, 'createAdminIncome');
};
export const updatePackageTracking = async () => ({ data: {} });
export const deletePackageTracking = async () => ({ data: true });
export const deleteDailyRecapsByPackageType = async () => ({ data: true });
export const updatePackageSessionsUsed = async () => ({ data: {} });
export const updatePackageTrackingStatus = async () => ({ data: {} });
export const getAllPackageTrackings = async () => ({ data: [] });
export const getPackageUsageHistory = async (packageId) => {
  return safeQuery(async () => {

    const { data: history, error } = await supabase
      .from('daily_recaps')
      .select(`
        id,
        recap_date,
        session_info,
        patient:patients!patient_id (
          id,
          full_name
        ),
        actual_patient:patients!actual_patient_id (
          id,
          full_name
        ),
        therapist:physiotherapists!therapist_id (
          id,
          name
        )
      `)
      .eq('package_tracking_id', packageId)
      .order('recap_date', { ascending: true });

    if (error) return { error };

    const { data: packageInfo, error: pkgError } = await supabase
      .from('package_tracking')
      .select(`
        id,
        package_name,
        sessions_used,
        total_sessions,
        patient:patients (
          id,
          full_name
        )
      `)
      .eq('id', packageId)
      .single();

    if (pkgError) return { error: pkgError };

    return {
      data: history || [],
      packageInfo,
      error: null
    };

  }, 'getPackageUsageHistory', { retry: true });
};
export const createPackageTracking = async () => ({ data: {} });
export const recalculateAllPackageUsage = async () => ({ data: true });
export const updatePackageStatusAutomatically = async () => ({ data: true });
export const getPackageByPatientAndDate = async () => ({ data: null });
export const getFirstSessionNominalInPackage = async () => ({ data: 0 });
export const getPackageSessionCount = async () => ({ data: 0 });
export const fetchTotalPackages = async () => ({ data: 0 });
export const createBulkMedicalRecords = async () => ({ data: [] });
export const setDailyRecapStartTime = async (recapId) => {
  return safeQuery(async () => {
    return await supabase
      .from('daily_recaps')
      .update({
        start_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', recapId)
      .select()
      .single();
  }, 'setDailyRecapStartTime', { retry: true });
};
export const setDailyRecapEndTime = async (recapId) => {
  return safeQuery(async () => {
    return await supabase
      .from('daily_recaps')
      .update({
        end_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', recapId)
      .select()
      .single();
  }, 'setDailyRecapEndTime', { retry: true });
};
export const getMedicalRecordsWithPatients = async () => ({ data: [] });
export const createBulkMedicalRecordsDetailed = async () => ({ data: [] });
export const createMedicalRecordDetailed = async () => ({ data: {} });
export const updateMedicalRecordDetailed = async () => ({ data: {} });
export const getDetailedDailyRecapsWithPatients = async () => {
  try {
    const { data, error } = await supabase
      .from('daily_recaps')
      .select(`
        id,
        receipt_number,
        recap_date,
        patient_id,
        amount,
        diagnosis,
        service_type,
        therapist_name,
        package_type,
        patient_type,
        patients!actual_patient_id (
          id,
          full_name,
          created_at
        )
      `)
      .not('patient_id', 'is', null)
      .order('recap_date', { ascending: true });

    if (error) throw error;

    return { data, error: null };
  } catch (err) {
    return { data: [], error: err };
  }
};

export const getMissingRecaps = async () => ({ data: [] });
export const createMedicalRecord = async () => ({ data: {} });
export const getMedicalRecords = async () => ({ data: [] });
export const updateMedicalRecord = async () => ({ data: {} });
export const getTherapistRecaps = async () => ({ data: [] });
export const getPatientById = async (id) => {
  return safeQuery(async () => {
    const { data, error } = await supabase.from('patients').select('*').eq('id', id).single();
    if (error) return { error };
    return { data, error: null };
  }, 'getPatientById', { retry: true });
};
export const importPatientsFromCSV = async () => ({ data: { success: true, count: 0 } });
export const parseCSVForPreview = async () => ({ data: [] });
export const createPatient = async (payload) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('patients')
      .insert([payload])
      .select()
      .single();
    if (error) return { error };
    return { data, success: true, error: null };
  }, 'createPatient');
};
export const updatePatient = async (id, payload) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('patients')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) return { error };
    return { data, success: true, error: null };
  }, 'updatePatient');
};
export const deletePatient = async (id) => {
  return safeQuery(async () => {
    const { error } = await supabase
      .from('patients')
      .delete()
      .eq('id', id);
    if (error) return { error };
    return { success: true, error: null };
  }, 'deletePatient');
};
export const getTherapistPatients = async () => ({ data: [] });
export const fetchTotalPatients = async () => ({ data: 0 });
export const getRecentFollowUpLogs = async () => ({ data: [] });
export const sendPushNotification = async () => ({ data: true });
export const sendWhatsAppMessageManual = async () => ({ data: true });
export const getFollowUpQueueFiltered = async () => ({ data: [] });
export const getJadwalQueueFiltered = async () => ({ data: [] });
export const getGeneralSettings = async () => ({ data: {} });
export const getInvoiceSettings = async () => ({ data: {} });
export const getOperationalOptions = async (category) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('operational_options')
      .select('*')
      .eq('category', category)
      .order('created_at', { ascending: true });
    if (error) return { error };
    return { data, error: null };
  }, 'getOperationalOptions', { retry: true });
};
export const getAdditionalInfoOptions = async () => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('patient_info_options')
      .select('id, label')
      .eq('is_active', true)
      .order('label', { ascending: true });
    if (error) return { error };
    return { data, error: null };
  }, 'getAdditionalInfoOptions', { retry: true });
};
export const generateNickname = async () => ({ data: '' });
export const getPatientInfoOptions = async () => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('patient_info_options')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) return { error };
    return { data, error: null };
  }, 'getPatientInfoOptions', { retry: true });
};

export const createPatientInfoOption = async (label) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('patient_info_options')
      .insert({
        label: label.trim(),
        is_active: true
      })
      .select()
      .single();
    if (error) return { error };
    return { data, error: null };
  }, 'createPatientInfoOption');
};

export const updatePatientInfoOption = async (id, label) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('patient_info_options')
      .update({
        label: label.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) return { error };
    return { data, error: null };
  }, 'updatePatientInfoOption');
};

export const deletePatientInfoOption = async (id) => {
  return safeQuery(async () => {
    const { error } = await supabase
      .from('patient_info_options')
      .delete()
      .eq('id', id);
    if (error) return { error };
    return { success: true, error: null };
  }, 'deletePatientInfoOption');
};
export const createOperationalOption = async (category, label, extra = {}) => {
  return safeQuery(async () => {
    const payload = {
      category,
      label,
      is_active: true,
      ...extra
    };
    const { data, error } = await supabase
      .from('operational_options')
      .insert(payload)
      .select()
      .single();
    if (error) return { error };
    return { data, error: null };
  }, 'createOperationalOption');
};
export const updateOperationalOption = async (id, label, extra = {}) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('operational_options')
      .update({
        label,
        ...extra
      })
      .eq('id', id)
      .select()
      .single();
    if (error) return { error };
    return { data, error: null };
  }, 'updateOperationalOption');
};
export const deleteOperationalOption = async (id) => {
  return safeQuery(async () => {
    const { error } = await supabase
      .from('operational_options')
      .delete()
      .eq('id', id);
    if (error) return { error };
    return { success: true, error: null };
  }, 'deleteOperationalOption');
};
export const getAdmins = async () => ({ data: [] });
export const getCurrentClinic = async () => ({ data: {} });
export const getBadgesByOwner = async () => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData?.session?.user) {
      return { data: [], error: { message: "User not authenticated" } };
    }

    const userId = sessionData.session.user.id;

    const { data, error } = await supabase
      .from('therapist_badges_master')
      .select('*')
      .or(`owner_id.eq.${userId},owner_id.is.null`)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) return { error };

    return { data: data || [], error: null };
  }, 'getBadgesByOwner', { retry: true });
};
// ============================================
// BADGES
// ============================================

export const createBadge = async (payload) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData?.session?.user) {
      return { error: { message: "User not authenticated" } };
    }

    const userId = sessionData.session.user.id;

    const { data, error } = await supabase
      .from('therapist_badges_master')
      .insert({
        label: payload.label,
        color: payload.color,
        owner_id: userId,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) return { error };

    return { data, error: null };
  }, 'createBadge', { retry: true });
};


export const updateBadge = async (id, payload) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('therapist_badges_master')
      .update({
        label: payload.label,
        color: payload.color,
        is_active: payload.is_active ?? true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return { error };

    return { data, error: null };
  }, 'updateBadge', { retry: true });
};


export const deleteBadge = async (id) => {
  return safeQuery(async () => {

    // 1️⃣ Soft delete badge
    const { error } = await supabase
      .from('therapist_badges_master')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) return { error };

    // 2️⃣ Optional: remove badge from all therapists (cleanup)
    const { data: therapists } = await supabase
      .from('physiotherapists')
      .select('id, badges');

    if (therapists) {
      for (const therapist of therapists) {
        if (Array.isArray(therapist.badges) && therapist.badges.includes(id)) {
          const updatedBadges = therapist.badges.filter(b => b !== id);

          await supabase
            .from('physiotherapists')
            .update({ badges: updatedBadges })
            .eq('id', therapist.id);
        }
      }
    }

    return { data: true, error: null };
  }, 'deleteBadge', { retry: true });
};
export const getTherapistSchedules = async (therapistId) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('therapist_schedules')
      .select(`
        *,
        therapist_slots (*)
      `)
      .eq('therapist_id', therapistId)
      .eq('is_active', true);
    if (error) return { error };
    return { data, error: null };
  }, 'getTherapistSchedules', { retry: true });
};
export const getTherapistTimeOff = async (therapistId) => {
  return safeQuery(async () => {

    const { data, error } = await supabase
      .from('therapist_time_off')
      .select('*')
      .eq('therapist_id', therapistId)
      .order('start_date', { ascending: false });

    if (error) return { error };

    return { data, error: null };

  }, 'getTherapistTimeOff');
};
export const getTherapistPracticeHours = async () => ({ data: [] });
export const updateTherapistPracticeHours = async () => ({ data: {} });
export const savePhysiotherapist = async (payload) => {
  return safeQuery(async () => {
    if (!payload?.id) {
      return { error: { message: "Therapist ID is required" } };
    }

    const { data, error } = await supabase
      .from('physiotherapists')
      .update({
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        bio: payload.bio,
        specialization: payload.specialization,
        avatar_url: payload.avatar_url,
        is_active: payload.is_active,
        services: payload.services || [],
        salary_scheme: payload.salary_scheme,
        base_salary: payload.base_salary,
        transport_per_day: payload.transport_per_day,
        show_on_landing: payload.show_on_landing,
        show_on_booking: payload.show_on_booking,
        badges: payload.badges || [],
        updated_at: new Date().toISOString()
      })
      .eq('id', payload.id)
      .select()
      .single();

    if (error) return { error };

    return { data, error: null };
  }, 'savePhysiotherapist', { retry: true });
};
export const createTherapistAccount = async (payload, password) => {
  return safeQuery(async () => {

    if (!payload?.email || !password) {
      return { error: { message: "Email dan password wajib diisi" } };
    }

    // 1️⃣ Create Supabase Auth User
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: payload.email,
      password: password
    });

    if (authError) return { error: authError };

    const userId = authData?.user?.id;

    if (!userId) {
      return { error: { message: "Gagal membuat user auth" } };
    }

    // 2️⃣ Insert ke table physiotherapists
    const { data, error } = await supabase
      .from('physiotherapists')
      .insert({
        user_id: userId,
        clinic_id: payload.clinic_id,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        bio: payload.bio,
        specialization: payload.specialization,
        avatar_url: payload.avatar_url,
        is_active: payload.is_active ?? true,
        services: payload.services || [],
        salary_scheme: payload.salary_scheme,
        base_salary: payload.base_salary,
        transport_per_day: payload.transport_per_day,
        show_on_landing: payload.show_on_landing,
        show_on_booking: payload.show_on_booking,
        badges: payload.badges || [],
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) return { error };

    return { data, error: null };

  }, 'createTherapistAccount', { retry: false });
};
export const deletePhysiotherapist = async (id) => {
  return safeQuery(async () => {

    // Soft delete saja
    const { error } = await supabase
      .from('physiotherapists')
      .update({ is_active: false })
      .eq('id', id);

    if (error) return { error };

    return { data: true, error: null };

  }, 'deletePhysiotherapist');
};
export const uploadTherapistPhoto = async (file) => {
  return safeQuery(async () => {

    if (!file) {
      return { error: { message: "File tidak ditemukan" } };
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    // 1️⃣ Upload ke bucket therapist-photos
    const { error: uploadError } = await supabase.storage
      .from('therapist-photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) return { error: uploadError };

    // 2️⃣ Ambil public URL
    const { data: publicUrlData } = supabase.storage
      .from('therapist-photos')
      .getPublicUrl(filePath);

    return {
      url: publicUrlData.publicUrl,
      error: null
    };

  }, 'uploadTherapistPhoto', { retry: false });
};

export const addTherapistTimeOff = async (payload) => {
  return safeQuery(async () => {
    console.log("Preparing to add Therapist Time Off with original payload:", payload);

    // Get current user for tracking
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    // Construct the database payload specifically to avoid array wrap issues
    const dbPayload = {
      therapist_id: payload.therapist_id,
      start_date: payload.start_date,
      end_date: payload.end_date,
      reason: payload.reason || null,
      start_time: payload.start_time || null,
      end_time: payload.end_time || null,
      created_by: userId || null
    };

    console.log("Database Insert Payload (Object):", dbPayload);

    // Using object syntax (not array) for single insertion
    const { data, error } = await supabase
      .from('therapist_time_off')
      .insert(dbPayload)
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error in addTherapistTimeOff:", error);
      throw new Error(`Gagal menyimpan data cuti: ${error.message || error.details || 'Terjadi kesalahan tidak diketahui.'}`);
    }

    console.log("Successfully inserted time off:", data);
    return { data, error: null };
  }, 'addTherapistTimeOff');
};

export const deleteTherapistTimeOff = async (id) => {
  return safeQuery(async () => {

    const { error } = await supabase
      .from('therapist_time_off')
      .delete()
      .eq('id', id);

    if (error) return { error };

    return { data: true, error: null };

  }, 'deleteTherapistTimeOff');
};

export const createTherapistSchedule = async (payload) => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user) {
        return { 
            success: false, 
            error: { 
                code: 'UNAUTHORIZED', 
                message: 'User is not authenticated. Please log in.' 
            } 
        };
    }

    const validation = validateSchedulePayload(payload);
    if (!validation.valid) {
        return { 
            success: false, 
            error: { 
                code: 'VALIDATION_ERROR', 
                message: 'Validation failed: ' + validation.errorString 
            } 
        };
    }

    const { data, error } = await supabase
      .from('therapist_schedules')
      .insert([payload])
      .select()
      .single();

    if (error) {
      let customMessage = error.message;
      let code = error.code || 'DB_ERROR';

      if (error.code === '42501' || error.message?.toLowerCase().includes('policy')) {
         customMessage = "Anda tidak memiliki izin untuk menyimpan jadwal. Hubungi administrator.";
         code = 'RLS_ERROR';
      } else if (error.code === '23503') { 
         customMessage = "Terapis atau klinik tidak ditemukan dalam database.";
         code = 'FK_ERROR';
      } else if (error.code === '23505') { 
         customMessage = "Jadwal serupa sudah ada.";
         code = 'UNIQUE_CONSTRAINT_ERROR';
      } else if (error.code === '23502') { 
         customMessage = "Data tidak lengkap. Mohon isi semua field wajib.";
         code = 'NOT_NULL_ERROR';
      }

      return { 
        success: false, 
        error: { 
          code: code,
          message: customMessage,
          details: error.details || error.hint || null,
          originalError: error
        }
      };
    }

    return { success: true, data: data || null, error: null };

  } catch (err) {
    return { 
      success: false, 
      error: { 
        code: 'UNEXPECTED_ERROR',
        message: err.message || "Terjadi kesalahan yang tidak terduga.",
        details: err.stack
      }
    };
  }
};

export const deleteTherapistSchedule = async (id) => {
  return safeQuery(async () => {
    const { error } = await supabase
      .from('therapist_schedules')
      .delete()
      .eq('id', id);

    if (error) return { error };

    return { data: true, error: null };
  }, 'deleteTherapistSchedule');
};
export const getAllTherapistTargets = async () => ({ data: [] });
export const createTherapistTarget = async () => ({ data: {} });
export const updateTherapistTarget = async () => ({ data: {} });
export const deleteTherapistTarget = async () => ({ data: true });
export const getTherapistTargetProgress = async () => ({ data: {} });
export const getActiveTherapistTarget = async () => ({ data: null });
export const getTherapistLeaveStatus = async (therapistId, date) => {
  return safeQuery(async () => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('therapist_time_off')
      .select('*')
      .eq('therapist_id', therapistId)
      .lte('start_date', dateStr)
      .gte('end_date', dateStr)
      .maybeSingle();
      
    if (error) return { error };
    
    if (data) {
        return { isOnLeave: true, reason: data.reason, endDate: data.end_date };
    }
    return { isOnLeave: false };
  }, 'getTherapistLeaveStatus');
};
export const getClinicTherapistTargets = async () => ({ data: [] });
export const fetchTotalSessions = async () => ({ data: 0 });
export const fetchTodaySessions = async () => ({ data: 0 });
export const fetchOngoingSessions = async () => ({ data: 0 });
export const fetchCompletedSessions = async () => ({ data: 0 });
export const fetchCancelledAppointments = async () => ({ data: 0 });
export const fetchEmptySlots = async () => ({ data: 0 });
export const fetchTodaySessionsPerTherapist = async () => ({ data: [] });