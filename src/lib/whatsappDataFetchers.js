import { supabase } from '@/lib/customSupabaseClient';
import { startOfDay, subDays, addDays, format, differenceInDays } from 'date-fns';

export const getBookingAppointmentPatients = async () => {
  try {
    console.log("[DataFetchers] Fetching all active booking appointments (scheduled/confirmed)...");
    
    // Fetch ALL appointments with status scheduled or confirmed
    // Ordered by appointment_date ascending (closest upcoming first)
    // No created_at filter as requested to allow full visibility and realtime updates
    const { data, error } = await supabase
      .from('appointments')
      .select('*, patient:patients(*), therapist:physiotherapists(name)')
      .in('status', ['scheduled', 'confirmed'])
      .order('appointment_date', { ascending: true });

    if (error) throw error;
    
    console.log("[DataFetchers] Booking appointments fetched:", data?.length);
    return data || [];
  } catch (error) {
    console.error('Error fetching booking patients:', error);
    return [];
  }
};

export const getFollowUpPatients = async (daysAfter) => {
  try {
    const targetDate = subDays(new Date(), daysAfter);
    const startStr = startOfDay(targetDate).toISOString();
    const endStr = new Date(targetDate.setHours(23, 59, 59, 999)).toISOString();

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('*, patient:patients(*)')
      .eq('status', 'completed')
      .gte('appointment_date', startStr)
      .lte('appointment_date', endStr);

    if (error) throw error;

    const validPatients = [];
    for (const app of appointments) {
        if (!app.patient) continue;
        
        const { count } = await supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('patient_id', app.patient_id)
            .gt('appointment_date', app.appointment_date);
        
        if (count === 0) {
            validPatients.push({ ...app.patient, last_appointment: app });
        }
    }

    return validPatients;
  } catch (error) {
    console.error('Error fetching follow up patients:', error);
    return [];
  }
};

export const getPackageExpiryPatients = async (daysWarning = 30) => {
  try {
    const { data: packages, error } = await supabase
      .from('package_tracking')
      .select('*, patient:patients(id, full_name, phone, nickname)')
      .or('status.eq.aktif,status.eq.diperpanjang');

    if (error) throw error;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const expiringPackages = [];

    packages.forEach(pkg => {
        const expiryDateStr = pkg.extended_until || pkg.end_date;
        if (!expiryDateStr) return;
        
        const expiryDate = new Date(expiryDateStr);
        expiryDate.setHours(0, 0, 0, 0);

        const daysUntil = differenceInDays(expiryDate, today);
        
        if (daysUntil >= 0 && daysUntil <= daysWarning) {
            expiringPackages.push({
                ...pkg,
                days_until_expiry: daysUntil,
                patient_name: pkg.patient?.full_name || 'Unknown',
                patient_phone: pkg.patient?.phone || '',
                effective_expiry_date: expiryDateStr
            });
        }
    });

    return expiringPackages.sort((a, b) => a.days_until_expiry - b.days_until_expiry);

  } catch (error) {
    console.error('Error fetching package expiry patients:', error);
    return [];
  }
};

export const getTodayTherapyPatients = async () => {
  try {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('appointments')
      .select('*, patient:patients(*), therapist:physiotherapists(name)')
      .eq('status', 'scheduled')
      .gte('appointment_date', `${todayStr}T00:00:00`)
      .lte('appointment_date', `${todayStr}T23:59:59`);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching today therapy patients:', error);
    return [];
  }
};

export const getBirthdayPatients = async () => {
  try {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    const { data, error } = await supabase
      .from('patients')
      .select('*, date_of_birth') 
      .eq('is_active', true);

    if (error) throw error;

    return data.filter(p => {
        if (!p.date_of_birth) return false;
        const dob = new Date(p.date_of_birth);
        return dob.getMonth() + 1 === month && dob.getDate() === day;
    });
  } catch (error) {
    console.error('Error fetching birthday patients:', error);
    return [];
  }
};