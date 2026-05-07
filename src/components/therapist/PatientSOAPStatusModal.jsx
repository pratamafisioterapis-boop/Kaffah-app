import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { FileText, Edit, CheckCircle2, AlertCircle, PlusCircle, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PatientSOAPStatusModal = ({ patient, visits, records, isOpen, onClose }) => {
  const navigate = useNavigate();

  if (!patient) return null;

  const handleCreate = (date, dailyRecapId) => {
  navigate(`/therapist/records/new/${patient.id}?date=${date}&dailyRecapId=${dailyRecapId}`);
  onClose();
};

  const handleEdit = (recordId, date) => {
    navigate(`/therapist/records/new/${patient.id}?recordId=${recordId}&date=${date}`);
    onClose();
  };

  // Merge visits with records to determine status
  const timeline = visits.map(visit => {
    const visitDate = visit.recap_date; // YYYY-MM-DD
    
    // Find record created on this date
    const matchedRecord = records.find(r => {
        const recordDate = format(new Date(r.created_at), 'yyyy-MM-dd');
        return recordDate === visitDate;
    });

    return {
        id: visit.id,
        date: visitDate,
        formattedDate: format(new Date(visitDate), 'dd MMMM yyyy', { locale: id }),
        record: matchedRecord,
        status: matchedRecord ? 'filled' : 'unfilled'
    };
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl flex flex-col max-h-[85vh] p-0 gap-0">
        <div className="p-6 pb-4 border-b">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Riwayat Kunjungan: {patient.full_name}
            </DialogTitle>
            <DialogDescription>
              ID Pasien: {patient.rm_number} • Daftar kunjungan dan status SOAP
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {timeline.length === 0 ? (
              <div className="text-center py-10 text-slate-500 bg-slate-50 rounded-lg border border-dashed">
                <p>Belum ada riwayat kunjungan (Daily Recap) untuk pasien ini.</p>
              </div>
            ) : (
              timeline.map((item) => (
                <div 
                    key={item.id} 
                    className={`p-4 rounded-lg border transition-colors ${item.status === 'filled' ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-red-100 bg-red-50/30 hover:bg-red-50/60'}`}
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                      <div className="flex items-center gap-4 w-full sm:w-auto">
                         <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.status === 'filled' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                            <Calendar className="w-5 h-5" />
                         </div>
                         <div>
                            <h4 className="font-semibold text-slate-900">{item.formattedDate}</h4>
                            <p className="text-sm text-slate-500">
                               {item.status === 'filled' 
                                 ? 'Catatan medis sudah tersedia' 
                                 : 'Belum ada catatan medis untuk kunjungan ini'}
                            </p>
                         </div>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        {item.status === 'filled' ? (
                          <>
                             <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 shadow-none h-8 px-3 whitespace-nowrap">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Sudah Diisi
                             </Badge>
                             <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-8 text-xs"
                                onClick={() => handleEdit(item.record.id, item.date)}
                              >
                                <Edit className="w-3 h-3 mr-1" /> Edit
                              </Button>
                          </>
                        ) : (
                          <>
                             <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 shadow-none h-8 px-3 whitespace-nowrap">
                                <AlertCircle className="w-3.5 h-3.5 mr-1.5" /> Belum Diisi
                             </Badge>
                             <Button 
                                size="sm" 
                                className="bg-blue-600 hover:bg-blue-700 h-8 text-xs"
                                onClick={() => handleCreate(item.date, item.id)}
                              >
                                <PlusCircle className="w-3 h-3 mr-1" /> Tambah SOAP
                              </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
              ))
            )}
          </div>
        </div>

        <div className="p-4 border-t bg-white rounded-b-lg flex justify-end shrink-0">
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PatientSOAPStatusModal;