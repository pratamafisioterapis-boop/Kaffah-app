import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2,
  Copy,
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  FileText,
  Clock
} from 'lucide-react';
import { getMedicalRecords } from '@/lib/api';
import { cn, isValidUUID } from '@/lib/utils';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const SOAPHistoryModal = ({ isOpen, onClose, patientId, onCopy }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (isOpen && patientId && isValidUUID(patientId)) {
      fetchHistory();
    }
  }, [isOpen, patientId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await getMedicalRecords({ patientId });
      if (data) {
        // Ensure sorted by newest
        const sorted = data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setRecords(sorted);
      }
    } catch (err) {
      console.error("Error fetching SOAP history", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleCopy = (record) => {
    onCopy(record);
    onClose();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'dd MMMM yyyy, HH:mm', { locale: id });
  };
const formatDateOnly = (dateString) => {
  if (!dateString) return '-';

  return format(
    new Date(dateString),
    'dd MMMM yyyy',
    { locale: id }
  );
};
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Riwayat Catatan Medis (SOAP)
          </DialogTitle>
          <DialogDescription>
            Lihat dan salin data dari pemeriksaan sebelumnya untuk pasien ini.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 mt-2 space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p>Belum ada riwayat pemeriksaan SOAP untuk pasien ini.</p>
            </div>
          ) : (
            records.map((record) => (
              <motion.div 
                key={record.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "border rounded-xl bg-white shadow-sm overflow-hidden transition-all",
                  expandedId === record.id ? "border-blue-300 ring-1 ring-blue-100" : "border-slate-200 hover:border-blue-200"
                )}
              >
                {/* Header Card */}
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer bg-slate-50/50 hover:bg-slate-50"
                  onClick={() => toggleExpand(record.id)}
                >
                  <div className="space-y-2">

  {/* 🔥 HIGHLIGHT TANGGAL KUNJUNGAN */}
  <div className="flex items-center gap-2">
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 shadow-sm">
      
      <Calendar className="w-3.5 h-3.5 text-blue-600" />

      <span className="text-xs font-semibold text-blue-700">
        Kunjungan:
      </span>

      <span className="text-sm font-bold text-blue-800">
        {formatDateOnly(record.daily_recap?.recap_date)}
      </span>

    </div>
  </div>

  {/* 🔥 DETAIL SOAP */}
  <div className="space-y-1 pl-1">

    <div className="flex items-center gap-2 text-xs text-slate-500">
      <User className="w-3 h-3" />
      {record.therapist_name || 'Tidak diketahui'}
    </div>

    <div className="flex items-center gap-1.5 text-xs text-slate-500">
      <Clock className="w-3 h-3" />

      <span>
        SOAP dibuat:
      </span>

      <span className="font-medium">
        {formatDate(record.created_at)}
      </span>
    </div>

    {record.updated_at && (
      <div className="flex items-center gap-1.5 text-xs text-amber-600">
        <Clock className="w-3 h-3" />

        <span>
          Terakhir diupdate:
        </span>

        <span className="font-medium">
          {formatDate(record.updated_at)}
        </span>
      </div>
    )}

  </div>
</div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-8 gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(record);
                      }}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Salin ke Form</span>
                    </Button>
                    <div className="p-1 rounded-full hover:bg-slate-200 text-slate-400 transition-colors">
                      {expandedId === record.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                <AnimatePresence>
                  {expandedId === record.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-slate-100"
                    >
                      <div className="p-4 grid gap-4 bg-white text-sm">
                        <div>
                          <span className="font-bold text-blue-600 block mb-1">Subjective (S)</span>
                          <p className="text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 whitespace-pre-wrap">{record.subjective || '-'}</p>
                        </div>
                        <div>
                          <span className="font-bold text-blue-600 block mb-1">Objective (O)</span>
                          <p className="text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 whitespace-pre-wrap">{record.objective || '-'}</p>
                        </div>
                        <div>
                          <span className="font-bold text-blue-600 block mb-1">Assessment (A)</span>
                          <p className="text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 whitespace-pre-wrap">{record.assessment || '-'}</p>
                        </div>
                        <div>
                          <span className="font-bold text-blue-600 block mb-1">Plan (P)</span>
                          <p className="text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 whitespace-pre-wrap">{record.plan || '-'}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SOAPHistoryModal;