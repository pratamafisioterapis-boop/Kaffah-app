import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Loader2, Calendar, ChevronDown, ChevronUp, Stethoscope, Users,
  History, FileText, User, Clock,
} from 'lucide-react';
import { getPatientClinicalHistory, getMedicalRecords, getPatientOnsetInfo } from '@/lib/api';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { colorForLabel } from './TherapistTodayPatientHistory';
import { formatOnsetDuration, classifyOnsetPhase } from '@/lib/onsetHelpers';

const SOAP_FIELDS = [
  { key: 'subjective', short: 'S', label: 'Subjective', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100' },
  { key: 'objective', short: 'O', label: 'Objective', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-100' },
  { key: 'assessment', short: 'A', label: 'Assessment', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-100' },
  { key: 'plan', short: 'P', label: 'Plan', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-100' },
];

const getDiagnosisList = (visit) => {
  if (Array.isArray(visit.diagnosis)) return visit.diagnosis.filter(Boolean);
  return visit.diagnosis ? [visit.diagnosis] : [];
};

const formatVisitDate = (dateStr) => {
  if (!dateStr) return '-';
  return format(new Date(`${dateStr}T00:00:00`), 'dd MMMM yyyy', { locale: idLocale });
};

const PatientClinicalHistoryDrawer = ({ isOpen, onClose, patient, currentTherapist, todayISO }) => {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [onsetInfo, setOnsetInfo] = useState(null);

  useEffect(() => {
    if (isOpen && patient?.id) {
      fetchHistory();
      getPatientOnsetInfo(patient.id).then(({ data }) => setOnsetInfo(data || null));
    } else {
      setVisits([]);
      setExpandedId(null);
      setOnsetInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, patient?.id]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const [{ data: clinicalHistory, error: historyError }, { data: soapRecords, error: soapError }] = await Promise.all([
        getPatientClinicalHistory(patient.id),
        getMedicalRecords({ patientId: patient.id, limit: 9999 }),
      ]);

      if (historyError) throw historyError;
      if (soapError) throw soapError;

      const soapByRecapId = new Map();
      (soapRecords || []).forEach((r) => {
        if (r.daily_recap_id) soapByRecapId.set(r.daily_recap_id, r);
      });

      const merged = (clinicalHistory || []).map((visit) => ({
        ...visit,
        soap: soapByRecapId.get(visit.id) || null,
      }));

      setVisits(merged);
      // Auto-expand today's visit so the therapist sees the freshest context first.
      const todayVisit = merged.find((v) => v.recap_date === todayISO);
      setExpandedId(todayVisit ? todayVisit.id : null);
    } catch (err) {
      console.error('Error fetching patient clinical history', err);
      setVisits([]);
    } finally {
      setLoading(false);
    }
  };

  const uniqueTherapists = useMemo(() => {
    const map = new Map();
    visits.forEach((v) => {
      if (!v.therapist?.id) return;
      const existing = map.get(v.therapist.id);
      if (existing) existing.count += 1;
      else map.set(v.therapist.id, { id: v.therapist.id, name: v.therapist.name, count: 1 });
    });
    return Array.from(map.values());
  }, [visits]);

  const firstVisitDate = visits.length > 0 ? visits[visits.length - 1].recap_date : null;

  const toggleExpand = (id) => setExpandedId((prev) => (prev === id ? null : id));

  if (!patient) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col p-0 gap-0 rounded-2xl overflow-hidden">

        {/* Header */}
        <div className="p-5 border-b bg-white shrink-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Riwayat Klinis {patient.name}</DialogTitle>
            <DialogDescription>Riwayat diagnosa, terapis, dan SOAP pasien.</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg shrink-0">
              {patient.name?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-slate-900 text-base leading-tight truncate">{patient.name}</h2>
              <p className="text-slate-400 text-xs">{patient.rm}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-center">
              <p className="text-lg font-bold text-slate-800">{visits.length}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Total Kunjungan</p>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5 text-center">
              <p className="text-lg font-bold text-indigo-600">{uniqueTherapists.length}</p>
              <p className="text-[10px] text-indigo-500 font-medium mt-0.5">Terapis Terlibat</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-center">
              <p className="text-[11px] font-bold text-slate-800 mt-1" title={formatVisitDate(firstVisitDate)}>
                {firstVisitDate ? format(new Date(`${firstVisitDate}T00:00:00`), 'dd MMM yyyy', { locale: idLocale }) : '-'}
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Kunjungan Pertama</p>
            </div>
          </div>

          {onsetInfo?.complaint_onset_date && (() => {
            const duration = formatOnsetDuration(onsetInfo.complaint_onset_date);
            const phase = classifyOnsetPhase(onsetInfo.complaint_onset_date);
            const phaseStyles = {
              amber: 'bg-amber-50 border-amber-200 text-amber-800',
              blue: 'bg-blue-50 border-blue-200 text-blue-800',
              rose: 'bg-rose-50 border-rose-200 text-rose-800',
            };
            return (
              <div className={cn('mb-3 flex items-start gap-2 rounded-xl border px-3 py-2.5', phaseStyles[phase?.color] || 'bg-slate-50 border-slate-200 text-slate-700')}>
                <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="text-xs leading-relaxed">
                  <span className="font-semibold">Pengingat:</span> pasien sudah <strong>{duration}</strong> mengalami keluhan ini
                  {phase && <> (<strong>{phase.label}</strong>)</>}, sejak {format(new Date(`${onsetInfo.complaint_onset_date}T00:00:00`), 'dd MMMM yyyy', { locale: idLocale })}.
                </p>
              </div>
            );
          })()}

          {uniqueTherapists.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium mr-1">
                <Users className="w-3 h-3" /> Pernah ditangani:
              </span>
              {uniqueTherapists.map((t) => (
                <span
                  key={t.id}
                  className={cn(
                    'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                    t.id === currentTherapist?.id
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  )}
                >
                  <User className="w-3 h-3" />
                  {t.id === currentTherapist?.id ? 'Anda' : t.name}
                  {t.count > 1 && <span className="opacity-70">×{t.count}</span>}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50">
          <div className="px-4 py-3 space-y-2">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-indigo-600" /></div>
            ) : visits.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                <History className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                Belum ada riwayat kunjungan untuk pasien ini.
              </div>
            ) : visits.map((visit) => {
              const diagnosisList = getDiagnosisList(visit);
              const isToday = visit.recap_date === todayISO;
              const isExpanded = expandedId === visit.id;
              const hasSoap = !!visit.soap;

              return (
                <div
                  key={visit.id}
                  className={cn(
                    'bg-white rounded-2xl border shadow-sm overflow-hidden transition-all',
                    isExpanded ? 'border-indigo-300 ring-1 ring-indigo-100' : 'border-slate-100'
                  )}
                >
                  <div
                    className="p-4 flex items-start justify-between gap-3 cursor-pointer hover:bg-slate-50/60"
                    onClick={() => toggleExpand(visit.id)}
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span className="text-xs font-semibold text-slate-700">{formatVisitDate(visit.recap_date)}</span>
                        </span>
                        {isToday && (
                          <span className="text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full">Hari Ini</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <User className="w-3 h-3" />
                        {visit.therapist?.id === currentTherapist?.id ? 'Anda' : (visit.therapist?.name || 'Terapis tidak diketahui')}
                        {visit.patient_type && (
                          <span className={cn('ml-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border', colorForLabel(visit.patient_type))}>
                            {visit.patient_type}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {diagnosisList.length === 0 ? (
                          <span className="text-[11px] text-slate-400 italic">Belum ada diagnosa</span>
                        ) : diagnosisList.map((d, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            <Stethoscope className="w-3 h-3 text-slate-400" />{d}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {hasSoap ? (
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <FileText className="w-3 h-3" /> SOAP
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400">Belum SOAP</span>
                      )}
                      <div className="p-1 rounded-full hover:bg-slate-200 text-slate-400 transition-colors">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-slate-100"
                      >
                        <div className="p-4 grid gap-3 bg-white text-sm">
                          {hasSoap ? SOAP_FIELDS.map((f) => (
                            <div key={f.key}>
                              <span className={cn('font-bold block mb-1', f.color)}>{f.label} ({f.short})</span>
                              <p className={cn('text-slate-600 p-2.5 rounded-lg border whitespace-pre-wrap text-xs', f.bg)}>
                                {visit.soap[f.key] || '-'}
                              </p>
                            </div>
                          )) : (
                            <p className="text-xs text-slate-400 italic text-center py-2">
                              Belum ada catatan SOAP untuk kunjungan ini.
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white flex justify-end shrink-0">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Tutup</Button>
        </div>

      </DialogContent>
    </Dialog>
  );
};

export default PatientClinicalHistoryDrawer;
