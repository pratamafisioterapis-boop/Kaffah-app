import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useSoapFirstSettings } from '@/hooks/useSoapFirst';
import { isSoapFirstActiveOn, todayWita } from '@/lib/soapFirst';
import { isApptOpen, slotOf } from '@/lib/soapReminder';

const firstDiagnosis = (d) => (Array.isArray(d) ? d.find(Boolean) : d) || '';

const normalize = (r) => {
  const slot = slotOf(r.appointment);
  return {
    id: r.id,
    patientId: r.actual_patient_id || r.patient_id || null,
    name: r.actual_patients?.full_name || r.patients?.full_name || r.full_name || r.guest_name || 'Pasien',
    diagnosis: firstDiagnosis(r.diagnosis),
    startedAt: r.start_time || null,
    endedAt: r.end_time || null,
    soapDone: !!r.soap_completed_at,
    slot,
    apptOpen: isApptOpen(r.appointment?.status),
  };
};

// Jam berdetak supaya sisa waktu sesi ikut berjalan tanpa refetch.
export const useNow = (intervalMs = 30000) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
};

// Sesi terapis hari ini (dari daily_recaps + slot appointment) untuk banner agenda dan pengingat SOAP.
export const useTherapistToday = (therapistId) => {
  const { settings, loaded: soapLoaded } = useSoapFirstSettings();
  const today = todayWita();
  const soapActive = isSoapFirstActiveOn(settings, today);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const now = useNow();

  const load = useCallback(async () => {
    if (!therapistId) { setSessions([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from('daily_recaps')
      .select(`
        id, patient_id, actual_patient_id, full_name, guest_name, diagnosis,
        start_time, end_time, soap_completed_at,
        patients!patient_id(full_name),
        actual_patients:patients!actual_patient_id(full_name),
        appointment:appointments!appointment_id(appointment_date, duration_minutes, status)
      `)
      .eq('recap_date', today)
      .eq('therapist_id', therapistId)
      .limit(100);
    if (!error) {
      const list = (data || []).map(normalize);
      list.sort((a, b) => (a.slot?.start ?? Infinity) - (b.slot?.start ?? Infinity));
      setSessions(list);
    }
    setLoading(false);
  }, [therapistId, today]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  return { sessions, loading, soapActive, soapLoaded, now, today, reload: load };
};
