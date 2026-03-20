import { supabase } from '@/lib/customSupabaseClient';
import { format, parse, isValid, isAfter } from 'date-fns';
import { id } from 'date-fns/locale';

export const fetchPhysiotherapists = async () => {
  try {
    const { data, error } = await supabase
      .from('physiotherapists')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    return data.map(p => ({ value: p.id, label: p.name }));
  } catch (error) {
    console.error("Error fetching physiotherapists:", error);
    return [];
  }
};

export const fetchOperationalOptions = async (category) => {
  try {
    let query = supabase
      .from('operational_options')
      .select('id, label, value, session_count, validity_days')
      .eq('is_active', true)
      .order('label');
      
    if (Array.isArray(category)) {
        query = query.in('category', category);
    } else {
        query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    // De-duplicate labels just in case
    const unique = new Map();
    data.forEach(item => {
        if (!unique.has(item.label)) {
            unique.set(item.label, { 
                value: item.label, 
                label: item.label, 
                id: item.id,
                session_count: item.session_count,
                validity_days: item.validity_days
            });
        }
    });
    return Array.from(unique.values());
  } catch (error) {
    console.error(`Error fetching options for ${category}:`, error);
    return [];
  }
};

export const fetchPackageTypes = async () => {
    const { data, error } = await supabase
        .from('operational_options')
        .select('id, label')
        .eq('category', 'tipe_paket')
        .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(item => ({
        value: item.id,
        label: item.label
    }));
};
export const fetchPatients = async () => {
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('id, full_name, medical_record_number')
      .eq('status', 'aktif')
      .order('full_name');
      
    if (error) throw error;
    return data.map(p => ({ 
        value: p.id, 
        label: `${p.full_name} (${p.medical_record_number})` 
    }));
  } catch (error) {
    console.error("Error fetching patients:", error);
    return [];
  }
};

export const parseDateFromDisplay = (dateStr) => {
    if (!dateStr) return null;
    try {
        // Assume input is dd/MM/yyyy
        const parsed = parse(dateStr, 'dd/MM/yyyy', new Date());
        if (isValid(parsed)) {
            return format(parsed, 'yyyy-MM-dd');
        }
        return null;
    } catch (e) {
        return null;
    }
};

export const formatDateDisplay = (isoDateStr) => {
    if (!isoDateStr) return '';
    try {
        const date = new Date(isoDateStr);
        if (!isValid(date)) return '';
        return format(date, 'dd/MM/yyyy');
    } catch (e) {
        return '';
    }
};

export const validateDailyRecapForm = (data) => {
    const errors = {};
    
    if (!data.recap_date) errors.recap_date = "Tanggal wajib diisi";
    else {
        const parsed = parseDateFromDisplay(data.recap_date);
        if (!parsed) errors.recap_date = "Format tanggal tidak valid (dd/mm/yyyy)";
        else if (isAfter(new Date(parsed), new Date())) errors.recap_date = "Tanggal tidak boleh di masa depan";
    }

    if (!data.patient_id) errors.patient_id = "Nama Pasien wajib diisi";
    if (!data.actual_patient_id) errors.actual_patient_id = "Nama Pasien Aktual wajib diisi";
    if (!data.therapist_id) errors.therapist_id = "Nama Fisioterapis wajib diisi";
    
    if (data.discount_type !== 'none') {
        if (!data.discount_value || isNaN(Number(data.discount_value))) {
            errors.discount_value = "Nilai diskon wajib diisi";
        }
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};