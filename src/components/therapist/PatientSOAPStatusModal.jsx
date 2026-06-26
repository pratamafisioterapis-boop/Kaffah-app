import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { FileText, Edit, CheckCircle2, AlertCircle, PlusCircle, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PatientSOAPStatusModal = ({ patient, visits, records, isOpen, onClose }) => {
  const navigate = useNavigate();

  if (!patient) return null;

  const handleCreate = (date, dailyRecapId) => {
    onClose();
    navigate(`/therapist/records/new/${patient.id}?date=${date}&dailyRecapId=${dailyRecapId}`);
  };

  const handleEdit = (recordId, date) => {
    onClose();
    navigate(`/therapist/records/new/${patient.id}?recordId=${recordId}&date=${date}`);
  };
  // Merge visits with records to determine status
  const timeline = visits.map(visit => {
    const visitDate = visit.recap_date; // YYYY-MM-DD
    
    // Find record created on this date
    const matchedRecord = records.find(r => {
    return r.daily_recap_id === visit.id;
});

    return {
        id: visit.id,
        date: visitDate,
        formattedDate: format(new Date(visitDate), 'dd MMMM yyyy', { locale: id }),
        record: matchedRecord,
        status: matchedRecord ? 'filled' : 'unfilled'
    };
  });

  const unfilledCount = timeline.filter(t => t.status === 'unfilled').length;
  const filledCount = timeline.filter(t => t.status === 'filled').length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg flex flex-col max-h-[90vh] p-0 gap-0 rounded-2xl overflow-hidden">

        {/* Header */}
        <div className="p-5 border-b bg-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-slate-600" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-slate-900 text-base leading-tight truncate">{patient.full_name}</h2>
              <p className="text-slate-400 text-xs">{patient.medical_record_number || patient.rm_number || '-'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-center">
              <p className="text-xl font-bold text-slate-800">{timeline.length}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Total Kunjungan</p>
            </div>
            <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 text-center">
              <p className="text-xl font-bold text-emerald-600">{filledCount}</p>
              <p className="text-[10px] text-emerald-500 font-medium mt-0.5">Sudah SOAP</p>
            </div>
            <div className="flex-1 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2.5 text-center">
              <p className="text-xl font-bold text-rose-600">{unfilledCount}</p>
              <p className="text-[10px] text-rose-400 font-medium mt-0.5">Belum SOAP</p>
            </div>
          </div>
        </div>

        {/* List kunjungan */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-slate-50">
          {timeline.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              Belum ada riwayat kunjungan untuk pasien ini.
            </div>
          ) : timeline.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-2xl border p-4 flex items-center justify-between gap-3 shadow-sm ${
                item.status === 'filled' ? 'border-slate-100' : 'border-rose-200 bg-rose-50/40'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  item.status === 'filled' ? 'bg-emerald-50' : 'bg-rose-50'
                }`}>
                  <Calendar className={`w-4 h-4 ${item.status === 'filled' ? 'text-emerald-500' : 'text-rose-500'}`} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{item.formattedDate}</p>
                  <p className={`text-xs mt-0.5 ${item.status === 'filled' ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {item.status === 'filled' ? '✓ Catatan medis tersedia' : '✗ Belum ada catatan medis'}
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                {item.status === 'filled' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs rounded-xl border-slate-200"
                    onClick={() => handleEdit(item.record.id, item.date)}
                  >
                    <Edit className="w-3 h-3 mr-1" /> Edit
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-blue-600 hover:bg-blue-700 rounded-xl"
                    onClick={() => handleCreate(item.date, item.id)}
                  >
                    <PlusCircle className="w-3 h-3 mr-1" /> Tambah SOAP
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white flex justify-end">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Tutup</Button>
        </div>

      </DialogContent>
    </Dialog>
  );
};

export default PatientSOAPStatusModal;