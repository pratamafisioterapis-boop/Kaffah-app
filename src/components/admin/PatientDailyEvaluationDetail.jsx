import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { User, Calendar, ClipboardList, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const PatientDailyEvaluationDetail = ({ isOpen, onClose, patientData }) => {
  if (!patientData) return null;

  const { patient, records } = patientData;

  // Sort records by date descending (newest first)
  const sortedRecords = [...records].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden sm:rounded-xl">
        <DialogHeader className="px-6 py-5 border-b border-slate-100 bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pr-4">
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-blue-600" />
                Riwayat Evaluasi Harian (SOAP)
              </DialogTitle>
              <DialogDescription className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-semibold text-slate-800 text-base">{patient.full_name}</span>
                <span className="text-slate-300 hidden sm:inline">•</span>
                <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200">
                  {patient.rm_number || 'No RM'}
                </span>
              </DialogDescription>
            </div>
            <Badge variant="outline" className="bg-white px-3 py-1 border-slate-200 shadow-sm text-slate-700">
              Total: {records.length} Catatan
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-0 bg-slate-50/30">
          <div className="p-6 space-y-8">
            {sortedRecords.map((record, index) => (
              <div key={record.id} className="relative pl-8 pb-2 last:pb-0">
                {/* Timeline Line */}
                {index !== sortedRecords.length - 1 && (
                  <div className="absolute left-[11px] top-4 bottom-0 w-[2px] bg-slate-200" />
                )}
                
                {/* Timeline Dot */}
                <div className="absolute left-0 top-2 h-[24px] w-[24px] rounded-full border-4 border-white bg-blue-600 shadow-sm z-10 flex items-center justify-center">
                   <div className="w-1.5 h-1.5 bg-white rounded-full" />
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
                  {/* Record Header */}
                  <div className="bg-slate-50/50 px-5 py-3 border-b border-slate-100 flex flex-wrap gap-y-2 justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <Calendar className="w-4 h-4 text-blue-500" />
                        {format(new Date(record.created_at), 'EEEE, dd MMMM yyyy', { locale: id })}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        <Clock className="w-3 h-3" />
                        {format(new Date(record.created_at), 'HH:mm')}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium bg-white px-3 py-1 rounded-full border border-slate-200 text-slate-600 shadow-sm">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {record.therapist?.full_name || 'Terapis Tidak Diketahui'}
                    </div>
                  </div>

                  {/* SOAP Content */}
                  <div className="p-5 grid gap-5">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center text-[10px] font-extrabold shadow-sm">S</span>
                          Subjective
                        </h4>
                        <div className="text-sm text-slate-700 bg-slate-50 p-3.5 rounded-lg border border-slate-100 whitespace-pre-wrap leading-relaxed min-h-[80px]">
                          {record.subjective || <span className="text-slate-400 italic">Tidak ada catatan</span>}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center text-[10px] font-extrabold shadow-sm">O</span>
                          Objective
                        </h4>
                        <div className="text-sm text-slate-700 bg-slate-50 p-3.5 rounded-lg border border-slate-100 whitespace-pre-wrap leading-relaxed min-h-[80px]">
                          {record.objective || <span className="text-slate-400 italic">Tidak ada catatan</span>}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center text-[10px] font-extrabold shadow-sm">A</span>
                          Assessment
                        </h4>
                        <div className="text-sm text-slate-700 bg-slate-50 p-3.5 rounded-lg border border-slate-100 whitespace-pre-wrap leading-relaxed min-h-[80px]">
                          {record.assessment || <span className="text-slate-400 italic">Tidak ada catatan</span>}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-md bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center text-[10px] font-extrabold shadow-sm">P</span>
                          Plan
                        </h4>
                        <div className="text-sm text-slate-700 bg-slate-50 p-3.5 rounded-lg border border-slate-100 whitespace-pre-wrap leading-relaxed min-h-[80px]">
                          {record.plan || <span className="text-slate-400 italic">Tidak ada catatan</span>}
                        </div>
                      </div>
                    </div>

                    {record.treatment_notes && (
                      <div className="mt-2 pt-4 border-t border-slate-100">
                         <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                            Catatan Tambahan
                         </h4>
                         <p className="text-sm text-slate-600 bg-yellow-50/50 p-3 rounded-lg border border-yellow-100 italic">
                           "{record.treatment_notes}"
                         </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default PatientDailyEvaluationDetail;