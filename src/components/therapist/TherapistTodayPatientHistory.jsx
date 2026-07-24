import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { getDailyRecaps } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  Stethoscope, Search, Loader2, CalendarCheck, History,
  ChevronRight, RefreshCcw
} from 'lucide-react';
import PatientClinicalHistoryDrawer from './PatientClinicalHistoryDrawer';

const TYPE_COLOR_PALETTE = [
  'bg-indigo-50 text-indigo-700 border-indigo-200',
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

const TherapistTodayPatientHistory = ({ therapist }) => {
  const { toast } = useToast();
  const [recaps, setRecaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);

  const todayISO = getTodayISO();
  const todayLabel = format(new Date(`${todayISO}T00:00:00`), 'EEEE, dd MMMM yyyy', { locale: idLocale });

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
      toast({ variant: 'destructive', title: 'Gagal memuat data hari ini', description: error.message });
      setRecaps([]);
    } else {
      setRecaps(data || []);
    }
    setLoading(false);
  };

  // Dedupe visits into one card per patient treated today.
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

  const filteredPatients = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return todaysPatients;
    return todaysPatients.filter((p) => {
      const diagnosisText = p.visits.flatMap(getDiagnosisList).join(' ').toLowerCase();
      return p.name.toLowerCase().includes(q) || p.rm.toLowerCase().includes(q) || diagnosisText.includes(q);
    });
  }, [todaysPatients, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 shadow-xl">
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 w-56 h-56 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
              <Stethoscope className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-300 capitalize">{todayLabel}</p>
              <h2 className="text-xl md:text-2xl font-bold text-white">Riwayat Diagnosa Pasien</h2>
              <p className="text-sm text-slate-400 mt-0.5">Kenali riwayat diagnosa &amp; SOAP pasien yang Anda tangani hari ini</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-center backdrop-blur">
              <p className="text-lg font-bold text-white">{todaysPatients.length}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 mt-0.5">Pasien Hari Ini</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-center backdrop-blur">
              <p className="text-lg font-bold text-white">{recaps.length}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 mt-0.5">Kunjungan</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Cari nama pasien, No. RM, atau diagnosa..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={fetchToday} className="gap-1.5 shrink-0">
            <RefreshCcw className="w-3.5 h-3.5" /> Segarkan
          </Button>
        </div>
      </Card>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin w-6 h-6 text-indigo-600" /></div>
      ) : filteredPatients.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
          <CalendarCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-semibold">
            {todaysPatients.length === 0 ? 'Belum ada pasien yang ditangani hari ini.' : 'Tidak ada pasien yang cocok dengan pencarian.'}
          </p>
          {todaysPatients.length === 0 && (
            <p className="text-xs text-slate-400 mt-1">Pasien akan muncul di sini setelah kunjungan hari ini tercatat di Daily Recap.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredPatients.map((p) => {
            const latestVisit = p.visits[0];
            const diagnosisList = getDiagnosisList(latestVisit);
            return (
              <Card
                key={p.key}
                className={cn(
                  'p-4 border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group',
                  !p.patientId && 'opacity-70 cursor-not-allowed hover:shadow-none hover:border-slate-200'
                )}
                onClick={() => p.patientId && setSelectedPatient({ id: p.patientId, name: p.name, rm: p.rm })}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate">{p.name}</p>
                      <p className="text-xs text-slate-400">{p.rm}</p>
                    </div>
                  </div>
                  {p.visits.length > 1 && (
                    <span className="shrink-0 text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                      {p.visits.length}x hari ini
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mb-3 min-h-[22px]">
                  {latestVisit.patient_type && (
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', colorForLabel(latestVisit.patient_type))}>
                      {latestVisit.patient_type}
                    </span>
                  )}
                  {diagnosisList.length === 0 ? (
                    <span className="text-[10px] text-slate-400 italic">Belum ada diagnosa</span>
                  ) : diagnosisList.map((d, idx) => (
                    <span key={idx} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      {d}
                    </span>
                  ))}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={!p.patientId}
                  className="w-full h-8 text-xs gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 group-hover:bg-indigo-50"
                >
                  <History className="w-3.5 h-3.5" /> Lihat Riwayat Lengkap
                  <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                </Button>
                {!p.patientId && (
                  <p className="text-[10px] text-slate-400 mt-1.5 text-center">Pasien tamu tanpa data rekam medis</p>
                )}
              </Card>
            );
          })}
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
