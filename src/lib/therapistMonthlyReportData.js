import { supabase } from '@/lib/customSupabaseClient';
import {
  getTherapistTargetProgress,
  getWarningLettersForTherapist,
  getRemunerationCriteria,
  getRemunerationRealizations,
  getAttendanceRecords,
} from '@/lib/api';

const SOAP_DELAY_BUCKETS = [
  { key: '<=24', label: '≤ 24 Jam', max: 24 },
  { key: '24-48', label: '24 – 48 Jam', max: 48 },
  { key: '48-72', label: '48 – 72 Jam', max: 72 },
  { key: '>72', label: '> 72 Jam', max: Infinity },
];

const bucketForHours = (hours) => SOAP_DELAY_BUCKETS.find((b) => hours <= b.max) || SOAP_DELAY_BUCKETS[SOAP_DELAY_BUCKETS.length - 1];

/**
 * Anggap tanggal 28 bulan (n-1) s/d 27 bulan n sebagai satu periode laporan,
 * mengikuti konvensi yang sudah dipakai di target terapis & MonthlyReportWidget.
 */
export const getDefaultReportPeriod = (referenceDate = new Date()) => {
  const day = referenceDate.getDate();
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  let start, end;
  if (day >= 28) {
    start = new Date(year, month, 28);
    end = new Date(year, month + 1, 27);
  } else {
    start = new Date(year, month - 1, 28);
    end = new Date(year, month, 27);
  }
  const toISO = (d) => d.toISOString().slice(0, 10);
  return { startDate: toISO(start), endDate: toISO(end) };
};

const chunkedIn = async (table, column, ids, select) => {
  const results = [];
  const chunkSize = 200;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data } = await supabase.from(table).select(select).in(column, chunk);
    if (data) results.push(...data);
  }
  return results;
};

/**
 * Mengumpulkan seluruh data untuk Laporan Bulanan & Evaluasi Terapis pada satu periode.
 */
export const getTherapistMonthlyReportData = async ({ therapistId, periodStart, periodEnd }) => {
  const [{ data: therapist }, { data: clinicRow }] = await Promise.all([
    supabase.from('physiotherapists').select('*').eq('id', therapistId).single(),
    supabase.from('physiotherapists').select('clinic_id').eq('id', therapistId).single(),
  ]);
  const clinicId = clinicRow?.clinic_id || therapist?.clinic_id;
  const { data: clinic } = clinicId
    ? await supabase.from('clinics').select('*').eq('id', clinicId).single()
    : { data: null };

  // 1. Recaps (kunjungan) dalam periode
  const { data: recapsRaw } = await supabase
    .from('daily_recaps')
    .select(`
      id, patient_id, actual_patient_id, recap_date, start_time, end_time,
      patient_type, diagnosis, package_tracking_id, appointment_id,
      actual_patient:patients!actual_patient_id ( id, full_name ),
      main_patient:patients!patient_id ( id, full_name )
    `)
    .eq('therapist_id', therapistId)
    .gte('recap_date', periodStart)
    .lte('recap_date', periodEnd)
    .order('recap_date', { ascending: true });

  const recaps = recapsRaw || [];
  const recapIds = recaps.map((r) => r.id);

  const { data: options } = clinicId
    ? await supabase
        .from('operational_options')
        .select('id, label, category')
        .eq('clinic_id', clinicId)
        .in('category', ['diagnosa', 'patient_type'])
    : { data: [] };
  const optionsMap = (options || []).reduce((acc, o) => ({ ...acc, [o.id]: o.label }), {});

  // 2. Ringkasan kunjungan & tipe pasien
  const uniquePatientIds = [...new Set(recaps.map((r) => r.actual_patient_id || r.patient_id).filter(Boolean))];
  const typeCountMap = {};
  recaps.forEach((r) => {
    const label = optionsMap[r.patient_type] || r.patient_type || 'Tidak Diketahui';
    typeCountMap[label] = (typeCountMap[label] || 0) + 1;
  });

  // 3. Diagnosa terbanyak
  const diagnosisCountMap = {};
  recaps.forEach((r) => {
    let diagArray = [];
    try {
      diagArray = typeof r.diagnosis === 'string' ? JSON.parse(r.diagnosis) : r.diagnosis;
    } catch {
      diagArray = [];
    }
    if (!Array.isArray(diagArray)) diagArray = diagArray ? [diagArray] : [];
    diagArray.flat().forEach((d) => {
      const label = optionsMap[d] || d;
      if (label) diagnosisCountMap[label] = (diagnosisCountMap[label] || 0) + 1;
    });
  });
  const topDiagnoses = Object.entries(diagnosisCountMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // 4. Pasien recurring: pasien unik periode ini yang sudah pernah ditangani
  // terapis yang sama SEBELUM periode ini dimulai -> indikasi mereka balik lagi
  // ke terapis ini, bukan cuma ke klinik.
  let recurringCount = 0;
  if (uniquePatientIds.length > 0) {
    const { data: priorRecaps } = await supabase
      .from('daily_recaps')
      .select('patient_id, actual_patient_id')
      .eq('therapist_id', therapistId)
      .lt('recap_date', periodStart);
    const priorPatientIds = new Set();
    (priorRecaps || []).forEach((r) => {
      if (r.actual_patient_id) priorPatientIds.add(r.actual_patient_id);
      if (r.patient_id) priorPatientIds.add(r.patient_id);
    });
    recurringCount = uniquePatientIds.filter((id) => priorPatientIds.has(id)).length;
  }
  const recurringPct = uniquePatientIds.length > 0 ? Math.round((recurringCount / uniquePatientIds.length) * 100) : 0;

  // 5. Paket baru terjual: package_tracking_id yang kunjungan PERTAMA-nya
  // (sepanjang riwayat, bukan cuma periode ini) jatuh dalam periode ini dan
  // ditangani terapis ini -> pasien yang baru mulai ambil paket lewat dia.
  const pkgIds = [...new Set(recaps.map((r) => r.package_tracking_id).filter(Boolean))];
  let newPackagesCount = 0;
  if (pkgIds.length > 0) {
    const { data: pkgRecaps } = await supabase
      .from('daily_recaps')
      .select('package_tracking_id, recap_date, therapist_id')
      .in('package_tracking_id', pkgIds)
      .order('recap_date', { ascending: true });
    const firstByPkg = {};
    (pkgRecaps || []).forEach((r) => {
      if (!firstByPkg[r.package_tracking_id]) firstByPkg[r.package_tracking_id] = r;
    });
    newPackagesCount = Object.values(firstByPkg).filter(
      (r) => r.therapist_id === therapistId && r.recap_date >= periodStart && r.recap_date <= periodEnd
    ).length;
  }

  // 6. Kepatuhan SOAP + kecepatan pengisian
  let filledCount = 0;
  let unfilledCount = 0;
  const delayBucketCounts = SOAP_DELAY_BUCKETS.reduce((acc, b) => ({ ...acc, [b.key]: 0 }), {});
  let delaySumHours = 0;
  let delaySampleCount = 0;
  let noTimeDataCount = 0;

  if (recapIds.length > 0) {
    const medRecords = await chunkedIn('medical_records', 'daily_recap_id', recapIds, 'daily_recap_id, created_at');
    const medByRecap = new Map();
    medRecords.forEach((m) => {
      if (m.daily_recap_id && !medByRecap.has(m.daily_recap_id)) medByRecap.set(m.daily_recap_id, m.created_at);
    });
    filledCount = recapIds.filter((id) => medByRecap.has(id)).length;
    unfilledCount = recapIds.length - filledCount;

    // Jadwal booking sebagai fallback anchor kalau start_time/end_time kosong.
    const apptIds = [...new Set(recaps.map((r) => r.appointment_id).filter(Boolean))];
    const appointments = apptIds.length > 0
      ? await chunkedIn('appointments', 'id', apptIds, 'id, appointment_date, duration_minutes')
      : [];
    const apptById = new Map(appointments.map((a) => [a.id, a]));

    recaps.forEach((r) => {
      const filledAt = medByRecap.get(r.id);
      if (!filledAt) return;

      let anchor = null;
      if (r.end_time) anchor = new Date(r.end_time);
      else if (r.start_time) anchor = new Date(r.start_time);
      else if (r.appointment_id && apptById.has(r.appointment_id)) {
        const appt = apptById.get(r.appointment_id);
        if (appt?.appointment_date) {
          anchor = new Date(appt.appointment_date);
          anchor.setMinutes(anchor.getMinutes() + (appt.duration_minutes || 0));
        }
      }

      if (!anchor) {
        noTimeDataCount += 1;
        return;
      }

      const hours = Math.max(0, (new Date(filledAt).getTime() - anchor.getTime()) / 3_600_000);
      const bucket = bucketForHours(hours);
      delayBucketCounts[bucket.key] += 1;
      delaySumHours += hours;
      delaySampleCount += 1;
    });
  }
  const avgDelayHours = delaySampleCount > 0 ? Math.round((delaySumHours / delaySampleCount) * 10) / 10 : null;

  // 7. Target & pencapaian
  const { data: targetProgress } = await getTherapistTargetProgress(therapistId, periodStart, periodEnd);
  const targetAchieved = (targetProgress?.achievement_percentage || 0) >= 100;

  // 8. KPI / remunerasi — hanya kalau target tercapai
  let kpi = null;
  if (targetAchieved) {
    const [{ data: criteria }, { data: realizations }] = await Promise.all([
      getRemunerationCriteria(),
      getRemunerationRealizations(therapistId, periodStart, periodEnd),
    ]);
    const realizationByCriteria = new Map((realizations || []).map((r) => [r.criteria_id, r]));
    kpi = (criteria || []).map((c) => ({
      name: c.name,
      unit: c.unit,
      targetValue: c.target_value,
      weightPercent: c.weight_percent,
      realizationValue: realizationByCriteria.get(c.id)?.realization_value ?? null,
    }));
  }

  // 9. Kehadiran
  const { data: attendanceAll } = await getAttendanceRecords({ startDate: periodStart, endDate: periodEnd });
  const attendance = (attendanceAll || []).filter((a) => a.physiotherapist_id === therapistId);
  const lateRecords = attendance.filter((a) => (a.late_minutes || 0) > 0);
  const avgLateMinutes = lateRecords.length > 0
    ? Math.round(lateRecords.reduce((sum, a) => sum + (a.late_minutes || 0), 0) / lateRecords.length)
    : 0;

  // 10. Surat Peringatan aktif di periode ini (berdasarkan tanggal pelanggaran,
  // bukan tanggal surat diterbitkan, supaya SP untuk pelanggaran periode lalu
  // yang baru diterbitkan setelah periode tutup tetap masuk periode yang benar).
  const { data: warningLettersAll } = await getWarningLettersForTherapist(therapistId);
  const warningLetters = (warningLettersAll || []).filter((w) => {
    const dates = Array.isArray(w.violations) && w.violations.length > 0
      ? w.violations.map((v) => v.date)
      : [w.violation_date];
    return dates.some((d) => d >= periodStart && d <= periodEnd);
  });

  return {
    therapist,
    clinic,
    period: { startDate: periodStart, endDate: periodEnd },
    summary: {
      totalVisits: recaps.length,
      totalUniquePatients: uniquePatientIds.length,
      typeBreakdown: Object.entries(typeCountMap).sort((a, b) => b[1] - a[1]),
      topDiagnoses,
      recurringCount,
      recurringPct,
      newPackagesCount,
    },
    target: targetProgress || null,
    soap: {
      filledCount,
      unfilledCount,
      delayBuckets: SOAP_DELAY_BUCKETS.map((b) => ({ label: b.label, count: delayBucketCounts[b.key] })),
      avgDelayHours,
      noTimeDataCount,
    },
    kpi,
    attendance: {
      totalRecords: attendance.length,
      lateCount: lateRecords.length,
      avgLateMinutes,
    },
    warningLetters,
  };
};
