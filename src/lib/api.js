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

const getTodayWITA = () => {
  const now = new Date();

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Makassar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
};
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
    'package_tracking_id',
    'bank_account_id'
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
    .in('category', ['diagnosa', 'service_type', 'patient_type', 'tipe_paket', 'service', 'payment_method']);

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

const enrichedDiagnosis = diagArray.map(d => optionsMap[d] || (isValidUUID(d) ? 'Diagnosa tidak dikenal' : d));

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
    const { startDate, endDate } = filters;
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

  const terapisName = item.appointment_data?.therapist?.name || item.therapist_name || 'Terapis Kami';
  message = message.replace(/\[terapis\]/gi, terapisName);

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

export const getFollowUpQueue = async (status = null, type = null) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    if (!userRow?.clinic_id) {
      return { data: [], success: true, error: null };
    }

    // Filter langsung pakai follow_up_queue.clinic_id (bukan inner join ke
    // patients.clinic_id) supaya reminder untuk pasien tamu/guest booking
    // (patient_id NULL, mis. dari appointment guest_name/guest_phone) tidak
    // ikut hilang — inner join sebelumnya otomatis membuang baris tanpa
    // pasangan di tabel patients.
    let query = supabase
      .from('follow_up_queue')
      .select(`
        *,
        patient:patients(
          id,
          full_name,
          phone,
          medical_record_number,
          gender,
          nickname,
          birth_date,
          clinic_id
        )
      `)
      .eq('clinic_id', userRow.clinic_id);

    // FILTER STATUS
    if (status) {
      query = query.eq('status', status);
    }

    // FILTER TYPE
    if (type) {
      query = query.eq('follow_up_type', type);
    }

    // Hanya tampilkan data hari ini (WITA, samakan dengan filter "today" di FollowUpManagementPage.jsx)
    const today = getTodayWITA();
    query = query.eq('scheduled_date', today);

    // ORDER
    query = query
      .order('scheduled_time', { ascending: true });

    const { data: queueData, error: queueError } = await query;

    if (queueError) {
      return {
        data: [],
        success: false,
        error: queueError
      };
    }

    // AMBIL APPOINTMENT DATA
    const appointmentIds = queueData
      .filter(item =>
        item.source_table === 'appointments' &&
        item.source_id
      )
      .map(item => item.source_id);

    let appointmentsMap = {};

    if (appointmentIds.length > 0) {
      const { data: appointments, error: appError } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          duration_minutes,
          therapist:physiotherapists(name)
        `)
        .in('id', appointmentIds);

      if (!appError && appointments) {
        appointmentsMap = appointments.reduce((acc, app) => {
          acc[app.id] = app;
          return acc;
        }, {});
      }
    }

    // ENRICH DATA
    const enrichedData = (queueData || []).map(item => {
      let appointmentData = null;

      if (
        item.source_table === 'appointments' &&
        item.source_id
      ) {
        appointmentData =
          appointmentsMap[item.source_id] || null;
      }

      return {
        ...item,
        patient: item.patient || item.patients || null,
        appointment_data: appointmentData
      };
    });

    return {
      data: enrichedData,
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
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    let clinicId = PUBLIC_CLINIC_ID;
    if (userId) {
      const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();
      clinicId = userRow?.clinic_id || PUBLIC_CLINIC_ID;
    }

    const { data, error } = await supabase.rpc('get_available_slots_with_status_by_date', { 
      p_date: date,
      p_clinic_id: clinicId
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
  const today = getTodayWITA();
  return getAvailableSlots(today, therapistId);
};

export const getAppointments = async (filters = {}) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    let query = supabase
      .from('appointments')
      .select(`
  *,
  patient:patients(
    id,
    full_name,
    phone,
    medical_record_number
  ),
  therapist:physiotherapists(id, name, phone, theme_color)
`)
      .eq('clinic_id', userRow?.clinic_id);

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
    console.log("PARAMS MASUK API", params);
    let finalDate =
      params.p_appointment_date ||
      params.appointmentDate    ||
      params.appointment_date   ||
      params.p_start_time       ||
      params.startTime;

    if (finalDate instanceof Date) {
      finalDate = finalDate.toISOString();
    }

    if (!finalDate) {
      throw new Error("Appointment date is required");
    }

    const payload = {
  p_therapist_id:
    params.p_therapist_id ||
    params.therapist_id ||
    params.therapistId,

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
  p_allow_overlap: params.p_allow_overlap ?? false,

  p_action_by: params.action_by ?? null,
  p_action_by_name: params.action_by_name ?? null,
  p_action_by_role: params.action_by_role ?? null,

  p_is_manual: params.p_is_manual ?? false,

  p_guest_complaint: params.p_guest_complaint || params.guestComplaint || null,
  p_guest_age: params.p_guest_age ?? params.guestAge ?? null,
  p_guest_gender: params.p_guest_gender || params.guestGender || null
};
console.log("PAYLOAD RPC FINAL", payload);

    const { data, error } = await supabase.rpc(
      "create_appointment_safe",
      payload
    );

    if (error) {
      return { error };
    }

    supabase.functions
  .invoke("process-booking-whatsapp-now", {
    body: {
      appointment_id: data,
      is_homecare: params.p_is_homecare ?? false,
      disable_whatsapp: params.p_disable_whatsapp ?? false,
    }
  })
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

export const updateAppointmentStatus = async (
  id,
  status,
  actionBy = null,
  actionByName = null,
  actionByRole = null
) => {
  return updateAppointment(id, {
    status,
    action_by: actionBy,
    action_by_name: actionByName,
    action_by_role: actionByRole
  });
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
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    return await supabase.from('physiotherapists').select('*').eq('clinic_id', userRow?.clinic_id);
  }, 'getPhysiotherapists', { retry: true });
};

const PUBLIC_CLINIC_ID = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'; // fallback untuk halaman publik tanpa login

export const getActivePhysiotherapists = async (filters = {}) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    let clinicId = PUBLIC_CLINIC_ID;
    if (userId) {
      const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();
      clinicId = userRow?.clinic_id || PUBLIC_CLINIC_ID;
    }

    let query = supabase.from('physiotherapists').select('*').eq('is_active', true).eq('clinic_id', clinicId);

    if (filters.showOnBooking) {
      query = query.eq('show_on_booking', true);
    }
    if (filters.showOnLanding) {
      query = query.eq('show_on_landing', true);
    }

    const { data, error } = await query;
    if (error) return { error };

    // `badges` is stored as an array of therapist_badges_master IDs — hydrate
    // it into {id, label, color} objects so consumers (e.g. the landing page
    // therapist cards) can render them without a second round-trip.
    const therapistsData = data || [];
    const badgeIds = new Set();
    therapistsData.forEach(t => {
      (Array.isArray(t.badges) ? t.badges : []).forEach(id => badgeIds.add(id));
    });

    let badgeMap = new Map();
    if (badgeIds.size > 0) {
      const { data: badgeRows } = await supabase
        .from('therapist_badges_master')
        .select('id, label, color')
        .in('id', Array.from(badgeIds));
      badgeMap = new Map((badgeRows || []).map(b => [b.id, b]));
    }

    therapistsData.forEach(t => {
      t.badges = (Array.isArray(t.badges) ? t.badges : [])
        .map(id => badgeMap.get(id))
        .filter(Boolean);
    });

    return { data: therapistsData, error: null };
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
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    let query = supabase
      .from('patients')
      .select('id, full_name, medical_record_number, phone')
      .eq('status', 'aktif')
      .eq('clinic_id', userRow?.clinic_id)
      .order('full_name', { ascending: true });

    if (searchTerm && searchTerm.trim()) {
      query = query.or(`full_name.ilike.%${searchTerm.trim()}%,medical_record_number.ilike.%${searchTerm.trim()}%`);
      query = query.limit(50);
    } else {
      query = query.limit(50);
    }

    const { data, error } = await query;
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

// Public-safe (no login required) — used by Smart Booking's "Pasien Lama" flow
// to recommend therapists who have treated this patient before.
export const getPatientTherapistHistory = async (patientId) => {
  return safeQuery(async () => {
    if (!patientId) return { data: [], error: null };

    const { data, error } = await supabase
      .from('appointments')
      .select('therapist_id, appointment_date, therapist:physiotherapists(id, name)')
      .eq('patient_id', patientId)
      .not('therapist_id', 'is', null)
      .order('appointment_date', { ascending: false });

    if (error) return { error };

    const byTherapist = new Map();
    (data || []).forEach(row => {
      if (!row.therapist) return;
      const existing = byTherapist.get(row.therapist_id);
      if (existing) {
        existing.count += 1;
      } else {
        byTherapist.set(row.therapist_id, {
          id: row.therapist_id,
          name: row.therapist.name,
          lastAppointmentDate: row.appointment_date,
          count: 1
        });
      }
    });

    return { data: Array.from(byTherapist.values()), error: null };
  }, 'getPatientTherapistHistory', { retry: false });
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
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

      let query = supabase
        .from('operational_options')
        .select('id, label, category, parent_id')
        .eq('category', category)
        .eq('clinic_id', userRow?.clinic_id)
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
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

  const { data, error } = await supabase
    .from('operational_options')
    .select('id, label')
    .eq('clinic_id', userRow?.clinic_id)
    .eq('is_active', true);

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
      .in('status', ['aktif', 'diperpanjang'])
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

cleanedPayload.amount_original = payload.amount_original;


    const { data, error } = await supabase
      .from('daily_recaps')
      .update({
        ...cleanedPayload,
        amount_original: payload.amount_original,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return { error };

    return { data, error: null };

  }, 'updateDailyRecap');
};

export const getDailyRecaps = async ({ 
  startDate, 
  endDate, 
  search = '', 
  therapistId = null, // 🔥 TAMBAH INI
  paymentMethod = null,
  limit = 20, 
  offset = 0, 
  sort = { key: 'recap_date', direction: 'desc' } 
}) => {
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
  amount_original,
  payment_method,
  discount_type,
  discount_value,
  discount_label,
  created_at,
  start_time,
  end_time,
  status,
  invoice_wa_status,
  invoice_wa_sent_at,
  invoice_url,
 
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
  stamp_url,
  license_number
)
`, { count: 'exact' });
 
    if (startDate) {
        query = query.gte('recap_date', startDate);
    }
    if (endDate) {
        query = query.lte('recap_date', endDate);
    }
    if (therapistId) {
  query = query.eq('therapist_id', therapistId);
}

    if (paymentMethod) {
  query = query.eq('payment_method', paymentMethod);
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

export const getDailyRecapsTotalAmount = async ({ startDate, endDate, search = '', therapistId = null, paymentMethod = null }) => {
  return safeQuery(async () => {
    
    let query = supabase.from('daily_recaps').select('amount');

    if (startDate) query = query.gte('recap_date', startDate);
    if (endDate) query = query.lte('recap_date', endDate);
    if (therapistId) query = query.eq('therapist_id', therapistId);
    if (paymentMethod) query = query.eq('payment_method', paymentMethod);

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

    const { data, error } = await query;
    if (error) return { error };
    const total = (data || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    return { data: total, error: null };
  }, 'getDailyRecapsTotalAmount', { retry: true });
};

// ============================================
// BANK ACCOUNTS
// ============================================

export const getBankAccounts = async () => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    return await supabase
      .from('bank_accounts')
      .select('*')
      .eq('clinic_id', userRow?.clinic_id)
      .order('created_at', { ascending: false });
  }, 'getBankAccounts', { retry: true });
};

// Same as getBankAccounts but joins in the real, computed balance
// (opening balance + linked income - linked expenses across every
// income/expense source, so the card actually "has a value").
export const getBankAccountsWithBalance = async () => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    return await supabase
      .from('bank_account_balances')
      .select('*')
      .eq('clinic_id', userRow?.clinic_id)
      .order('bank_name', { ascending: true });
  }, 'getBankAccountsWithBalance', { retry: true });
};

export const createBankAccount = async (payload) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    return await supabase
      .from('bank_accounts')
      .insert([{ ...payload, clinic_id: userRow?.clinic_id }])
      .select()
      .single();
  }, 'createBankAccount');
};

export const updateBankAccount = async (id, payload) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    return await supabase
      .from('bank_accounts')
      .update(payload)
      .eq('id', id)
      .eq('clinic_id', userRow?.clinic_id)
      .select()
      .single();
  }, 'updateBankAccount');
};

export const deleteBankAccount = async (id) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { error } = await supabase
      .from('bank_accounts')
      .delete()
      .eq('id', id)
      .eq('clinic_id', userRow?.clinic_id);
    if (error) return { error };
    return { data: true, error: null };
  }, 'deleteBankAccount');
};

// ============================================
// BANK ACCOUNT PAYMENT-METHOD FEES
// (e.g. patient pays via QRIS -> bank takes a % or flat Rp cut)
// ============================================

export const getBankAccountFees = async (bankAccountId = null) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    let query = supabase
      .from('bank_account_fees')
      .select('*')
      .eq('clinic_id', userRow?.clinic_id)
      .order('created_at', { ascending: true });

    if (bankAccountId) query = query.eq('bank_account_id', bankAccountId);

    return await query;
  }, 'getBankAccountFees', { retry: true });
};

export const createBankAccountFee = async (payload) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    return await supabase
      .from('bank_account_fees')
      .insert({
        clinic_id: userRow?.clinic_id,
        bank_account_id: payload.bank_account_id,
        payment_method: payload.payment_method,
        fee_type: payload.fee_type,
        fee_value: payload.fee_value,
        is_active: payload.is_active ?? true,
        created_by: userId || null
      })
      .select()
      .single();
  }, 'createBankAccountFee');
};

export const updateBankAccountFee = async (id, payload) => {
  return safeQuery(async () => {
    return await supabase
      .from('bank_account_fees')
      .update({
        payment_method: payload.payment_method,
        fee_type: payload.fee_type,
        fee_value: payload.fee_value,
        is_active: payload.is_active ?? true
      })
      .eq('id', id)
      .select()
      .single();
  }, 'updateBankAccountFee');
};

export const deleteBankAccountFee = async (id) => {
  return safeQuery(async () => {
    const { error } = await supabase.from('bank_account_fees').delete().eq('id', id);
    if (error) return { error };
    return { data: true, error: null };
  }, 'deleteBankAccountFee');
};

// ============================================
// BANK ACCOUNT BALANCE ADJUSTMENTS
// (manual correction, e.g. owner withdraws cash / fixes a stale balance)
// ============================================

export const getBankAccountAdjustments = async (bankAccountId = null) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    let query = supabase
      .from('bank_account_adjustments')
      .select('*')
      .eq('clinic_id', userRow?.clinic_id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (bankAccountId) query = query.eq('bank_account_id', bankAccountId);

    return await query;
  }, 'getBankAccountAdjustments', { retry: true });
};

export const createBankAccountAdjustment = async (payload) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    return await supabase
      .from('bank_account_adjustments')
      .insert({
        clinic_id: userRow?.clinic_id,
        bank_account_id: payload.bank_account_id,
        date: payload.date,
        amount: payload.amount,
        description: payload.description || null,
        created_by: userId || null
      })
      .select()
      .single();
  }, 'createBankAccountAdjustment');
};

export const deleteBankAccountAdjustment = async (id) => {
  return safeQuery(async () => {
    const { error } = await supabase.from('bank_account_adjustments').delete().eq('id', id);
    if (error) return { error };
    return { data: true, error: null };
  }, 'deleteBankAccountAdjustment');
};

// ============================================
// BANK TRANSFERS (antar akun bank/kas milik klinik sendiri)
// ============================================

export const getBankTransfers = async (bankAccountId = null) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    let query = supabase
      .from('bank_transfers')
      .select(`
        *,
        from_account:from_account_id ( id, bank_name, account_number ),
        to_account:to_account_id ( id, bank_name, account_number )
      `)
      .eq('clinic_id', userRow?.clinic_id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (bankAccountId) query = query.or(`from_account_id.eq.${bankAccountId},to_account_id.eq.${bankAccountId}`);

    return await query;
  }, 'getBankTransfers', { retry: true });
};

export const createBankTransfer = async (payload) => {
  return safeQuery(async () => {
    if (payload.from_account_id === payload.to_account_id) {
      return { error: { message: "Akun asal dan akun tujuan tidak boleh sama." } };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    return await supabase
      .from('bank_transfers')
      .insert({
        clinic_id: userRow?.clinic_id,
        date: payload.date,
        from_account_id: payload.from_account_id,
        to_account_id: payload.to_account_id,
        amount: payload.amount,
        description: payload.description || null,
        created_by: userId || null
      })
      .select()
      .single();
  }, 'createBankTransfer');
};

export const deleteBankTransfer = async (id) => {
  return safeQuery(async () => {
    const { error } = await supabase.from('bank_transfers').delete().eq('id', id);
    if (error) return { error };
    return { data: true, error: null };
  }, 'deleteBankTransfer');
};

// ============================================
// STUBS FOR OTHER FUNCTIONS
// ============================================
export const getAdminAccountingReport = async ({ startDate, endDate }) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    // 🔥 EXPENSE
    let expenseQuery = supabase
      .from('admin_expenses')
      .select('*')
      .eq('clinic_id', userRow?.clinic_id)
      .order('transaction_date', { ascending: false });

    if (startDate) expenseQuery = expenseQuery.gte('transaction_date', startDate);
    if (endDate) expenseQuery = expenseQuery.lte('transaction_date', endDate);

    const { data: expenses } = await expenseQuery;

    // 🔥 INCOME
    let incomeQuery = supabase
      .from('admin_income')
      .select('*')
      .eq('clinic_id', userRow?.clinic_id)
      .order('date', { ascending: false });

    if (startDate) incomeQuery = incomeQuery.gte('date', startDate);
    if (endDate) incomeQuery = incomeQuery.lte('date', endDate);

    const { data: income } = await incomeQuery;

    return {
      data: {
        total_income: income?.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0,
        total_expenses: expenses?.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0,
        expenses_breakdown: expenses || [],
        income_breakdown: income || []
      },
      error: null
    };

  }, 'getAdminAccountingReport');
};
export const getAccountingCategories = async () => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    return await supabase
      .from('accounting_categories')
      .select('*')
      .eq('clinic_id', userRow?.clinic_id)
      .order('created_at', { ascending: true });
  }, 'getAccountingCategories', { retry: true });
};
export const getAccountingSubcategories = async () => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    return await supabase
      .from('accounting_subcategories')
      .select(`
        *,
        parent_category:accounting_categories (
          id,
          category_name,
          type
        )
      `)
      .eq('clinic_id', userRow?.clinic_id)
      .order('created_at', { ascending: true });
  }, 'getAccountingSubcategories', { retry: true });
};
export const createAccountingCategory = async (category_name, type = 'expense') => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    return await supabase
      .from('accounting_categories')
      .insert({ category_name, type, clinic_id: userRow?.clinic_id })
      .select()
      .single();
  }, 'createAccountingCategory');
};
export const createAccountingSubcategory = async (subcategory_name, category_id) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    return await supabase
      .from('accounting_subcategories')
      .insert({
        subcategory_name,
        category_id,
        clinic_id: userRow?.clinic_id
      })
      .select()
      .single();
  }, 'createAccountingSubcategory');
};
export const updateAccountingCategory = async (id, category_name, type) => {
  return safeQuery(async () => {
    return await supabase
      .from('accounting_categories')
      .update({ category_name, type })
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
// Fixed cost items are meant to auto-post as an owner expenditure once their
// `post_day` has passed each month. There's no cron/edge-function in this
// project to do that on a schedule, so this runs opportunistically whenever
// the owner opens a page that needs the fixed-cost total (Fixed Cost
// manager, BEP widget) — idempotent via `last_posted_month` so it only
// posts once per item per calendar month no matter how many times it runs.
export const autoPostFixedCosts = async () => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return { data: [], error: null };
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();
    const clinicId = userRow?.clinic_id;
    if (!clinicId) return { data: [], error: null };

    const { data: items, error: fetchError } = await supabase
      .from('clinic_fixed_costs')
      .select('id, item_name, amount, post_day, last_posted_month')
      .eq('clinic_id', clinicId);
    if (fetchError) return { error: fetchError };

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const today = now.getDate();

    const due = (items || []).filter(i => {
      if (i.last_posted_month === currentMonth) return false;
      const effectiveDay = Math.min(i.post_day || 1, daysInMonth);
      return effectiveDay <= today;
    });

    const posted = [];
    for (const item of due) {
      const effectiveDay = Math.min(item.post_day || 1, daysInMonth);
      const postDate = `${currentMonth}-${String(effectiveDay).padStart(2, '0')}`;
      // eslint-disable-next-line no-await-in-loop
      const { error: insertError } = await supabase.from('owner_expenditures').insert({
        clinic_id: clinicId,
        date: postDate,
        amount: item.amount,
        category: 'FIXED COST',
        description: item.item_name,
        created_by: userId,
        created_at: new Date().toISOString()
      });
      if (insertError) continue;
      // eslint-disable-next-line no-await-in-loop
      await supabase.from('clinic_fixed_costs').update({ last_posted_month: currentMonth }).eq('id', item.id);
      posted.push(item.item_name);
    }

    return { data: posted, error: null };
  }, 'autoPostFixedCosts', { retry: false });
};

export const getOwnerExpenditures = async ({ startDate, endDate } = {}) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    let query = supabase
      .from('owner_expenditures')
      .select(`
  *,
  subcategory:sub_category (
    id,
    subcategory_name
  )
`)
      .eq('clinic_id', userRow?.clinic_id)
      .order('date', { ascending: false });

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data, error } = await query;

    if (error) return { error };

    return { data, success: true, error: null };
  }, 'getOwnerExpenditures', { retry: true });
};
export const getOwnerIncome = async ({ startDate, endDate } = {}) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    let query = supabase
      .from('owner_income')
      .select(`
  *,
  subcategory:sub_category (
    id,
    subcategory_name
  )
`)
      .eq('clinic_id', userRow?.clinic_id)
      .order('date', { ascending: false });

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data, error } = await query;

    if (error) return { error };

    return { data, success: true, error: null };
  }, 'getOwnerIncome', { retry: true });
};
export const getAdminExpenses = async ({ startDate, endDate } = {}) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    let query = supabase
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
      .eq('clinic_id', userRow?.clinic_id)
      .order('transaction_date', { ascending: false });

    if (startDate) {
      query = query.gte('transaction_date', startDate);
    }

    if (endDate) {
      query = query.lte('transaction_date', endDate);
    }

    const { data, error } = await query;

    if (error) return { error };

    // 🔥 ambil subcategory manual
    const { data: subcategories } = await supabase
      .from('accounting_subcategories')
      .select('id, subcategory_name');

    const subMap = (subcategories || []).reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});

    const enriched = (data || []).map(item => ({
      ...item,
      subcategory: item.sub_category
        ? subMap[item.sub_category] || null
        : null
    }));

    return {
      data: enriched,
      success: true,
      error: null
    };

  }, 'getAdminExpenses', { retry: true });
};
export const getAdminIncome = async ({ startDate, endDate } = {}) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    let query = supabase
      .from('admin_income')
      .select('*')
      .eq('clinic_id', userRow?.clinic_id)
      .order('date', { ascending: false });

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) return { error };

    // 🔥 ambil semua subcategory manual
    const { data: subcategories } = await supabase
      .from('accounting_subcategories')
      .select('id, subcategory_name');

    const subMap = (subcategories || []).reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});

    const enriched = (data || []).map(item => ({
      ...item,
      subcategory: item.sub_category
        ? subMap[item.sub_category] || null
        : null
    }));

    return {
      data: enriched,
      success: true,
      error: null
    };

  }, 'getAdminIncome', { retry: true });
};
export const getPatientIncomeFromPackages = async ({ startDate, endDate } = {}) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    let query = supabase
      .from('daily_recaps')
      .select(`
        id,
        recap_date,
        amount,
        amount_package,
        package_type,
        patient_type,
        guest_name,

        patient:patients!patient_id (
          id,
          full_name
        ),

        actual_patient:patients!actual_patient_id (
          id,
          full_name
        )
      `)
      .eq('clinic_id', userRow?.clinic_id)
      .or('amount.not.is.null,amount_package.not.is.null')
      .order('recap_date', { ascending: false });

    if (startDate) {
      query = query.gte('recap_date', startDate);
    }

    if (endDate) {
      query = query.lte('recap_date', endDate);
    }

    const { data, error } = await query;

    if (error) return { error };

    // 🔥 ambil label operational options
    const { data: options } = await supabase
      .from('operational_options')
      .select('id, label')
      .eq('is_active', true);

    const optionsMap = (options || []).reduce((acc, item) => {
      acc[item.id] = item.label;
      return acc;
    }, {});

    const formatted = (data || []).map(item => ({
      id: item.id,

      date: item.recap_date,

      patient_name:
        item.actual_patient?.full_name ||
        item.patient?.full_name ||
        item.guest_name ||
        'Tanpa Nama',

      patient_type:
        optionsMap[item.patient_type] ||
        item.patient_type ||
        '-',

      package_name:
        optionsMap[item.package_type] ||
        item.package_type ||
        'Visit',

      amount:
        item.amount_package &&
        Number(item.amount_package) > 0
          ? Number(item.amount_package)
          : Number(item.amount || 0)
    }));

    return {
      data: formatted,
      success: true,
      error: null
    };

  }, 'getPatientIncomeFromPackages', { retry: true });
};
export const getOwnerReceivables = async () => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase
      .from('owner_receivables')
      .select('*')
      .eq('clinic_id', userRow?.clinic_id)
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
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase
      .from('owner_expenditures')
      .insert({
        clinic_id: userRow?.clinic_id,
        date: payload.date,
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
  }, 'createOwnerExpenditure');
};
export const createOwnerIncome = async (payload) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase
      .from('owner_income')
      .insert({
        clinic_id: userRow?.clinic_id,
        date: payload.date,
        amount: payload.amount,
        category: payload.category,
        sub_category: payload.sub_category || null,
        description: payload.description || null,
        bank_account_id: payload.bank_account_id || null,
        payment_method: payload.payment_method || null,
        created_by: payload.created_by || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) return { error };
    return { data, success: true, error: null };
  }, 'createOwnerIncome');
};
// ============================================
// OWNER MODAL AWAL (INITIAL CAPITAL)
// ============================================
export const getOwnerInitialCapital = async ({ startDate, endDate } = {}) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    let query = supabase
      .from('owner_initial_capital')
      .select(`
        *,
        bank_account:bank_account_id (
          id,
          bank_name,
          account_number,
          holder_name
        )
      `)
      .eq('clinic_id', userRow?.clinic_id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);

    const { data, error } = await query;
    if (error) return { error };
    return { data, success: true, error: null };
  }, 'getOwnerInitialCapital', { retry: true });
};

export const createOwnerInitialCapital = async (payload) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase
      .from('owner_initial_capital')
      .insert({
        clinic_id: userRow?.clinic_id,
        date: payload.date,
        amount: payload.amount,
        source: payload.source,
        description: payload.description || null,
        bank_account_id: payload.bank_account_id || null,
        created_by: userId || null,
        created_at: new Date().toISOString()
      })
      .select(`
        *,
        bank_account:bank_account_id (
          id,
          bank_name,
          account_number,
          holder_name
        )
      `)
      .single();

    if (error) return { error };
    return { data, success: true, error: null };
  }, 'createOwnerInitialCapital');
};

export const updateOwnerInitialCapital = async (id, payload) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase
      .from('owner_initial_capital')
      .update({
        date: payload.date,
        amount: payload.amount,
        source: payload.source,
        description: payload.description || null,
        bank_account_id: payload.bank_account_id || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('clinic_id', userRow?.clinic_id)
      .select(`
        *,
        bank_account:bank_account_id (
          id,
          bank_name,
          account_number,
          holder_name
        )
      `)
      .single();

    if (error) return { error };
    return { data, success: true, error: null };
  }, 'updateOwnerInitialCapital');
};

export const deleteOwnerInitialCapital = async (id) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { error } = await supabase
      .from('owner_initial_capital')
      .delete()
      .eq('id', id)
      .eq('clinic_id', userRow?.clinic_id);
    if (error) return { error };
    return { success: true, error: null };
  }, 'deleteOwnerInitialCapital');
};

export const createOwnerReceivable = async (payload) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase
      .from('owner_receivables')
      .insert({
        clinic_id: userRow?.clinic_id,
        custom_name: payload.custom_name,
        date: payload.date,
        amount: payload.amount,
        description: payload.description || null,
        status: 'pending',
        created_by: payload.created_by || userId || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) return { error };
    return { data, success: true, error: null };
  }, 'createOwnerReceivable');
};

// Mark a receivable as settled (status -> 'paid') and, when a bank account is
// given, count the amount as an inflow to that account's computed balance.
// Can also be used for a plain edit (amount/description/custom_name) or to
// cancel it (status -> 'cancelled').
export const updateOwnerReceivable = async (id, payload) => {
  return safeQuery(async () => {
    const updatePayload = {
      updated_at: new Date().toISOString()
    };
    if (payload.custom_name !== undefined) updatePayload.custom_name = payload.custom_name;
    if (payload.date !== undefined) updatePayload.date = payload.date;
    if (payload.amount !== undefined) updatePayload.amount = payload.amount;
    if (payload.description !== undefined) updatePayload.description = payload.description || null;
    if (payload.status !== undefined) updatePayload.status = payload.status;
    if (payload.bank_account_id !== undefined) updatePayload.bank_account_id = payload.bank_account_id || null;
    if (payload.paid_date !== undefined) updatePayload.paid_date = payload.paid_date || null;

    const { data, error } = await supabase
      .from('owner_receivables')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
    if (error) return { error };
    return { data, success: true, error: null };
  }, 'updateOwnerReceivable');
};
// ============================================
// OWNER ACCOUNTING (FIXED - NO MORE DUMMY)
// ============================================

// 🔹 GET OWNER EXPENSES
export const getExpenses = async () => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase
      .from('owner_expenditures')
      .select(`
  *,
  subcategory:sub_category (
    id,
    subcategory_name
  )
`)
      .eq('clinic_id', userRow?.clinic_id)
      .order('date', { ascending: false });

    if (error) return { error };

    return { data, success: true, error: null };
  }, 'getExpenses', { retry: true });
};


// 🔹 CREATE OWNER EXPENSE
export const createExpense = async (payload) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase
      .from('owner_expenditures')
      .insert({
        clinic_id: userRow?.clinic_id,
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
  }, 'createExpense');
};


// 🔹 GET OWNER INCOME
export const getAdditionalIncome = async () => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase
      .from('owner_income')
      .select(`
  *,
  subcategory:sub_category (
    id,
    subcategory_name
  )
`)
      .eq('clinic_id', userRow?.clinic_id)
      .order('date', { ascending: false });

    if (error) return { error };

    return { data, success: true, error: null };
  }, 'getAdditionalIncome', { retry: true });
};


// 🔹 CREATE OWNER INCOME
export const createAdditionalIncome = async (payload) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase
      .from('owner_income')
      .insert({
        clinic_id: userRow?.clinic_id,
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
  }, 'createAdditionalIncome');
};


// 🔹 GET RECEIVABLES (PIUTANG)
export const getReceivables = async () => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase
      .from('owner_receivables')
      .select('*')
      .eq('clinic_id', userRow?.clinic_id)
      .order('due_date', { ascending: true });

    if (error) return { error };

    return { data, success: true, error: null };
  }, 'getReceivables', { retry: true });
};


// 🔹 CREATE RECEIVABLE
export const createReceivable = async (payload) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase
      .from('owner_receivables')
      .insert({
        clinic_id: userRow?.clinic_id,
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
  }, 'createReceivable');
};



// 🔹 UPDATE RECEIVABLE
export const updateReceivable = async (id, payload) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('owner_receivables')
      .update({
        due_date: payload.due_date,
        amount: payload.amount,
        description: payload.description || null,
        status: payload.status || 'unpaid',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return { error };

    return { data, success: true, error: null };
  }, 'updateReceivable');
};
export const deleteAdminExpense = async (id) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    const { data: existing } = await supabase
      .from('admin_expenses')
      .select('clinic_id, amount, category')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('admin_expenses')
      .delete()
      .eq('id', id);
    if (error) return { error };

    notifyClinicOwnersAboutTransaction({
      clinicId: existing?.clinic_id,
      actorId: userId,
      action: 'delete',
      kind: 'expense',
      amount: existing?.amount,
      category: existing?.category
    });

    return { success: true, error: null };
  }, 'deleteAdminExpense');
};
export const updateAdminExpense = async (id, payload) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

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

    notifyClinicOwnersAboutTransaction({
      clinicId: data?.clinic_id,
      actorId: userId,
      action: 'update',
      kind: 'expense',
      amount: data?.amount,
      category: data?.category
    });

    return { data, success: true, error: null };
  }, 'updateAdminExpense');
};
export const createAdminExpense = async (payload) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase
      .from('admin_expenses')
      .insert({
        clinic_id: userRow?.clinic_id,
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

    notifyClinicOwnersAboutTransaction({
      clinicId: userRow?.clinic_id,
      actorId: userId,
      action: 'create',
      kind: 'expense',
      amount: data?.amount,
      category: data?.category
    });

    return { data, success: true, error: null };
  }, 'createAdminExpense');
};
// ==================== INVENTORY / STOK GUDANG ====================

export const getInventoryItems = async ({ activeOnly = true } = {}) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    let query = supabase.from('inventory_items').select('*').eq('clinic_id', userRow?.clinic_id);
    if (activeOnly) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) return { error };

    // Urutkan alfabetis, tapi barang dengan stok habis (0 atau kurang) ditaruh paling bawah
    const sorted = (data || []).slice().sort((a, b) => {
      const aEmpty = Number(a.current_stock) <= 0;
      const bEmpty = Number(b.current_stock) <= 0;
      if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
      return a.item_name.localeCompare(b.item_name, 'id-ID');
    });

    return { data: sorted, success: true, error: null };
  }, 'getInventoryItems');
};

export const createInventoryItem = async (payload) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const quantity = Number(payload.quantity) || 0;
    const totalPrice = Number(payload.total_price) || 0;
    const pricePerUnit = quantity > 0 ? totalPrice / quantity : 0;

    const { data: item, error } = await supabase
      .from('inventory_items')
      .insert({
        item_name: payload.item_name,
        unit: payload.unit,
        current_stock: quantity,
        price_per_unit: pricePerUnit,
        minimum_stock: payload.minimum_stock || 0,
        created_by: payload.created_by || null,
        clinic_id: userRow?.clinic_id
      })
      .select()
      .single();
    if (error) return { error };

    if (quantity > 0) {
      await supabase.from('inventory_stock_ins').insert({
        item_id: item.id,
        quantity,
        total_price: totalPrice,
        unit_price: pricePerUnit,
        purchase_date: payload.purchase_date || new Date().toISOString().slice(0, 10),
        notes: 'Stok awal',
        created_by: payload.created_by || null
      });
    }
    return { data: item, success: true, error: null };
  }, 'createInventoryItem');
};

export const updateInventoryItem = async (id, payload) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase
      .from('inventory_items')
      .update({
        item_name: payload.item_name,
        unit: payload.unit,
        minimum_stock: payload.minimum_stock,
        is_active: payload.is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('clinic_id', userRow?.clinic_id)
      .select()
      .single();
    if (error) return { error };
    return { data, success: true, error: null };
  }, 'updateInventoryItem');
};

export const deleteInventoryItem = async (id) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { error } = await supabase.from('inventory_items').delete().eq('id', id).eq('clinic_id', userRow?.clinic_id);
    if (error) return { error };
    return { success: true, error: null };
  }, 'deleteInventoryItem');
};

export const restockInventoryItem = async ({ item_id, quantity, total_price, purchase_date, notes }) => {
  return safeQuery(async () => {
    const { data, error } = await supabase.rpc('restock_inventory_item', {
      p_item_id: item_id,
      p_quantity: Number(quantity),
      p_total_price: Number(total_price),
      p_purchase_date: purchase_date || new Date().toISOString().slice(0, 10),
      p_notes: notes || null
    });
    if (error) return { error };
    return { data, success: true, error: null };
  }, 'restockInventoryItem');
};

export const takeInventoryStock = async ({ item_id, quantity, taken_date, notes }) => {
  return safeQuery(async () => {
    const { data, error } = await supabase.rpc('take_inventory_stock', {
      p_item_id: item_id,
      p_quantity: Number(quantity),
      p_taken_date: taken_date || new Date().toISOString().slice(0, 10),
      p_notes: notes || null
    });
    if (error) return { error };
    return { data, success: true, error: null };
  }, 'takeInventoryStock');
};

export const getInventoryStockIns = async ({ itemId } = {}) => {
  return safeQuery(async () => {
    let query = supabase
      .from('inventory_stock_ins')
      .select('*, inventory_items ( item_name, unit )')
      .order('purchase_date', { ascending: false });
    if (itemId) query = query.eq('item_id', itemId);
    const { data, error } = await query;
    if (error) return { error };
    return { data, success: true, error: null };
  }, 'getInventoryStockIns');
};

export const getInventoryStockOuts = async ({ startDate, endDate, itemId } = {}) => {
  return safeQuery(async () => {
    let query = supabase
      .from('inventory_stock_outs')
      .select('*, inventory_items ( item_name, unit )')
      .order('taken_date', { ascending: false });
    if (startDate) query = query.gte('taken_date', startDate);
    if (endDate) query = query.lte('taken_date', endDate);
    if (itemId) query = query.eq('item_id', itemId);
    const { data, error } = await query;
    if (error) return { error };
    return { data, success: true, error: null };
  }, 'getInventoryStockOuts');
};
export const deleteAdminIncome = async (id) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    const { data: existing } = await supabase
      .from('admin_income')
      .select('clinic_id, amount, category')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('admin_income')
      .delete()
      .eq('id', id);
    if (error) return { error };

    notifyClinicOwnersAboutTransaction({
      clinicId: existing?.clinic_id,
      actorId: userId,
      action: 'delete',
      kind: 'income',
      amount: existing?.amount,
      category: existing?.category
    });

    return { success: true, error: null };
  }, 'deleteAdminIncome');
};
export const updateAdminIncome = async (id, payload) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    const { data, error } = await supabase
      .from('admin_income')
      .update({
  date: payload.date,
  amount: payload.amount,
  category: payload.category,
  sub_category: payload.sub_category || null,
  description: payload.description || null,
  bank_account_id: payload.bank_account_id || null,
  payment_method: payload.payment_method || null,
  updated_at: new Date().toISOString()
})
      .eq('id', id)
      .select()
      .single();
    if (error) return { error };

    notifyClinicOwnersAboutTransaction({
      clinicId: data?.clinic_id,
      actorId: userId,
      action: 'update',
      kind: 'income',
      amount: data?.amount,
      category: data?.category
    });

    return { data, success: true, error: null };
  }, 'updateAdminIncome');
};
export const createAdminIncome = async (payload) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase
      .from('admin_income')
      .insert({
        clinic_id: userRow?.clinic_id,
        date: payload.date || payload.transaction_date || null,
        amount: payload.amount,
        category: payload.category,
        sub_category: payload.sub_category || null,
        description: payload.description || null,
        bank_account_id: payload.bank_account_id || null,
        payment_method: payload.payment_method || null,
        created_by: payload.created_by || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) return { error };

    notifyClinicOwnersAboutTransaction({
      clinicId: userRow?.clinic_id,
      actorId: userId,
      action: 'create',
      kind: 'income',
      amount: data?.amount,
      category: data?.category
    });

    return { data, success: true, error: null };
  }, 'createAdminIncome');
};
export const updatePackageTracking = async (id, updates) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('package_tracking')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return { error };
    return { data, success: true, error: null };
  }, 'updatePackageTracking');
};
export const deletePackageTracking = async (id) => {
  return safeQuery(async () => {
    const { error } = await supabase
      .from('package_tracking')
      .delete()
      .eq('id', id);
    if (error) return { error };
    return { data: true, error: null };
  }, 'deletePackageTracking');
};
export const deleteDailyRecapsByPackageType = async (patientId, packageName) => {
  return safeQuery(async () => {
    const { error, count } = await supabase
      .from('daily_recaps')
      .delete({ count: 'exact' })
      .eq('patient_id', patientId)
      .eq('package_type', packageName);
    if (error) return { error };
    return { data: true, count, error: null };
  }, 'deleteDailyRecapsByPackageType');
};
export const updatePackageSessionsUsed = async (id, sessionsUsed, sessionsRemaining) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('package_tracking')
      .update({
        sessions_used: sessionsUsed,
        sessions_remaining: sessionsRemaining,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) return { error };
    return { data, error: null };
  }, 'updatePackageSessionsUsed');
};
export const updatePackageTrackingStatus = async (id, status, extendedUntil = null) => {
  return safeQuery(async () => {
    const updates = { status, updated_at: new Date().toISOString() };
    if (extendedUntil !== null) updates.extended_until = extendedUntil;
    const { data, error } = await supabase
      .from('package_tracking')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) return { error };
    return { data, error: null };
  }, 'updatePackageTrackingStatus');
};
export const getAllPackageTrackings = async () => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('package_tracking')
      .select(`*, patient:patients(id, full_name, medical_record_number, phone)`)
      .order('created_at', { ascending: false });
    if (error) return { error };
    return { data, error: null };
  }, 'getAllPackageTrackings', { retry: true });
};
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
export const createPackageTracking = async (payload) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('package_tracking')
      .insert({
        ...payload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) return { error };
    return { data, error: null };
  }, 'createPackageTracking');
};
export const updatePackageStatusAutomatically = async (packageId) => {
  return safeQuery(async () => {
    const { error: rpcError } = await supabase.rpc('recalculate_package_sessions', { p_package_id: packageId });
    if (rpcError) return { error: rpcError };
    const { data, error } = await supabase
      .from('package_tracking')
      .select('*')
      .eq('id', packageId)
      .single();
    if (error) return { error };
    return { data, error: null };
  }, 'updatePackageStatusAutomatically');
};
export const getPackageByPatientAndDate = async (patientId, date) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('package_tracking')
      .select('*')
      .eq('patient_id', patientId)
      .eq('status', 'aktif')
      .gt('sessions_remaining', 0)
      .lte('start_date', date)
      .or(`extended_until.gte.${date},and(extended_until.is.null,end_date.gte.${date})`)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { error };
    return { data, error: null };
  }, 'getPackageByPatientAndDate');
};
export const getFirstSessionNominalInPackage = async (packageId) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('package_tracking')
      .select('nominal, total_sessions')
      .eq('id', packageId)
      .single();
    if (error) return { error };
    const perSession = data?.total_sessions > 0 ? Math.floor((data.nominal || 0) / data.total_sessions) : 0;
    return { data: perSession, error: null };
  }, 'getFirstSessionNominalInPackage');
};
export const getPackageSessionCount = async (packageId) => {
  return safeQuery(async () => {
    const { count, error } = await supabase
      .from('daily_recaps')
      .select('id', { count: 'exact', head: true })
      .eq('package_tracking_id', packageId);
    if (error) return { error };
    return { data: count || 0, error: null };
  }, 'getPackageSessionCount');
};
export const fetchTotalPackages = async (startDate, endDate) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    let query = supabase
      .from('daily_recaps')
      .select('package_tracking_id')
      .not('package_tracking_id', 'is', null)
      .eq('clinic_id', userRow?.clinic_id);

    if (startDate) {
      query = query.gte('recap_date', startDate);
    }

    if (endDate) {
      query = query.lte('recap_date', endDate);
    }

    const { data, error } = await query;

    if (error) return { error };

    // 🔥 UNIQUE package_tracking_id
    const uniquePackages = new Set(
      (data || []).map(d => d.package_tracking_id)
    );

    return { data: uniquePackages.size || 0 };
  }, 'fetchTotalPackages');
};
export const createBulkMedicalRecords = async (payloads) => {
  return safeQuery(async () => {
    if (!Array.isArray(payloads) || payloads.length === 0) {
      return { data: [], success: true, error: null };
    }

    const insertPayload = payloads.map(p => ({
      ...p,
      created_at: p.created_at || new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('medical_records')
      .insert(insertPayload)
      .select();

    if (error) return { error };

    return { data, success: true, error: null };
  }, 'createBulkMedicalRecords');
};
// Pastikan token auth masih fresh sebelum menulis; kalau gagal karena
// 0 baris (RLS menolak akibat sesi lama), refresh sesi lalu coba sekali lagi.
const ensureFreshSessionThenWrite = async (writeFn) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;

  if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) {
    await supabase.auth.refreshSession();
  }

  let result = await writeFn();

  if (result.error?.code === 'PGRST116') {
    await supabase.auth.refreshSession();
    result = await writeFn();
  }

  return result;
};

export const setDailyRecapStartTime = async (recapId) => {
  return safeQuery(async () => {
    return await ensureFreshSessionThenWrite(() =>
      supabase
        .from('daily_recaps')
        .update({
          start_time: new Date().toISOString(),
          status: 'ongoing', // 🔥 TAMBAHAN PENTING
          updated_at: new Date().toISOString()
        })
        .eq('id', recapId)
        .select()
        .single()
    );
  }, 'setDailyRecapStartTime', { retry: true });
};
export const setDailyRecapEndTime = async (recapId) => {
  return safeQuery(async () => {
    return await ensureFreshSessionThenWrite(() =>
      supabase
        .from('daily_recaps')
        .update({
          end_time: new Date().toISOString(),
          status: 'completed', // 🔥 TAMBAHAN
          updated_at: new Date().toISOString()
        })
        .eq('id', recapId)
        .select()
        .single()
    );
  }, 'setDailyRecapEndTime', { retry: true });
};
// ============================================
// MEDICAL RECORDS (FIXED - NO MORE DUMMY)
// ============================================


// 🔹 GET MEDICAL RECORDS + PATIENT
export const getMedicalRecordsWithPatients = async () => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    if (!userRow?.clinic_id) {
      return { data: [], success: true, error: null };
    }

    // Filter langsung via inner join ke patients.clinic_id di database,
    // bukan .in(patient_id, [...ribuan id]) yang bisa melebihi batas panjang URL
    // dan membuat query gagal diam-diam untuk klinik dengan banyak pasien (mis. >1500).
    const { data, error } = await supabase
      .from('medical_records_detailed')
      .select(`
        id,
        created_at,
        record_date,
        patient_id,
        medical_diagnosis,
        history_main_problem,
        vital_nadi,
        vital_blood_pressure,
        vital_height,
        vital_weight,
        vital_temperature,
        vital_respiration,
        vital_spo2,
        phy_quick_test,
        phy_inspection,
        phy_palpation,
        phy_endfeel,
        phy_auscultation,
        phy_rom,
        phy_anthropometry,
        phy_muscle_strength,
        phy_pain_rest,
        phy_pain_motion,
        phy_pain_pressure,
        physio_body_structure,
        physio_functional_limitation,
        physio_participation_restriction,
        specific_test,
        radiology_lab,
        treatment_goal,
        therapist_name,

        patient:patients!patient_id!inner (
          id,
          full_name,
          medical_record_number,
          phone,
          clinic_id
        )
      `)
      .eq('patient.clinic_id', userRow.clinic_id)
      .order('created_at', { ascending: false });

    console.log('MEDICAL RECORDS FETCH:', data);

    if (error) return { error };

    return {
      data,
      success: true,
      error: null
    };

  }, 'getMedicalRecordsWithPatients', { retry: true });
};


// 🔹 CREATE BULK MEDICAL RECORDS
export const createBulkMedicalRecordsDetailed = async (payloads) => {
  return safeQuery(async () => {
    if (!Array.isArray(payloads) || payloads.length === 0) {
      return { error: { message: "Payload harus berupa array dan tidak boleh kosong" } };
    }

    const insertPayload = payloads.map(p => ({
      ...p,
      created_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('medical_records_detailed')
      .insert(insertPayload)
      .select();

    if (error) return { error };

    return { data, success: true, error: null };
  }, 'createBulkMedicalRecordsDetailed');
};


// 🔹 CREATE SINGLE MEDICAL RECORD
export const createMedicalRecordDetailed = async (payload) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('medical_records_detailed')
      .insert({
        ...payload,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) return { error };

    return { data, success: true, error: null };
  }, 'createMedicalRecordDetailed');
};


// 🔹 UPDATE MEDICAL RECORD
export const updateMedicalRecordDetailed = async (id, payload) => {
  return safeQuery(async () => {

    const cleanedPayload = Object.fromEntries(
      Object.entries(payload)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => {

          if (value === '') {

            // 🔥 foreign key jangan dijadikan null
            if (
              key === 'daily_recap_id' ||
              key === 'patient_id'
            ) {
              return [key, value];
            }

            return [key, null];
          }

          return [key, value];
        })
    );

    // 🔥 WAJIB HAPUS
    delete cleanedPayload.daily_recap_id;

    cleanedPayload.updated_at = new Date().toISOString();

    console.log('FINAL UPDATE PAYLOAD:', cleanedPayload);

    const { data, error } = await supabase
      .from('medical_records_detailed')
      .update(cleanedPayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('UPDATE ERROR:', error);
      return { error };
    }

    return {
      data,
      success: true,
      error: null
    };

  }, 'updateMedicalRecordDetailed');
};
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

// ============================================
// MEDICAL RECORDS & RECAP HELPERS (FIXED)
// ============================================


// 🔹 GET MISSING RECAPS (appointment ada tapi recap belum)
export const getMissingRecaps = async ({
  startDate,
  endDate,
  therapistId
} = {}) => {
  return safeQuery(async () => {

    const resolvedStart =
      typeof startDate === 'string'
        ? startDate
        : getTodayWITA();

    const resolvedEnd =
      typeof endDate === 'string'
        ? endDate
        : resolvedStart;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    let query = supabase
      .from('appointments')
      .select(`
        id,
        patient_id,
        therapist_id,
        appointment_date,
        status,

        patient:patients(
          id,
          full_name
        ),

        therapist:physiotherapists(
          id,
          name
        )
      `)
      .eq('clinic_id', userRow?.clinic_id)
      .gte(
        'appointment_date',
        `${resolvedStart}T00:00:00`
      )
      .lte(
        'appointment_date',
        `${resolvedEnd}T23:59:59`
      )
      .in('status', [
        'confirmed',
        'rescheduled',
        'completed'
      ]);

    if (therapistId) {
      query = query.eq('therapist_id', therapistId);
    }

    const { data: appointments, error: err1 } = await query;

    if (err1) return { error: err1 };

    if (!appointments || appointments.length === 0) {
      return { data: [], error: null };
    }

    const appointmentIds = appointments.map(a => a.id);
    const { data: recaps, error: err2 } = await supabase
      .from('daily_recaps')
      .select('appointment_id')
      .in('appointment_id', appointmentIds);

    if (err2) return { error: err2 };

    const recapIds = new Set(
      (recaps || []).map(r => r.appointment_id)
    );

    const missing = appointments.filter(
      a => !recapIds.has(a.id)
    );

    return {
      data: missing,
      error: null
    };

  }, 'getMissingRecaps');
};

// 🔹 CREATE MEDICAL RECORD (simple)
export const createMedicalRecord = async (payload) => {
  return safeQuery(async () => {

    // =================================
    // EDIT MODE
    // =================================
    if (payload.id) {

      const updatePayload = {
        subjective: payload.subjective,
        objective: payload.objective,
        assessment: payload.assessment,
        plan: payload.plan,
        treatment_notes: payload.treatment_notes || null,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('medical_records')
        .update(updatePayload)
        .eq('id', payload.id)
        .select()
        .single();

      if (error) return { error };

      return {
        data,
        success: true,
        error: null
      };
    }

    // =================================
    // CREATE MODE
    // =================================

    if (!payload.daily_recap_id) {
      return {
        error: {
          message: 'daily_recap_id wajib diisi'
        }
      };
    }

    // cek duplicate
    const { data: existing } = await supabase
      .from('medical_records')
      .select('id')
      .eq('daily_recap_id', payload.daily_recap_id)
      .maybeSingle();

    if (existing) {
      return {
        error: {
          message: 'SOAP sudah ada untuk recap ini'
        }
      };
    }

    const insertPayload = {
      ...payload,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('medical_records')
      .insert(insertPayload)
      .select()
      .single();

    if (error) return { error };

    return {
      data,
      success: true,
      error: null
    };

  }, 'createMedicalRecord');
};

// 🔹 GET MEDICAL RECORDS
export const getMedicalRecords = async ({
  patientId = null,
  patientIds = null,
  therapistId = null,
  startDate = null,
  endDate = null,
  page = 1,
  limit = 20
} = {}) => {
  return safeQuery(async () => {

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('medical_records')
      .select(`
  *,
  patient:patients (
    id,
    full_name,
    medical_record_number
  ),
  daily_recap:daily_recaps (
    id,
    recap_date
  )
`, { count: 'exact' });

    // 🔥 FILTER PASIEN
    if (patientId) {
      query = query.eq('patient_id', patientId);
    }

    if (patientIds) {
      if (patientIds.length === 0) {
        return { data: [], total: 0, success: true, error: null };
      }
      query = query.in('patient_id', patientIds);
    }

    // 🔥 FILTER TERAPIS
    if (therapistId) {
      query = query.eq('created_by', therapistId);
    }

    // 🔥 FILTER TANGGAL
    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data, error, count } = await query;

    if (error) return { error };

    return {
      data: data || [],
      total: count || 0,
      success: true,
      error: null
    };

  }, 'getMedicalRecords', { retry: true });
};

// 🔹 UPDATE MEDICAL RECORD
export const updateMedicalRecord = async (id, payload) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('medical_records')
      .update({
        ...payload,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return { error };

    return { data, success: true, error: null };

  }, 'updateMedicalRecord');
};

export const deleteMedicalRecord = async (id) => {
  return safeQuery(async () => {

    const { error } = await supabase
      .from('medical_records_detailed')
      .delete()
      .eq('id', id);

    if (error) return { error };

    return {
      data: true,
      success: true,
      error: null
    };

  }, 'deleteMedicalRecord');
};
// 🔹 GET THERAPIST RECAPS
export const getTherapistRecaps = async (
  therapistId,
  filters = {}
) => {
  return safeQuery(async () => {

    const { startDate, endDate } = filters;

    let query = supabase
      .from('daily_recaps')
      .select(`
  id,
  recap_date,
  patient_id,
  amount,
  diagnosis,
  service_type,
  patient_type,
  patients!daily_recap_patient_id_fkey (
    full_name,
    medical_record_number
  )
`)
      .eq('therapist_id', therapistId)
      .order('recap_date', { ascending: false });

    if (startDate) query = query.gte('recap_date', startDate);
    if (endDate) query = query.lte('recap_date', endDate);

    const { data, error } = await query;

    if (error) return { error };

    return { data, success: true, error: null };

  }, 'getTherapistRecaps', { retry: true });
};

// 🔹 Full cross-therapist visit/diagnosis history for one patient — used by
// the therapist dashboard's "Riwayat Diagnosa Pasien" panel so a therapist
// can see every past diagnosis and which colleagues have treated this
// patient before, regardless of who is logged in.
export const getPatientClinicalHistory = async (patientId) => {
  return safeQuery(async () => {
    if (!patientId) return { data: [], error: null };

    const { data, error } = await supabase
      .from('daily_recaps')
      .select(`
  id,
  recap_date,
  diagnosis,
  service_type,
  patient_type,
  patient_id,
  actual_patient_id,
  therapist_id,
  therapist:physiotherapists!therapist_id(id, name),
  patients!patient_id(id, full_name, medical_record_number),
  actual_patients:patients!actual_patient_id(id, full_name, medical_record_number)
`)
      .or(`patient_id.eq.${patientId},actual_patient_id.eq.${patientId}`)
      .order('recap_date', { ascending: false });

    if (error) return { error };

    const enriched = await enrichRecapsWithOptions(data);
    return { data: enriched, error: null };

  }, 'getPatientClinicalHistory', { retry: true });
};

export const getPatientById = async (id) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase.from('patients').select('*').eq('id', id).eq('clinic_id', userRow?.clinic_id).single();
    if (error) return { error };
    return { data, error: null };
  }, 'getPatientById', { retry: true });
};

export const getPatientByPhone = async (phone) => {
  return safeQuery(async () => {
    if (!phone) return { data: null, error: null };
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase
      .from('patients')
      .select('id, full_name, phone')
      .eq('phone', phone)
      .eq('clinic_id', userRow?.clinic_id)
      .limit(1)
      .maybeSingle();
    if (error) return { error };
    return { data: data || null, error: null };
  }, 'getPatientByPhone', { retry: true });
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

// Bulk-insert patients (Excel/CSV import). medical_record_number is
// auto-generated per row by the DB trigger when omitted, and clinic_id is
// auto-filled from the session, same as a single createPatient.
export const bulkCreatePatients = async (rows) => {
  return safeQuery(async () => {
    if (!rows || rows.length === 0) return { data: [], success: true, error: null };
    const { data, error } = await supabase
      .from('patients')
      .insert(rows)
      .select('id, full_name, medical_record_number');
    if (error) return { error };
    return { data, success: true, error: null };
  }, 'bulkCreatePatients');
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
export const getTherapistPatients = async (therapistId) => {
  return safeQuery(async () => {
    let query = supabase
      .from('daily_recaps')
      .select(`
        patient_id,
        patients:patients (
          id,
          full_name,
          phone
        )
      `)
      .eq('therapist_id', therapistId)
      .not('patient_id', 'is', null);

    const { data, error } = await query;

    if (error) return { error };

    // 🔥 unique patient
    const uniqueMap = new Map();

    (data || []).forEach(item => {
      if (item.patient_id && item.patients) {
        uniqueMap.set(item.patient_id, item.patients);
      }
    });

    return {
      data: Array.from(uniqueMap.values())
    };
  }, 'getTherapistPatients');
};
export const fetchTotalPatients = async (startDate, endDate) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    let query = supabase
      .from('daily_recaps')
      .select('patient_id', { count: 'exact' })
      .not('patient_id', 'is', null)
      .eq('clinic_id', userRow?.clinic_id);

    if (startDate) {
      query = query.gte('recap_date', startDate);
    }

    if (endDate) {
      query = query.lte('recap_date', endDate);
    }

    const { data, error } = await query;

    if (error) return { error };

    // 🔥 ambil unique patient
    const uniquePatients = new Set(
      (data || []).map(d => d.patient_id)
    );

    return { data: uniquePatients.size || 0 };
  }, 'fetchTotalPatients');
};
export const getRecentFollowUpLogs = async () => {
  return safeQuery(async () => {

    const { data, error } = await supabase
      .from('follow_up_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return { error };

    return {
      data: data || [],
      success: true,
      error: null
    };

  }, 'getRecentFollowUpLogs', { retry: true });
};

export const sendPushNotification = async (payload) => {
  return safeQuery(async () => {

    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: payload
    });

    if (error) return { error };

    return {
      data,
      success: true,
      error: null
    };

  }, 'sendPushNotification');
};

// Kirim push notification ke semua owner sebuah klinik saat admin melakukan
// input/edit/hapus data pengeluaran atau pemasukan. Non-blocking: kegagalan
// notifikasi tidak boleh menggagalkan operasi accounting itu sendiri.
const notifyClinicOwnersAboutTransaction = async ({ clinicId, actorId, action, kind, amount, category }) => {
  try {
    if (!clinicId) return;

    const { data: owners } = await supabase
      .from('users')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('role', 'owner');

    if (!owners || owners.length === 0) return;

    let actorName = 'Admin';
    if (actorId) {
      const { data: actorRow } = await supabase.from('users').select('full_name').eq('id', actorId).single();
      if (actorRow?.full_name) actorName = actorRow.full_name;
    }

    const kindLabel = kind === 'expense' ? 'Pengeluaran' : 'Pemasukan';
    const actionVerb = { create: 'menambahkan', update: 'mengubah', delete: 'menghapus' }[action] || action;
    const actionTitle = { create: 'Baru', update: 'Diperbarui', delete: 'Dihapus' }[action] || '';
    const actionEmoji = { create: '✅', update: '✏️', delete: '🗑️' }[action] || '💰';
    const formattedAmount = `Rp ${Number(amount || 0).toLocaleString('id-ID')}`;

    const title = `${actionEmoji} ${kindLabel} ${actionTitle}`.trim();
    const body = `${actorName} ${actionVerb} ${kindLabel.toLowerCase()} ${formattedAmount}${category ? ` (${category})` : ''}`;

    await Promise.all(owners.map(owner => sendPushNotification({
      user_id: owner.id,
      title,
      body,
      url: '/owner/accounting'
    })));
  } catch (err) {
    console.warn('[notifyClinicOwnersAboutTransaction] failed:', err);
  }
};

export const sendWhatsAppMessageManual = async (payload) => {
  return safeQuery(async () => {

    console.log('WHATSAPP MANUAL:', payload);

    return {
      data: true,
      success: true,
      error: null
    };

  }, 'sendWhatsAppMessageManual');
};

// ============================================
// WHATSAPP API KEY SETTINGS (per clinic)
// ============================================
const getCurrentClinicId = async () => {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return null;
  const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();
  return userRow?.clinic_id || null;
};

export const getWaApiSettings = async () => {
  return safeQuery(async () => {
    const clinicId = await getCurrentClinicId();
    if (!clinicId) return { data: null };

    const { data, error } = await supabase
      .from('wa_settings')
      .select('id, clinic_id, enabled, api_provider, api_key, number_key, phone_number')
      .eq('clinic_id', clinicId)
      .maybeSingle();

    if (error) return { error };

    return {
      data: data || null,
      success: true,
      error: null
    };
  }, 'getWaApiSettings', { retry: true });
};

export const upsertWaApiSettings = async ({ apiKey, numberKey, phoneNumber, enabled }) => {
  return safeQuery(async () => {
    const clinicId = await getCurrentClinicId();
    if (!clinicId) return { error: { message: 'Klinik tidak ditemukan.' } };

    const payload = {
      clinic_id: clinicId,
      api_provider: 'watzap',
      api_key: apiKey,
      number_key: numberKey,
      phone_number: phoneNumber,
      enabled: enabled !== undefined ? enabled : true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('wa_settings')
      .upsert(payload, { onConflict: 'clinic_id' })
      .select()
      .maybeSingle();

    if (error) return { error };

    return {
      data,
      success: true,
      error: null
    };
  }, 'upsertWaApiSettings');
};

// ============================================
// GOOGLE DRIVE (Owner-configured upload folder)
// ============================================

export const getGoogleDriveSettings = async () => {
  return safeQuery(async () => {
    const clinicId = await getCurrentClinicId();
    if (!clinicId) return { data: null };

    const { data, error } = await supabase
      .from('google_drive_settings')
      .select('id, clinic_id, folder_id, folder_name, updated_at')
      .eq('clinic_id', clinicId)
      .maybeSingle();

    if (error) return { error };

    return { data: data || null, success: true, error: null };
  }, 'getGoogleDriveSettings', { retry: true });
};

export const upsertGoogleDriveSettings = async ({ folderId, folderName }) => {
  return safeQuery(async () => {
    const clinicId = await getCurrentClinicId();
    if (!clinicId) return { error: { message: 'Klinik tidak ditemukan.' } };

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    const payload = {
      clinic_id: clinicId,
      folder_id: folderId,
      folder_name: folderName || null,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('google_drive_settings')
      .upsert(payload, { onConflict: 'clinic_id' })
      .select()
      .maybeSingle();

    if (error) return { error };

    return { data, success: true, error: null };
  }, 'upsertGoogleDriveSettings');
};

export const getGoogleDriveConnectionStatus = async () => {
  return safeQuery(async () => {
    const { data, error } = await supabase.functions.invoke('therapist-drive-upload?action=info', {
      method: 'GET',
    });
    if (error) return { error };
    return { data, success: true, error: null };
  }, 'getGoogleDriveConnectionStatus');
};

export const startGoogleDriveOAuth = async () => {
  return safeQuery(async () => {
    const { data, error } = await supabase.functions.invoke('google-drive-oauth-start', {
      method: 'POST',
    });
    if (error) return { error };
    if (data?.error) return { error: { message: data.error } };
    return { data, success: true, error: null };
  }, 'startGoogleDriveOAuth');
};

export const uploadFileToClinicDrive = async ({ file, label }) => {
  return safeQuery(async () => {
    const formData = new FormData();
    formData.append('file', file);
    if (label) formData.append('label', label);

    const { data, error } = await supabase.functions.invoke('therapist-drive-upload', {
      body: formData,
    });

    if (error) return { error };
    if (data?.error) return { error: { message: data.error } };

    return { data, success: true, error: null };
  }, 'uploadFileToClinicDrive', { timeout: 300000 });
};

export const getMyDriveUploads = async (limit = 20) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return { data: [] };

    const { data, error } = await supabase
      .from('therapist_drive_uploads')
      .select('id, file_name, label, web_view_link, created_at')
      .eq('therapist_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return { error };

    return { data: data || [], success: true, error: null };
  }, 'getMyDriveUploads', { retry: true });
};

// Owner/Admin: lihat seluruh konten yang diunggah terapis ke Drive klinik
// (lintas terapis), dipakai untuk moderasi + hapus dari sisi Owner.
export const getClinicDriveUploads = async (limit = 100) => {
  return safeQuery(async () => {
    const clinicId = await getCurrentClinicId();
    if (!clinicId) return { data: [] };

    const { data, error } = await supabase
      .from('therapist_drive_uploads')
      .select('id, therapist_id, file_name, label, web_view_link, created_at')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return { error };

    const therapistIds = [...new Set((data || []).map(row => row.therapist_id).filter(Boolean))];
    let namesByUserId = {};
    if (therapistIds.length > 0) {
      const { data: therapists } = await supabase
        .from('physiotherapists')
        .select('user_id, name')
        .in('user_id', therapistIds);
      namesByUserId = Object.fromEntries((therapists || []).map(t => [t.user_id, t.name]));
    }

    const enriched = (data || []).map(row => ({
      ...row,
      therapist_name: namesByUserId[row.therapist_id] || 'Tidak diketahui',
    }));

    return { data: enriched, success: true, error: null };
  }, 'getClinicDriveUploads', { retry: true });
};

// Owner/Admin: hapus konten terapis dari Drive + riwayat DB melalui edge function
// (harus lewat server karena butuh refresh token akun Google Owner).
export const deleteDriveUpload = async (uploadId) => {
  return safeQuery(async () => {
    const { data, error } = await supabase.functions.invoke('therapist-drive-upload', {
      method: 'DELETE',
      body: { action: 'delete', id: uploadId },
    });
    if (error) return { error };
    if (data?.error) return { error: { message: data.error } };
    return { data, success: true, error: null };
  }, 'deleteDriveUpload');
};

// Owner/Admin: upload aset Media klinik (logo/header/footer/promo/dll) ke
// Google Drive klinik, menggantikan penyimpanan Supabase Storage sebelumnya.
export const uploadMediaAssetToDrive = async (file, category) => {
  return safeQuery(async () => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);

    const { data, error } = await supabase.functions.invoke('clinic-media-drive-upload', {
      body: formData,
    });

    if (error) return { error };
    if (data?.error) return { error: { message: data.error } };

    return { data: data.data, success: true, error: null };
  }, 'uploadMediaAssetToDrive', { timeout: 300000 });
};

// Owner/Admin: hapus aset Media yang tersimpan di Google Drive (beserta file-nya).
export const deleteMediaAssetDrive = async (assetId) => {
  return safeQuery(async () => {
    const { data, error } = await supabase.functions.invoke('clinic-media-drive-upload', {
      method: 'DELETE',
      body: { action: 'delete', id: assetId },
    });
    if (error) return { error };
    if (data?.error) return { error: { message: data.error } };
    return { data, success: true, error: null };
  }, 'deleteMediaAssetDrive');
};

// ============================================
// GOOGLE SHEETS BACKUP (Owner-configured, per clinic)
// Backup data klinik yang rapi & terpilih ke 1 Google Spreadsheet,
// supaya data tidak hilang meski terjadi masalah pada web.
// ============================================

export const GOOGLE_SHEETS_DOMAINS = [
  { key: 'patients', label: 'Data Pasien', description: 'No. RM, nama, kontak, NIK, status pasien.' },
  { key: 'appointments', label: 'Appointment', description: 'Jadwal kunjungan: pasien, terapis, layanan, status.' },
  { key: 'daily_recaps', label: 'Daily Recap', description: 'Rekap transaksi harian per kunjungan.' },
  { key: 'package_tracking', label: 'Package Recap', description: 'Riwayat & sisa sesi paket terapi pasien.' },
  { key: 'accounting', label: 'Keuangan', description: 'Pemasukan & pengeluaran Owner dan Admin.' },
  { key: 'medical_records', label: 'Rekam Medis', description: 'Ringkasan SOAP per kunjungan.' },
  { key: 'soap', label: 'SOAP (Pemeriksaan Fisioterapi)', description: 'Detail pemeriksaan fisioterapi lengkap.' },
];

export const getGoogleSheetsSettings = async () => {
  return safeQuery(async () => {
    const clinicId = await getCurrentClinicId();
    if (!clinicId) return { data: null };

    const { data, error } = await supabase
      .from('google_sheets_settings')
      .select('clinic_id, spreadsheet_id, spreadsheet_url, enabled_sheets, auto_sync_enabled, last_synced_at, last_sync_status, last_sync_error, updated_at')
      .eq('clinic_id', clinicId)
      .maybeSingle();

    if (error) return { error };
    return { data: data || null, success: true, error: null };
  }, 'getGoogleSheetsSettings', { retry: true });
};

export const updateGoogleSheetsSettings = async ({ enabledSheets, autoSyncEnabled }) => {
  return safeQuery(async () => {
    const clinicId = await getCurrentClinicId();
    if (!clinicId) return { error: { message: 'Klinik tidak ditemukan.' } };

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    const payload = {
      clinic_id: clinicId,
      enabled_sheets: enabledSheets,
      auto_sync_enabled: autoSyncEnabled,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('google_sheets_settings')
      .upsert(payload, { onConflict: 'clinic_id' })
      .select()
      .maybeSingle();

    if (error) return { error };
    return { data, success: true, error: null };
  }, 'updateGoogleSheetsSettings');
};

// supabase-js melempar FunctionsHttpError generik ("Edge Function returned a
// non-2xx status code") saat status bukan 2xx, tanpa membaca body respons.
// Pesan error asli dari edge function tersimpan di error.context (Response),
// jadi harus dibaca manual di sini supaya pesan yang ditampilkan ke user jelas.
const extractFunctionErrorMessage = async (error) => {
  if (!error) return 'Terjadi kesalahan tidak diketahui.';
  try {
    if (error.context && typeof error.context.json === 'function') {
      const body = await error.context.clone().json();
      if (body?.error) return body.error;
    }
  } catch (_e) {
    // body bukan JSON atau sudah terbaca, pakai fallback di bawah
  }
  return error.message || 'Terjadi kesalahan tidak diketahui.';
};

export const createGoogleSheetsBackup = async () => {
  return safeQuery(async () => {
    const { data, error } = await supabase.functions.invoke('google-sheets-sync', {
      body: { action: 'create' },
    });
    if (error) return { error: { message: await extractFunctionErrorMessage(error) } };
    if (data?.error) return { error: { message: data.error } };
    return { data, success: true, error: null };
  }, 'createGoogleSheetsBackup', { timeout: 120000 });
};

export const syncGoogleSheetsNow = async () => {
  return safeQuery(async () => {
    const { data, error } = await supabase.functions.invoke('google-sheets-sync', {
      body: { action: 'sync' },
    });
    if (error) return { error: { message: await extractFunctionErrorMessage(error) } };
    if (data?.error) return { error: { message: data.error } };
    return { data, success: true, error: null };
  }, 'syncGoogleSheetsNow', { timeout: 120000 });
};

// Owner: set which physiotherapists are BLOCKED from seeing a media asset in Sharing Media.
// NULL/empty = visible to all; array of physiotherapist UUIDs = hidden from those therapists.
export const updateMediaAssetAccess = async (assetId, blockedTherapistIds) => {
  return safeQuery(async () => {
    const clinicId = await getCurrentClinicId();
    if (!clinicId) return { error: { message: 'Klinik tidak ditemukan.' } };
    const { data, error } = await supabase
      .from('media_assets')
      .update({ blocked_therapist_ids: blockedTherapistIds?.length ? blockedTherapistIds : null })
      .eq('id', assetId)
      .eq('clinic_id', clinicId)
      .select()
      .single();
    if (error) return { error };
    return { data, success: true, error: null };
  }, 'updateMediaAssetAccess');
};

// ============================================
// PAYROLL (Slip Gaji Terapis)
// ============================================

export const getPayrollRecordsForTherapist = async (physiotherapistId) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('payroll_records')
      .select('*')
      .eq('physiotherapist_id', physiotherapistId)
      .order('payroll_period_start', { ascending: false });

    if (error) return { error };
    return { data: data || [], success: true, error: null };
  }, 'getPayrollRecordsForTherapist', { retry: true });
};

export const getMyPayrollRecords = async () => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return { data: [] };

    const { data: therapistRow } = await supabase
      .from('physiotherapists')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!therapistRow?.id) return { data: [] };

    const { data, error } = await supabase
      .from('payroll_records')
      .select('*')
      .eq('physiotherapist_id', therapistRow.id)
      .order('payroll_period_start', { ascending: false });

    if (error) return { error };
    return { data: data || [], success: true, error: null };
  }, 'getMyPayrollRecords', { retry: true });
};

export const upsertPayrollRecord = async (payload) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    const record = {
      physiotherapist_id: payload.physiotherapist_id,
      payroll_period_start: payload.payroll_period_start,
      payroll_period_end: payload.payroll_period_end,
      salary_scheme: payload.salary_scheme,
      base_salary: parseFloat(payload.base_salary) || 0,
      transport_per_day: parseFloat(payload.transport_per_day) || 0,
      incentive_amount: parseFloat(payload.incentive_amount) || 0,
      custom_commission: parseFloat(payload.custom_commission) || 0,
      total_salary: parseFloat(payload.total_salary) || 0,
      status: payload.status || 'paid',
    };

    let result;
    if (payload.id) {
      result = await supabase
        .from('payroll_records')
        .update(record)
        .eq('id', payload.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('payroll_records')
        .insert({ ...record, created_by: userId || null })
        .select()
        .single();
    }

    if (result.error) return { error: result.error };
    return { data: result.data, success: true, error: null };
  }, 'upsertPayrollRecord');
};

export const deletePayrollRecord = async (id) => {
  return safeQuery(async () => {
    const { error } = await supabase.from('payroll_records').delete().eq('id', id);
    if (error) return { error };
    return { success: true, error: null };
  }, 'deletePayrollRecord');
};

// ============================================
// MOU KEMITRAAN (Perjanjian Kerjasama Tahunan)
// ============================================
export const getMouDocumentsForTherapist = async (physiotherapistId) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('therapist_mou_documents')
      .select('*')
      .eq('physiotherapist_id', physiotherapistId)
      .order('period_start', { ascending: false });

    if (error) return { error };
    return { data: data || [], success: true, error: null };
  }, 'getMouDocumentsForTherapist', { retry: true });
};

export const getMyMouDocuments = async () => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return { data: [] };

    const { data: therapistRow } = await supabase
      .from('physiotherapists')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!therapistRow?.id) return { data: [] };

    const { data, error } = await supabase
      .from('therapist_mou_documents')
      .select('*')
      .eq('physiotherapist_id', therapistRow.id)
      .eq('status', 'signed')
      .order('period_start', { ascending: false });

    if (error) return { error };
    return { data: data || [], success: true, error: null };
  }, 'getMyMouDocuments', { retry: true });
};

export const upsertMouDocument = async (payload) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    const record = {
      clinic_id: payload.clinic_id,
      physiotherapist_id: payload.physiotherapist_id,
      period_number: payload.period_number,
      period_start: payload.period_start,
      period_end: payload.period_end,
      agreement_date: payload.agreement_date,
      agreement_city: payload.agreement_city,
      first_party: payload.first_party || {},
      second_party: payload.second_party || {},
      compensation: payload.compensation || {},
      document_theme: payload.document_theme || 'professional',
      updated_at: new Date().toISOString(),
    };

    let result;
    if (payload.id) {
      result = await supabase
        .from('therapist_mou_documents')
        .update(record)
        .eq('id', payload.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('therapist_mou_documents')
        .insert({ ...record, created_by: userId || null })
        .select()
        .single();
    }

    if (result.error) return { error: result.error };
    return { data: result.data, success: true, error: null };
  }, 'upsertMouDocument');
};

export const deleteMouDocument = async (id) => {
  return safeQuery(async () => {
    const { error } = await supabase.from('therapist_mou_documents').delete().eq('id', id);
    if (error) return { error };
    return { success: true, error: null };
  }, 'deleteMouDocument');
};

// Bucket privat (data gaji + identitas pribadi) — mengikuti pola pemilih-ktp,
// dibaca lewat signed URL, bukan public URL seperti bucket lainnya.
export const uploadSignedMouFile = async (file, physiotherapistId, mouId) => {
  return safeQuery(async () => {
    if (!file) return { error: { message: 'File tidak ditemukan' } };
    const ext = file.name.split('.').pop();
    const path = `${physiotherapistId}/${mouId}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('mou-documents')
      .upload(path, file, { upsert: true, contentType: file.type || 'application/pdf' });

    if (uploadError) return { error: uploadError };
    return { data: { path, name: file.name }, success: true, error: null };
  }, 'uploadSignedMouFile');
};

export const markMouAsSigned = async (mouId, { path, name }) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    const { data, error } = await supabase
      .from('therapist_mou_documents')
      .update({
        status: 'signed',
        signed_file_path: path,
        signed_file_name: name,
        signed_file_uploaded_at: new Date().toISOString(),
        signed_file_uploaded_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mouId)
      .select()
      .single();

    if (error) return { error };
    return { data, success: true, error: null };
  }, 'markMouAsSigned');
};

export const getMouSignedFileUrl = async (path) => {
  return safeQuery(async () => {
    if (!path) return { error: { message: 'Path file tidak ditemukan' } };
    const { data, error } = await supabase.storage
      .from('mou-documents')
      .createSignedUrl(path, 60 * 10);

    if (error) return { error };
    return { data: data?.signedUrl, success: true, error: null };
  }, 'getMouSignedFileUrl');
};

export const getFollowUpQueueFiltered = async ({
  status = null,
  follow_up_type = null,
  startDate = null,
  endDate = null
} = {}) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    if (!userRow?.clinic_id) {
      return { data: [], success: true, error: null };
    }

    // Filter langsung pakai follow_up_queue.clinic_id (bukan inner join ke
    // patients.clinic_id) supaya reminder untuk pasien tamu/guest booking
    // (patient_id NULL) tidak ikut hilang — lihat catatan di getFollowUpQueue.
    let query = supabase
      .from('follow_up_queue')
      .select(`
        *,
        patient:patients (
          id,
          full_name,
          phone,
          medical_record_number,
          clinic_id
        )
      `)
      .eq('clinic_id', userRow.clinic_id)
      .order('scheduled_date', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    if (follow_up_type) {
      query = query.eq('follow_up_type', follow_up_type);
    }

    if (startDate) {
      query = query.gte('scheduled_date', startDate);
    }

    if (endDate) {
      query = query.lte('scheduled_date', endDate);
    }

    const { data, error } = await query;

    if (error) return { error };

    return {
      data: data || [],
      success: true,
      error: null
    };

  }, 'getFollowUpQueueFiltered', { retry: true });
};

export const getJadwalQueueFiltered = async ({
  startDate = null,
  endDate = null,
  therapistId = null
} = {}) => {
  return safeQuery(async () => {

    let query = supabase
      .from('appointments')
      .select(`
        *,
        patient:patients (
          id,
          full_name,
          phone,
          medical_record_number
        ),
        therapist:physiotherapists (
          id,
          name,
          phone
        )
      `)
      .order('appointment_date', { ascending: true });

    if (startDate) {
      query = query.gte('appointment_date', `${startDate}T00:00:00`);
    }

    if (endDate) {
      query = query.lte('appointment_date', `${endDate}T23:59:59`);
    }

    if (therapistId) {
      query = query.eq('therapist_id', therapistId);
    }

    const { data, error } = await query;

    if (error) return { error };

    return {
      data: data || [],
      success: true,
      error: null
    };

  }, 'getJadwalQueueFiltered', { retry: true });
};

export const getGeneralSettings = async () => {
  return safeQuery(async () => {

    const { data, error } = await supabase
      .from('general_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) return { error };

    return {
      data: data || {},
      success: true,
      error: null
    };

  }, 'getGeneralSettings', { retry: true });
};

export const getInvoiceSettings = async () => {
  return safeQuery(async () => {

    const { data, error } = await supabase
      .from('invoice_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) return { error };

    return {
      data: data || {},
      success: true,
      error: null
    };

  }, 'getInvoiceSettings', { retry: true });
};
export const getOperationalOptions = async (category) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase
      .from('operational_options')
      .select('*')
      .eq('category', category)
      .eq('clinic_id', userRow?.clinic_id)
      .order('created_at', { ascending: true });
    if (error) return { error };
    return { data, error: null };
  }, 'getOperationalOptions', { retry: true });
};
export const getAdditionalInfoOptions = async () => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase
      .from('patient_info_options')
      .select('id, label')
      .eq('is_active', true)
      .eq('clinic_id', userRow?.clinic_id)
      .order('label', { ascending: true });
    if (error) return { error };
    return { data, error: null };
  }, 'getAdditionalInfoOptions', { retry: true });
};
export const generateNickname = async () => ({ data: '' });
export const getPatientInfoOptions = async () => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase
      .from('patient_info_options')
      .select('*')
      .eq('clinic_id', userRow?.clinic_id)
      .order('created_at', { ascending: true });
    if (error) return { error };
    return { data, error: null };
  }, 'getPatientInfoOptions', { retry: true });
};

export const createPatientInfoOption = async (label) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase
      .from('patient_info_options')
      .insert({
        label: label.trim(),
        is_active: true,
        clinic_id: userRow?.clinic_id
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
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const payload = {
      category,
      label,
      is_active: true,
      clinic_id: userRow?.clinic_id,
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
export const getCurrentClinic = async () => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return { data: null };

    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('clinic_id')
      .eq('id', userId)
      .single();
    if (userErr || !userRow?.clinic_id) return { data: null };

    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', userRow.clinic_id)
      .single();
    if (error) return { error };
    return { data, error: null };
  }, 'getCurrentClinic');
};

export const getAdmins = async () => {
  return safeQuery(async () => {
    const { data: clinicData } = await getCurrentClinic();
    if (!clinicData?.id) return { data: [] };

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .in('role', ['admin', 'clinic_admin'])
      .eq('clinic_id', clinicData.id)
      .order('created_at', { ascending: false });
    if (error) return { error };
    return { data: data || [], error: null };
  }, 'getAdmins');
};

export const createAdminAccount = async (payload, password) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const res = await fetch('https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/admin-create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData?.session?.access_token}` },
      body: JSON.stringify({
        email: payload.email,
        password,
        full_name: payload.full_name,
        phone: payload.phone,
        role: payload.role,
        clinic_id: payload.clinic_id,
      }),
    });
    const result = await res.json();
    if (!res.ok) return { error: { message: result.error || 'Gagal membuat akun' } };
    return { data: result, error: null };
  }, 'createAdminAccount');
};
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
        period_start_day: payload.period_start_day,
        period_end_day: payload.period_end_day,
        complaint_tags: payload.complaint_tags || [],
        show_on_landing: payload.show_on_landing,
        show_on_booking: payload.show_on_booking,
        remuneration_enabled: payload.remuneration_enabled,
        badges: payload.badges || [],
        theme_color: payload.theme_color || null,
        signature_url: payload.signature_url || null,
        join_date: payload.join_date || null,
        birth_place: payload.birth_place || null,
        birth_date: payload.birth_date || null,
        license_number: payload.license_number || null,
        gender: payload.gender || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', payload.id)
      .select()
      .single();

    if (error) return { error };

    return { data, error: null };
  }, 'savePhysiotherapist', { retry: true });
};

// ============================================
// SOAP LOCK (physiotherapist appointment lock based on unfilled SOAP)
// ============================================

export const getSoapLockSettings = async () => {
  return safeQuery(async () => {
    const { data: clinic } = await getCurrentClinic();
    if (!clinic?.id) return { data: null, error: null };

    const { data, error } = await supabase
      .from('soap_lock_settings')
      .select('*')
      .eq('clinic_id', clinic.id)
      .maybeSingle();

    if (error) return { error };

    if (data) return { data, error: null };

    // No row yet for this clinic (e.g. brand new clinic) — create a
    // disabled-by-default row so it never activates unexpectedly.
    const { data: created, error: createError } = await supabase
      .from('soap_lock_settings')
      .insert({ clinic_id: clinic.id, enabled: false, threshold_count: 5, period_days: 7 })
      .select()
      .single();

    if (createError) return { error: createError };
    return { data: created, error: null };
  }, 'getSoapLockSettings');
};

export const saveSoapLockSettings = async ({ enabled, threshold_count }) => {
  return safeQuery(async () => {
    const { data: clinic } = await getCurrentClinic();
    if (!clinic?.id) return { error: { message: 'Clinic tidak ditemukan' } };

    const { data, error } = await supabase
      .from('soap_lock_settings')
      .upsert(
        {
          clinic_id: clinic.id,
          enabled,
          threshold_count,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'clinic_id' }
      )
      .select()
      .single();

    if (error) return { error };
    return { data, error: null };
  }, 'saveSoapLockSettings');
};

export const getClinicTherapistsSoapLockStatus = async () => {
  return safeQuery(async () => {
    const { data: clinic } = await getCurrentClinic();
    if (!clinic?.id) return { data: [], error: null };

    const { data, error } = await supabase.rpc('get_clinic_therapists_soap_lock_status', {
      p_clinic_id: clinic.id
    });

    if (error) return { error };
    return { data: data || [], error: null };
  }, 'getClinicTherapistsSoapLockStatus');
};

export const getTherapistSoapLockStatus = async (therapistId) => {
  return safeQuery(async () => {
    const { data, error } = await supabase.rpc('get_therapist_soap_lock_status', {
      p_therapist_id: therapistId
    });

    if (error) return { error };
    return { data: Array.isArray(data) ? data[0] : data, error: null };
  }, 'getTherapistSoapLockStatus');
};

export const updateTherapistSoapLockOverride = async (therapistId, {
  soap_lock_exempt,
  soap_lock_custom_enabled,
  soap_lock_threshold_count
}) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('physiotherapists')
      .update({
        soap_lock_exempt,
        soap_lock_custom_enabled,
        soap_lock_threshold_count
      })
      .eq('id', therapistId)
      .select()
      .single();

    if (error) return { error };
    return { data, error: null };
  }, 'updateTherapistSoapLockOverride');
};

export const setTherapistManualUnlock = async (therapistId, unlock, { note, byName } = {}) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('physiotherapists')
      .update({
        soap_lock_manual_unlock: unlock,
        soap_lock_manual_unlock_note: unlock ? (note || null) : null,
        soap_lock_manual_unlock_by_name: unlock ? (byName || null) : null,
        soap_lock_manual_unlock_at: unlock ? new Date().toISOString() : null
      })
      .eq('id', therapistId)
      .select()
      .single();

    if (error) return { error };
    return { data, error: null };
  }, 'setTherapistManualUnlock');
};

export const createTherapistAccount = async (payload, password) => {
  return safeQuery(async () => {

    if (!payload?.email || !password) {
      return { error: { message: "Email dan password wajib diisi" } };
    }

    // 1️⃣ Insert ke physiotherapists DULU (sesi owner masih aktif)
    const { data, error } = await supabase
      .from('physiotherapists')
      .insert({
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
        period_start_day: payload.period_start_day,
        period_end_day: payload.period_end_day,
        complaint_tags: payload.complaint_tags || [],
        show_on_landing: payload.show_on_landing,
        show_on_booking: payload.show_on_booking,
        remuneration_enabled: payload.remuneration_enabled ?? true,
        badges: payload.badges || [],
        theme_color: payload.theme_color || null,
        signature_url: payload.signature_url || null,
        join_date: payload.join_date || null,
        birth_place: payload.birth_place || null,
        birth_date: payload.birth_date || null,
        license_number: payload.license_number || null,
        gender: payload.gender || null,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) return { error };

    // 2️⃣ Buat auth user via RPC (tidak mengganti sesi aktif).
    // RPC ini juga mengisi role/clinic_id/phone di public.users sendiri
    // (SECURITY DEFINER, jadi tidak terhalang RLS).
    const { error: authError } = await supabase.rpc('create_auth_user_for_therapist', {
      p_email: payload.email,
      p_password: password,
      p_therapist_id: data.id
    });

    if (authError) {
      // Data terapis sudah tersimpan, tapi akun login gagal dibuat — laporkan ke caller.
      return { data, error: authError };
    }

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
// ============================================
// THERAPIST TARGET (FIXED - NO MORE DUMMY)
// ============================================


// 🔹 GET ALL TARGETS
export const getAllTherapistTargets = async () => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase
      .from('therapist_targets')
      .select(`
        *,
        therapist:physiotherapists (
          id,
          name
        )
      `)
      .eq('clinic_id', userRow?.clinic_id)
      .order('created_at', { ascending: false });

    if (error) return { error };

    return { data, success: true, error: null };
  }, 'getAllTherapistTargets', { retry: true });
};


// 🔹 CREATE TARGET (DIRECT INSERT)
export const createTherapistTarget = async (payload) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('therapist_targets')
      .insert({
        clinic_id: payload.clinic_id || null,
        therapist_id: payload.therapist_id,
        start_date: payload.start_date,
        end_date: payload.end_date,
        target_visits: payload.target_visits,
        excluded_patient_types: payload.excluded_patient_types || []
      })
      .select()
      .single();

    if (error) return { error };

    return { data, success: true, error: null };
  }, 'createTherapistTarget');
};


// 🔹 UPDATE TARGET (RPC)
export const updateTherapistTarget = async (id, payload) => {
  return safeQuery(async () => {
    const { data, error } = await supabase.rpc('update_therapist_target', {
      p_target_id: id,
      p_target_visits: payload.target_visits,
      p_start_date: payload.start_date,
      p_end_date: payload.end_date,
      p_excluded_patient_types: payload.excluded_patient_types || []
    });

    if (error) return { error };

    return { data, success: true, error: null };
  }, 'updateTherapistTarget');
};


// 🔹 DELETE TARGET (RPC)
export const deleteTherapistTarget = async (id) => {
  return safeQuery(async () => {
    const { error } = await supabase.rpc('delete_therapist_target', {
      p_target_id: id
    });

    if (error) return { error };

    return { data: true, success: true, error: null };
  }, 'deleteTherapistTarget');
};


// 🔹 GET TARGET PROGRESS (RPC)
export const getTherapistTargetProgress = async (therapistId, startDate, endDate) => {
  return safeQuery(async () => {

    // 1. Ambil data target dari DB
    const { data: targetData, error: targetError } = await supabase
      .from('therapist_targets')
      .select('*')
      .eq('therapist_id', therapistId)
      .eq('start_date', startDate)
      .eq('end_date', endDate)
      .maybeSingle();

    if (targetError) return { error: targetError };

    const targetVisits = targetData?.target_visits || 0;
    const excludedTypes = targetData?.excluded_patient_types || [];

    // 2. Ambil recaps dalam periode, filter excluded types
    let query = supabase
      .from('daily_recaps')
      .select('id, patient_type')
      .eq('therapist_id', therapistId)
      .gte('recap_date', startDate)
      .lte('recap_date', endDate);

    const { data: recaps, error: recapsError } = await query;
    if (recapsError) return { error: recapsError };

    // 3. Filter recap yang bukan excluded type
    const filteredRecaps = (recaps || []).filter(r => {
      if (excludedTypes.length === 0) return true;
      return !excludedTypes.includes(r.patient_type);
    });

    const actualVisits = filteredRecaps.length;
    const achievement = targetVisits > 0 
      ? Math.round((actualVisits / targetVisits) * 100) 
      : 0;

    const status = achievement >= 100 ? 'TERCAPAI' 
      : achievement >= 50 ? 'BELUM TERCAPAI' 
      : 'PERLU EVALUASI';

    return {
      data: {
        target_visits: targetVisits,
        actual_visits: actualVisits,
        achievement_percentage: achievement,
        start_date: startDate,
        end_date: endDate,
        excluded_patient_types: excludedTypes,
        status
      },
      success: true,
      error: null
    };

  }, 'getTherapistTargetProgress');
};


// 🔹 GET ACTIVE TARGET (RPC)
export const getActiveTherapistTarget = async (therapistId) => {
  return safeQuery(async () => {

    const today = getTodayWITA();

    const { data, error } = await supabase
      .from('therapist_targets')
      .select('*')
      .eq('therapist_id', therapistId)
      .lte('start_date', today)
      .gte('end_date', today)
      .maybeSingle();

    if (error) return { error };

    return {
      data: data || null,
      success: true,
      error: null
    };

  }, 'getActiveTherapistTarget');
};
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
export const getClinicTherapistTargets = async (clinicId) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('therapist_targets')
      .select(`
        *,
        therapist:physiotherapists (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) return { error };

    return { data, success: true, error: null };
  }, 'getClinicTherapistTargets', { retry: true });
};
export const fetchTotalSessions = async (startDate, endDate) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    let query = supabase
      .from('daily_recaps')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', userRow?.clinic_id);

    if (startDate) {
      query = query.gte('recap_date', startDate);
    }

    if (endDate) {
      query = query.lte('recap_date', endDate);
    }

    const { count, error } = await query;

    if (error) return { error };

    return { data: count || 0 };
  }, 'fetchTotalSessions');
};
// ============================
// TODAY SESSIONS
// ============================
export const fetchTodaySessions = async () => {
  return safeQuery(async () => {
    const today = getTodayWITA();

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { count, error } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', userRow?.clinic_id)
      .gte('appointment_date', `${today}T00:00:00`)
      .lte('appointment_date', `${today}T23:59:59`)
      .in('status', ['confirmed', 'rescheduled', 'ongoing', 'completed']);

    if (error) return { error };

    return { data: count || 0 };
  }, 'fetchTodaySessions');
};

// ============================
// ONGOING SESSIONS
// ============================
export const fetchOngoingSessions = async () => {
  return safeQuery(async () => {
    const today = getTodayWITA();

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { count, error } = await supabase
      .from('daily_recaps')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', userRow?.clinic_id)
      .eq('status', 'ongoing')
      .eq('recap_date', today); // 🔥 FILTER HARI INI

    if (error) return { error };

    return { data: count || 0 };
  }, 'fetchOngoingSessions');
};

// ============================
// COMPLETED SESSIONS
// ============================
export const fetchCompletedSessions = async () => {
  return safeQuery(async () => {
    const today = getTodayWITA();

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { count, error } = await supabase
      .from('daily_recaps')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', userRow?.clinic_id)
      .eq('status', 'completed')
      .eq('recap_date', today); // 🔥 WAJIB FILTER HARI INI

    if (error) return { error };

    return { data: count || 0 };
  }, 'fetchCompletedSessions');
};

// ============================
// CANCELLED APPOINTMENTS
// ============================
export const fetchCancelledAppointments = async () => {
  return safeQuery(async () => {
    const today = getTodayWITA();

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { count, error } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', userRow?.clinic_id)
      .gte('appointment_date', `${today}T00:00:00`)
      .lte('appointment_date', `${today}T23:59:59`)
      .eq('status', 'cancelled'); // 🔥 hanya cancelled hari ini

    if (error) return { error };

    return { data: count || 0 };
  }, 'fetchCancelledAppointments');
};

// ============================
// NEW PATIENTS TODAY (guest booking, not yet linked to a patient record)
// ============================
export const fetchTodayNewPatients = async () => {
  return safeQuery(async () => {
    const today = getTodayWITA();

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { count, error } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', userRow?.clinic_id)
      .gte('appointment_date', `${today}T00:00:00`)
      .lte('appointment_date', `${today}T23:59:59`)
      .in('status', ['confirmed', 'rescheduled', 'ongoing', 'completed'])
      .is('patient_id', null); // 🔥 belum punya rekam medis = pasien baru

    if (error) return { error };

    return { data: count || 0 };
  }, 'fetchTodayNewPatients');
};

// ============================
// RETURNING PATIENTS TODAY (already has a patient record)
// ============================
export const fetchTodayReturningPatients = async () => {
  return safeQuery(async () => {
    const today = getTodayWITA();

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { count, error } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', userRow?.clinic_id)
      .gte('appointment_date', `${today}T00:00:00`)
      .lte('appointment_date', `${today}T23:59:59`)
      .in('status', ['confirmed', 'rescheduled', 'ongoing', 'completed'])
      .not('patient_id', 'is', null); // 🔥 sudah punya rekam medis = pasien lama

    if (error) return { error };

    return { data: count || 0 };
  }, 'fetchTodayReturningPatients');
};

// ============================
// EMPTY SLOTS (SIMPLE VERSION)
// ============================
export const fetchEmptySlots = async () => {
  return safeQuery(async () => {
    const today = getTodayWITA();

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase.rpc(
      'get_available_slots_with_status_by_date',
      { p_date: today, p_clinic_id: userRow?.clinic_id }
    );

    if (error) return { error };

    // 🔥 status di DB: 'aktif' = kosong
    const emptyCount = (data || []).filter(
      slot => slot.status === 'aktif'
    ).length;

    return { data: emptyCount };
  }, 'fetchEmptySlots');
};

// ============================
// TODAY SESSIONS PER THERAPIST
// ============================
export const fetchTodaySessionsPerTherapist = async (therapistId) => {
  return safeQuery(async () => {
    const today = getTodayWITA();

    const { count, error } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('therapist_id', therapistId)
      .gte('appointment_date', `${today}T00:00:00`)
      .lte('appointment_date', `${today}T23:59:59`)
      .in('status', ['confirmed', 'rescheduled', 'ongoing', 'completed']);

    if (error) return { error };

    return { data: count || 0 };
  }, 'fetchTodaySessionsPerTherapist');
};
// ============================================
// SERVICE RATES
// ============================================

export const getServiceRates = async () => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('service_rates')
      .select('*');

    if (error) return { error };

    return { data, error: null };
  }, 'getServiceRates');
};

export const createServiceRate = async (payload) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('service_rates')
      .insert([payload])
      .select()
      .single();

    if (error) return { error };

    return { data, error: null };
  }, 'createServiceRate');
};

export const updateServiceRate = async (id, rate) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('service_rates')
      .update({ rate })
      .eq('id', id)
      .select()
      .single();

    if (error) return { error };

    return { data, error: null };
  }, 'updateServiceRate');
};
// ============================================
// ADMIN DAILY CHECKLIST
// ============================================

// --- OWNER SETUP: kelola master list checklist ---
export const getAdminChecklistItemsSetup = async (assignedAdminId = null) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    let query = supabase
      .from('admin_checklist_items')
      .select('*')
      .eq('clinic_id', userRow?.clinic_id);
    query = assignedAdminId ? query.eq('assigned_admin_id', assignedAdminId) : query.is('assigned_admin_id', null);

    const { data, error } = await query
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) return { error };
    return { data: data || [], error: null };
  }, 'getAdminChecklistItemsSetup', { retry: true });
};

export const createAdminChecklistItem = async (title, description = '', assignedAdminId = null) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    let existingQuery = supabase
      .from('admin_checklist_items')
      .select('sort_order')
      .eq('clinic_id', userRow?.clinic_id);
    existingQuery = assignedAdminId ? existingQuery.eq('assigned_admin_id', assignedAdminId) : existingQuery.is('assigned_admin_id', null);
    const { data: existing } = await existingQuery
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (existing?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
      .from('admin_checklist_items')
      .insert({
        clinic_id: userRow?.clinic_id,
        title: title.trim(),
        description: description?.trim() || null,
        sort_order: nextOrder,
        is_active: true,
        assigned_admin_id: assignedAdminId || null
      })
      .select()
      .single();
    if (error) return { error };
    return { data, error: null };
  }, 'createAdminChecklistItem');
};

export const updateAdminChecklistItem = async (id, payload) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('admin_checklist_items')
      .update({
        ...payload,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) return { error };
    return { data, error: null };
  }, 'updateAdminChecklistItem');
};

export const deleteAdminChecklistItem = async (id) => {
  return safeQuery(async () => {
    const { error } = await supabase
      .from('admin_checklist_items')
      .delete()
      .eq('id', id);
    if (error) return { error };
    return { success: true, error: null };
  }, 'deleteAdminChecklistItem');
};

export const reorderAdminChecklistItem = async (id, direction, currentList) => {
  return safeQuery(async () => {
    const idx = currentList.findIndex(i => i.id === id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx === -1 || targetIdx < 0 || targetIdx >= currentList.length) {
      return { data: null, error: null };
    }
    const current = currentList[idx];
    const target = currentList[targetIdx];

    await supabase.from('admin_checklist_items').update({ sort_order: target.sort_order }).eq('id', current.id);
    await supabase.from('admin_checklist_items').update({ sort_order: current.sort_order }).eq('id', target.id);

    return { data: true, error: null };
  }, 'reorderAdminChecklistItem');
};

// --- ADMIN DASHBOARD: checklist harian ---
export const getTodayAdminChecklist = async () => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());

    const { data: items, error: itemsError } = await supabase
      .from('admin_checklist_items')
      .select('*')
      .eq('clinic_id', userRow?.clinic_id)
      .eq('is_active', true)
      .or(`assigned_admin_id.is.null,assigned_admin_id.eq.${userId}`)
      .order('sort_order', { ascending: true });
    if (itemsError) return { error: itemsError };

    const { data: completions, error: compError } = await supabase
      .from('admin_checklist_completions')
      .select('*')
      .eq('clinic_id', userRow?.clinic_id)
      .eq('checklist_date', todayStr);
    if (compError) return { error: compError };

    const compMap = (completions || []).reduce((acc, c) => {
      acc[c.item_id] = c;
      return acc;
    }, {});

    const merged = (items || []).map(item => ({
      ...item,
      is_done: compMap[item.id]?.is_done || false,
      completed_at: compMap[item.id]?.completed_at || null,
      note: compMap[item.id]?.note || ''
    }));

    return { data: merged, error: null };
  }, 'getTodayAdminChecklist', { retry: true });
};

export const toggleAdminChecklistItem = async (itemId, isDone) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());

    const { data, error } = await supabase
      .from('admin_checklist_completions')
      .upsert({
        clinic_id: userRow?.clinic_id,
        item_id: itemId,
        checklist_date: todayStr,
        is_done: isDone,
        completed_by: isDone ? userId : null,
        completed_at: isDone ? new Date().toISOString() : null
      }, { onConflict: 'item_id,checklist_date' })
      .select()
      .single();
    if (error) return { error };
    return { data, error: null };
  }, 'toggleAdminChecklistItem');
};
export const updateAdminChecklistNote = async (itemId, note) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());

    const { data, error } = await supabase
      .from('admin_checklist_completions')
      .upsert({
        clinic_id: userRow?.clinic_id,
        item_id: itemId,
        checklist_date: todayStr,
        note: note?.trim() || null
      }, { onConflict: 'item_id,checklist_date' })
      .select()
      .single();
    if (error) return { error };
    return { data, error: null };
  }, 'updateAdminChecklistNote');
};
// --- OWNER: riwayat & catatan checklist harian ---
export const getAdminChecklistHistory = async (startDate, endDate, assignedAdminId = null) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    let itemsQuery = supabase
      .from('admin_checklist_items')
      .select('*')
      .eq('clinic_id', userRow?.clinic_id);
    if (assignedAdminId) {
      itemsQuery = itemsQuery.or(`assigned_admin_id.is.null,assigned_admin_id.eq.${assignedAdminId}`);
    }
    const { data: items, error: itemsError } = await itemsQuery.order('sort_order', { ascending: true });
    if (itemsError) return { error: itemsError };

    const itemIds = (items || []).map(i => i.id);
    if (itemIds.length === 0) return { data: [], error: null };

    const { data: completions, error: compError } = await supabase
      .from('admin_checklist_completions')
      .select('*')
      .eq('clinic_id', userRow?.clinic_id)
      .in('item_id', itemIds)
      .gte('checklist_date', startDate)
      .lte('checklist_date', endDate)
      .order('checklist_date', { ascending: false });
    if (compError) return { error: compError };

    const involvedUserIds = new Set();
    (completions || []).forEach(c => { if (c.completed_by) involvedUserIds.add(c.completed_by); });
    (items || []).forEach(i => { if (i.assigned_admin_id) involvedUserIds.add(i.assigned_admin_id); });

    let usersMap = {};
    if (involvedUserIds.size > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', [...involvedUserIds]);
      usersMap = (usersData || []).reduce((acc, u) => {
        acc[u.id] = u.full_name;
        return acc;
      }, {});
    }

    const itemsMap = (items || []).reduce((acc, i) => {
      acc[i.id] = i;
      return acc;
    }, {});

    const groupedByDate = (completions || []).reduce((acc, c) => {
      const date = c.checklist_date;
      if (!acc[date]) acc[date] = [];
      const item = itemsMap[c.item_id];
      acc[date].push({
        ...c,
        item_title: item?.title || 'Task terhapus',
        item_description: item?.description || null,
        completed_by_name: c.completed_by ? (usersMap[c.completed_by] || 'Admin') : null,
        assigned_admin_id: item?.assigned_admin_id || null,
        assigned_admin_name: item?.assigned_admin_id ? (usersMap[item.assigned_admin_id] || 'Admin') : null
      });
      return acc;
    }, {});

    const result = Object.keys(groupedByDate)
      .sort((a, b) => new Date(b) - new Date(a))
      .map(date => ({ date, entries: groupedByDate[date] }));

    return { data: result, error: null };
  }, 'getAdminChecklistHistory', { retry: true });
};

// ── Clinical Documents (Resume Medis / Surat Keterangan Fisioterapi) ────────

export const getClinicDetails = async () => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();
    if (!userRow?.clinic_id) return { data: null, error: null };

    const { data, error } = await supabase
      .from('clinics')
      .select('id, name, address, phone, email, logo_url, stamp_url')
      .eq('id', userRow.clinic_id)
      .single();
    if (error) return { error };
    return { data, error: null };
  }, 'getClinicDetails', { retry: true });
};

export const createClinicalDocument = async (payload) => {
  return safeQuery(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

    const { data, error } = await supabase
      .from('clinical_documents')
      .insert([{ ...payload, clinic_id: userRow?.clinic_id, created_by: userId }])
      .select()
      .single();
    if (error) return { error };
    return { data, success: true, error: null };
  }, 'createClinicalDocument');
};

export const getClinicalDocuments = async (documentType) => {
  return safeQuery(async () => {
    const clinicId = await getCurrentClinicId();
    const { data, error } = await supabase
      .from('clinical_documents')
      .select(`
        *,
        patients:patient_id ( full_name, medical_record_number ),
        physiotherapists:therapist_id ( name )
      `)
      .eq('document_type', documentType)
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return { error };
    return { data, error: null };
  }, 'getClinicalDocuments', { retry: true });
};

export const deleteClinicalDocument = async (id) => {
  return safeQuery(async () => {
    const clinicId = await getCurrentClinicId();
    const { error } = await supabase.from('clinical_documents').delete().eq('id', id).eq('clinic_id', clinicId);
    if (error) return { error };
    return { success: true, error: null };
  }, 'deleteClinicalDocument');
};

export const getLatestClinicalDocumentForPatient = async (documentType, patientId) => {
  return safeQuery(async () => {
    const clinicId = await getCurrentClinicId();
    const { data, error } = await supabase
      .from('clinical_documents')
      .select('*')
      .eq('document_type', documentType)
      .eq('patient_id', patientId)
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { error };
    return { data, error: null };
  }, 'getLatestClinicalDocumentForPatient', { retry: true });
};

export const getNextClinicalDocumentNumber = async (documentType, prefix) => {
  return safeQuery(async () => {
    const clinicId = await getCurrentClinicId();
    const year = new Date().getFullYear();
    const { count, error } = await supabase
      .from('clinical_documents')
      .select('id', { count: 'exact', head: true })
      .eq('document_type', documentType)
      .eq('clinic_id', clinicId)
      .gte('document_date', `${year}-01-01`)
      .lte('document_date', `${year}-12-31`);
    if (error) return { error };

    const seq = String((count || 0) + 1).padStart(4, '0');
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    return { data: `${seq}/${prefix}/${month}/${year}`, error: null };
  }, 'getNextClinicalDocumentNumber', { retry: true });
};

// ============================================
// REMUNERATION (Penilaian Performa & Remunerasi Terapis)
// ============================================

export const getRemunerationCriteria = async () => {
  return safeQuery(async () => {
    const clinicId = await getCurrentClinicId();
    if (!clinicId) return { data: [] };

    const { data, error } = await supabase
      .from('remuneration_criteria')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) return { error };
    return { data: data || [], success: true, error: null };
  }, 'getRemunerationCriteria', { retry: true });
};

export const createRemunerationCriteria = async (payload) => {
  return safeQuery(async () => {
    const clinicId = await getCurrentClinicId();
    if (!clinicId) return { error: { message: 'Klinik tidak ditemukan.' } };

    const { data, error } = await supabase
      .from('remuneration_criteria')
      .insert([{
        clinic_id: clinicId,
        name: payload.name,
        metric_key: payload.metricKey || 'custom',
        target_mode: payload.targetMode || 'fixed_percent',
        target_value: payload.targetValue,
        weight_percent: payload.weightPercent,
        unit: payload.unit || '%',
        is_auto: !!payload.isAuto,
        sort_order: payload.sortOrder || 0,
      }])
      .select()
      .single();

    if (error) return { error };
    return { data, success: true, error: null };
  }, 'createRemunerationCriteria');
};

export const updateRemunerationCriteria = async (id, payload) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('remuneration_criteria')
      .update({
        name: payload.name,
        target_mode: payload.targetMode,
        target_value: payload.targetValue,
        weight_percent: payload.weightPercent,
        unit: payload.unit,
        is_active: payload.isActive,
        sort_order: payload.sortOrder,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return { error };
    return { data, success: true, error: null };
  }, 'updateRemunerationCriteria');
};

export const deleteRemunerationCriteria = async (id) => {
  return safeQuery(async () => {
    const { error } = await supabase
      .from('remuneration_criteria')
      .delete()
      .eq('id', id);

    if (error) return { error };
    return { data: true, success: true, error: null };
  }, 'deleteRemunerationCriteria');
};

export const getRemunerationRealizations = async (therapistId, periodStart, periodEnd) => {
  return safeQuery(async () => {
    const { data, error } = await supabase
      .from('remuneration_realizations')
      .select('*')
      .eq('therapist_id', therapistId)
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd);

    if (error) return { error };
    return { data: data || [], success: true, error: null };
  }, 'getRemunerationRealizations', { retry: true });
};

export const upsertRemunerationRealization = async ({ therapistId, criteriaId, periodStart, periodEnd, value, proofUrl, note }) => {
  return safeQuery(async () => {
    const clinicId = await getCurrentClinicId();
    if (!clinicId) return { error: { message: 'Klinik tidak ditemukan.' } };

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    const payload = {
      clinic_id: clinicId,
      therapist_id: therapistId,
      criteria_id: criteriaId,
      period_start: periodStart,
      period_end: periodEnd,
      realization_value: value,
      proof_url: proofUrl || null,
      note: note || null,
      input_by: userId || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('remuneration_realizations')
      .upsert(payload, { onConflict: 'criteria_id,therapist_id,period_start,period_end' })
      .select()
      .maybeSingle();

    if (error) return { error };
    return { data, success: true, error: null };
  }, 'upsertRemunerationRealization');
};

export const uploadRemunerationProof = async (file, therapistId) => {
  return safeQuery(async () => {
    const ext = file.name.split('.').pop();
    const fileName = `${therapistId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase
      .storage
      .from('remuneration-proofs')
      .upload(fileName, file, { upsert: true });

    if (uploadError) return { error: uploadError };

    const { data: publicUrlData } = supabase
      .storage
      .from('remuneration-proofs')
      .getPublicUrl(fileName);

    return { data: publicUrlData.publicUrl, success: true, error: null };
  }, 'uploadRemunerationProof');
};

// Kedisiplinan kehadiran: proporsi appointment yang benar-benar direalisasikan
// (ada daily_recap dengan start_time) dari seluruh appointment yang dijadwalkan
// (tidak termasuk yang dibatalkan) pada periode tsb.
export const getTherapistAttendanceRate = async (therapistId, startDate, endDate) => {
  return safeQuery(async () => {
    const { data: appts, error: apptError } = await supabase
      .from('appointments')
      .select('id, status')
      .eq('therapist_id', therapistId)
      .gte('appointment_date', `${startDate}T00:00:00`)
      .lte('appointment_date', `${endDate}T23:59:59`)
      .neq('status', 'cancelled');

    if (apptError) return { error: apptError };

    const totalScheduled = (appts || []).length;

    const { data: recaps, error: recapError } = await supabase
      .from('daily_recaps')
      .select('id, start_time')
      .eq('therapist_id', therapistId)
      .gte('recap_date', startDate)
      .lte('recap_date', endDate)
      .not('start_time', 'is', null);

    if (recapError) return { error: recapError };

    const totalAttended = (recaps || []).length;
    const rate = totalScheduled > 0 ? Math.round((totalAttended / totalScheduled) * 100) : 100;

    return {
      data: { totalScheduled, totalAttended, rate },
      success: true,
      error: null
    };
  }, 'getTherapistAttendanceRate', { retry: true });
};

// Kelengkapan SOAP: proporsi kunjungan (daily_recaps) pada periode yang sudah
// memiliki medical record (SOAP) terisi.
export const getTherapistSoapCompleteness = async (therapistId, startDate, endDate) => {
  return safeQuery(async () => {
    const { data: recaps, error: recapError } = await supabase
      .from('daily_recaps')
      .select('id')
      .eq('therapist_id', therapistId)
      .gte('recap_date', startDate)
      .lte('recap_date', endDate);

    if (recapError) return { error: recapError };

    const totalRecaps = (recaps || []).length;
    if (totalRecaps === 0) {
      return { data: { totalRecaps, totalFilled: 0, rate: 100 }, success: true, error: null };
    }

    const recapIds = recaps.map(r => r.id);
    const { data: medicalRecords, error: mrError } = await supabase
      .from('medical_records')
      .select('daily_recap_id')
      .in('daily_recap_id', recapIds);

    if (mrError) return { error: mrError };

    const filledIds = new Set((medicalRecords || []).map(r => r.daily_recap_id).filter(Boolean));
    const totalFilled = filledIds.size;
    const rate = Math.round((totalFilled / totalRecaps) * 100);

    return {
      data: { totalRecaps, totalFilled, rate },
      success: true,
      error: null
    };
  }, 'getTherapistSoapCompleteness', { retry: true });
};

// Laporan remunerasi lengkap untuk satu terapis pada satu periode: gabungan
// kriteria (dari owner), realisasi manual, dan metrik otomatis dari DB.
export const getRemunerationReport = async (therapistId, startDate, endDate) => {
  return safeQuery(async () => {
    const { data: criteria, error: criteriaError } = await getRemunerationCriteria();
    if (criteriaError) return { error: criteriaError };

    const { data: targetProgress } = await getTherapistTargetProgress(therapistId, startDate, endDate);
    const { data: attendance } = await getTherapistAttendanceRate(therapistId, startDate, endDate);
    const { data: soapCompleteness } = await getTherapistSoapCompleteness(therapistId, startDate, endDate);
    const { data: realizations } = await getRemunerationRealizations(therapistId, startDate, endDate);

    const realizationMap = {};
    (realizations || []).forEach(r => { realizationMap[r.criteria_id] = r; });

    const patientTargetVisits = targetProgress?.target_visits || 0;

    const rows = (criteria || []).map(c => {
      let targetValue = c.target_value;
      let realizationValue = 0;
      let unit = c.unit;
      let proofUrl = null;

      if (c.target_mode === 'percent_of_patient_target') {
        targetValue = Math.round(patientTargetVisits * (c.target_value / 100));
      }

      if (c.metric_key === 'target_pasien') {
        realizationValue = targetProgress?.actual_visits || 0;
        targetValue = patientTargetVisits;
      } else if (c.metric_key === 'kehadiran') {
        realizationValue = attendance?.rate || 0;
      } else if (c.metric_key === 'kelengkapan_soap') {
        realizationValue = soapCompleteness?.rate || 0;
      } else {
        const r = realizationMap[c.id];
        realizationValue = r?.realization_value || 0;
        proofUrl = r?.proof_url || null;
      }

      const achievementPercent = targetValue > 0
        ? Math.round((realizationValue / targetValue) * 100)
        : (realizationValue > 0 ? 100 : 0);

      // Cap contribution at 100% achievement so over-performing one metric
      // can't offset an under-performing one beyond its own weight.
      const cappedAchievement = Math.min(achievementPercent, 100);
      const weightedScore = (cappedAchievement / 100) * c.weight_percent;

      return {
        ...c,
        targetValue,
        realizationValue,
        unit,
        proofUrl,
        achievementPercent,
        weightedScore,
      };
    });

    const overallScore = Math.round(rows.reduce((sum, r) => sum + r.weightedScore, 0));
    const patientTargetRow = rows.find(r => r.metric_key === 'target_pasien');
    const isActive = patientTargetRow ? patientTargetRow.realizationValue >= patientTargetRow.targetValue && patientTargetRow.targetValue > 0 : false;

    return {
      data: {
        rows,
        overallScore,
        isActive,
        periodStart: startDate,
        periodEnd: endDate,
      },
      success: true,
      error: null
    };
  }, 'getRemunerationReport');
};