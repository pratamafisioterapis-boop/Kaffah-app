import React, { useState, useEffect, useMemo } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { getDailyRecaps, getPatientClinicalHistory, setDailyRecapStartTime, setDailyRecapEndTime } from '@/lib/api';
import { formatTime } from '@/lib/dateFormatHelpers';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { Stethoscope, Loader2, History, ChevronRight, CalendarCheck, Clock, Play, Square } from 'lucide-react';
import PatientClinicalHistoryDrawer from './PatientClinicalHistoryDrawer';

const TYPE_COLOR_PALETTE = [
  'bg-app-soft text-app-accent-hover border-app-accent/25',
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-rose-50 text-rose-700 border-rose-200',
  'bg-sky-50 text-sky-700 border-sky-200',
  'bg-violet-50 text-violet-700 border-violet-200',
];

export const colorForLabel = (label) => {
  if (!label) return 'bg-slate-100 text-slate-600 border-slate-200';
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) % TYPE_COLOR_PALETTE.length;
  return TYPE_COLOR_PALETTE[Math.abs(hash) % TYPE_COLOR_PALETTE.length];
};

const getTodayISO = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getPatientName = (recap) =>
  recap.actual_patients?.full_name || recap.patients?.full_name || recap.guest_name || 'Tanpa Nama';

const getPatientRM = (recap) =>
  recap.actual_patients?.medical_record_number || recap.patients?.medical_record_number || '-';

const getPatientId = (recap) => recap.actual_patient_id || recap.patient_id || null;

const getPatientKey = (recap) => getPatientId(recap) || recap.guest_name || recap.id;

const getDiagnosisList = (recap) => {
  if (Array.isArray(recap.diagnosis)) return recap.diagnosis.filter(Boolean);
  return recap.diagnosis ? [recap.diagnosis] : [];
};

// "3 hari lalu" up to a week, "2 minggu lalu" up to 4 weeks, "2 bulan lalu" beyond that.
const formatLastVisitGap = (lastDateStr, todayStr) => {
  if (!lastDateStr) return null;
  const days = differenceInCalendarDays(new Date(`${todayStr}T00:00:00`), new Date(`${lastDateStr}T00:00:00`));
  if (days <= 0) return null;
  if (days <= 7) return `${days} hari lalu`;
  if (days <= 28) return `${Math.max(1, Math.round(days / 7))} minggu lalu`;
  return `${Math.max(1, Math.round(days / 30))} bulan lalu`;
};

// Dashboard widget (matches the white rounded-app-lg card language used by
// TherapistMetrics / TherapistPerformanceWidget) that lets a therapist
// recognize the patients they're seeing today and jump into each one's
// cross-therapist diagnosis + SOAP history.
const TherapistTodayPatientHistory = ({ therapist }) => {
  const { toast } = useToast();
  const [recaps, setRecaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);
  // patientId -> { lastVisitDate, fallbackDiagnosis }
  const [enrichment, setEnrichment] = useState({});
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const todayISO = getTodayISO();

  useEffect(() => {
    if (therapist?.id) fetchToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapist?.id]);

  const fetchToday = async () => {
    setLoading(true);
    const { data, error } = await getDailyRecaps({
      therapistId: therapist.id,
      startDate: todayISO,
      endDate: todayISO,
      limit: 'all',
      sort: { key: 'recap_date', direction: 'desc' },
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Gagal memuat pasien hari ini', description: error.message });
      setRecaps([]);
    } else {
      setRecaps(data || []);
    }
    setLoading(false);
  };

  // Mulai / Akhiri Sesi — same API calls as the admin Daily Recap, with the
  // local row patched optimistically so the button flips immediately.
  const handleSession = async (e, recapId, kind) => {
    e.stopPropagation();
    if (!recapId) return;
    setActionLoadingId(recapId);
    try {
      const { error } = kind === 'start'
        ? await setDailyRecapStartTime(recapId)
        : await setDailyRecapEndTime(recapId);
      if (error) {
        toast({
          variant: 'destructive',
          title: kind === 'start' ? 'Gagal Memulai Sesi' : 'Gagal Mengakhiri Sesi',
          description: error.message || 'Terjadi kesalahan.',
        });
      } else {
        const nowISO = new Date().toISOString();
        toast({ title: kind === 'start' ? 'Sesi Dimulai' : 'Sesi Selesai' });
        setRecaps((prev) => prev.map((r) => (r.id === recapId
          ? { ...r, ...(kind === 'start' ? { start_time: nowISO } : { end_time: nowISO }) }
          : r)));
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Dedupe visits into one row per patient treated today.
  const todaysPatients = useMemo(() => {
    const map = new Map();
    recaps.forEach((r) => {
      const key = getPatientKey(r);
      if (!map.has(key)) {
        map.set(key, { key, patientId: getPatientId(r), name: getPatientName(r), rm: getPatientRM(r), visits: [] });
      }
      map.get(key).visits.push(r);
    });
    return Array.from(map.values());
  }, [recaps]);

  // For each real patient, look up their last visit before today so the
  // therapist can see "3 hari lalu" and — when today's session has no
  // diagnosis yet — fall back to the most recent diagnosis on record.
  useEffect(() => {
    const ids = todaysPatients.map((p) => p.patientId).filter(Boolean);
    if (ids.length === 0) {
      setEnrichment({});
      return;
    }
    let cancelled = false;
    (async () => {
      const results = await Promise.all(ids.map(async (id) => {
        const { data } = await getPatientClinicalHistory(id);
        const priorVisits = (data || []).filter((v) => v.recap_date !== todayISO);
        const lastPriorVisit = priorVisits[0] || null;
        const lastDiagnosedVisit = priorVisits.find((v) => getDiagnosisList(v).length > 0);
        return [id, {
          lastVisitDate: lastPriorVisit?.recap_date || null,
          fallbackDiagnosis: lastDiagnosedVisit ? getDiagnosisList(lastDiagnosedVisit) : [],
        }];
      }));
      if (!cancelled) setEnrichment(Object.fromEntries(results));
    })();
    return () => { cancelled = true; };
  }, [todaysPatients, todayISO]);

  return (
    <div className="bg-white rounded-app-lg border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-app-sm bg-app-soft flex items-center justify-center shrink-0">
            <Stethoscope className="w-3.5 h-3.5 text-app-accent-bright" />
          </div>
          <h3 className="text-sm font-bold text-slate-700 truncate">Pasien Hari Ini</h3>
        </div>
        <span className="text-xs text-slate-500 shrink-0 whitespace-nowrap">
          {todaysPatients.length} pasien hari ini
        </span>
      </div>

      <div className="h-px bg-slate-50 mx-5" />

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin w-5 h-5 text-app-accent-bright" /></div>
      ) : todaysPatients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center px-5">
          <div className="w-10 h-10 rounded-app bg-slate-50 flex items-center justify-center mb-3">
            <CalendarCheck className="w-5 h-5 text-slate-300" />
          </div>
          <p className="text-xs font-medium text-slate-500">Belum ada pasien yang ditangani hari ini</p>
        </div>
      ) : (
        <div className="px-3 py-2 max-h-80 overflow-y-auto divide-y divide-slate-50">
          {todaysPatients.map((p) => {
            const latestVisit = p.visits[0];
            const todaysDiagnosis = getDiagnosisList(latestVisit);
            const patientEnrichment = p.patientId ? enrichment[p.patientId] : null;
            const usingFallback = todaysDiagnosis.length === 0 && (patientEnrichment?.fallbackDiagnosis?.length > 0);
            const diagnosisList = usingFallback ? patientEnrichment.fallbackDiagnosis : todaysDiagnosis;
            // Active session = first visit not yet finished, else the latest one.
            const sessionRecap = p.visits.find((v) => !v.end_time) || p.visits[0];
            const gapLabel = formatLastVisitGap(patientEnrichment?.lastVisitDate, todayISO);

            return (
              <div key={p.key} className="py-1">
              <div
                role="button"
                tabIndex={p.patientId ? 0 : -1}
                aria-disabled={!p.patientId}
                onClick={() => p.patientId && setSelectedPatient({ id: p.patientId, name: p.name, rm: p.rm })}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && p.patientId) { e.preventDefault(); setSelectedPatient({ id: p.patientId, name: p.name, rm: p.rm }); } }}
                className={cn(
                  'w-full flex items-center gap-3 px-2 py-3 rounded-app text-left transition-colors',
                  p.patientId ? 'hover:bg-slate-50 cursor-pointer' : 'opacity-60 cursor-not-allowed'
                )}
              >
                <div className="w-9 h-9 rounded-full bg-app-accent/15 flex items-center justify-center text-app-accent-hover font-bold text-sm shrink-0">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-semibold text-slate-800 text-sm truncate">{p.name}</p>
                    {p.visits.length > 1 && (
                      <span className="shrink-0 text-xs font-bold bg-app-accent/15 text-app-accent-hover px-1.5 py-0.5 rounded-full">
                        {p.visits.length}x
                      </span>
                    )}
                    {gapLabel && (
                      <span className="shrink-0 inline-flex items-center gap-0.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full">
                        <Clock className="w-2.5 h-2.5" /> {gapLabel}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    <span className="text-xs text-slate-500">{p.rm}</span>
                    {usingFallback && (
                      <span className="text-xs text-slate-500 italic">riwayat:</span>
                    )}
                    {diagnosisList.slice(0, 2).map((d, idx) => (
                      <span key={idx} className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full border', colorForLabel(d))}>
                        {d}
                      </span>
                    ))}
                    {diagnosisList.length === 0 && (
                      <span className="text-xs text-slate-500 italic">Belum ada diagnosa</span>
                    )}
                  </div>
                </div>
                {p.patientId ? (
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                ) : (
                  <span className="text-xs text-slate-500 shrink-0">Pasien Baru</span>
                )}
              </div>
              {sessionRecap && (
                <div className="px-2 pb-2">
                  {!sessionRecap.start_time ? (
                    <button
                      type="button"
                      onClick={(e) => handleSession(e, sessionRecap.id, 'start')}
                      disabled={actionLoadingId === sessionRecap.id}
                      className="h-8 w-full text-xs font-medium text-white bg-app-accent hover:bg-app-accent-hover rounded-app-sm inline-flex items-center justify-center disabled:opacity-60"
                    >
                      {actionLoadingId === sessionRecap.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Play className="w-3 h-3 mr-1.5" />Mulai Sesi</>}
                    </button>
                  ) : !sessionRecap.end_time ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100 shrink-0">{formatTime(new Date(sessionRecap.start_time))}</span>
                      <button
                        type="button"
                        onClick={(e) => handleSession(e, sessionRecap.id, 'end')}
                        disabled={actionLoadingId === sessionRecap.id}
                        className="h-8 flex-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-app-sm inline-flex items-center justify-center disabled:opacity-60"
                      >
                        {actionLoadingId === sessionRecap.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Square className="w-3 h-3 mr-1.5" />Akhiri Sesi</>}
                      </button>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                      <span>{formatTime(new Date(sessionRecap.start_time))}</span>
                      <span className="text-slate-300">→</span>
                      <span>{formatTime(new Date(sessionRecap.end_time))}</span>
                      <span className="font-sans text-emerald-600 font-semibold ml-1">Selesai</span>
                    </div>
                  )}
                </div>
              )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && todaysPatients.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-50 flex items-center gap-1.5 text-xs text-slate-500">
          <History className="w-3 h-3" /> Ketuk pasien untuk lihat riwayat diagnosa &amp; SOAP lengkap
        </div>
      )}

      <PatientClinicalHistoryDrawer
        isOpen={!!selectedPatient}
        onClose={() => setSelectedPatient(null)}
        patient={selectedPatient}
        currentTherapist={therapist}
        todayISO={todayISO}
      />
    </div>
  );
};

export default TherapistTodayPatientHistory;
