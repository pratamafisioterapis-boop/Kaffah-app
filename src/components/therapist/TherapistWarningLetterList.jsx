import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, AlertTriangle, Eye, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getMyWarningLetters, getWarningLetterSignedFileUrl, getCurrentClinic } from '@/lib/api';
import { generateWarningLetterPDF, warningLetterFileName } from '@/lib/warningLetterGenerator';
import PdfPreviewModal from '@/components/shared/PdfPreviewModal';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const LEVEL_BADGE_CLASS = {
  SP1: 'bg-amber-50 text-amber-700 border border-amber-200',
  SP2: 'bg-orange-50 text-orange-700 border border-orange-200',
  SP3: 'bg-red-50 text-red-700 border border-red-200',
};

const TherapistWarningLetterList = ({ therapist }) => {
  const [records, setRecords] = useState([]);
  const [clinic, setClinic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    const [{ data }, { data: clinicData }] = await Promise.all([
      getMyWarningLetters(),
      getCurrentClinic(),
    ]);
    setRecords(data || []);
    setClinic(clinicData || null);
    setLoading(false);
  };

  const resolveUrl = async (record) => {
    if (record.status === 'acknowledged' && record.signed_file_path) {
      const { data: url } = await getWarningLetterSignedFileUrl(record.signed_file_path);
      return url;
    }
    const doc = await generateWarningLetterPDF(record, clinic || {}, therapist || {});
    return URL.createObjectURL(doc.output('blob'));
  };

  const handleView = async (record) => {
    setBusyId(record.id);
    const url = await resolveUrl(record);
    setBusyId(null);
    if (url) setPreviewUrl(url);
  };

  const handleDownload = async (record) => {
    setBusyId(record.id);
    const url = await resolveUrl(record);
    setBusyId(null);
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = record.signed_file_name || warningLetterFileName(record, therapist);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          Surat Peringatan
        </h2>
        <p className="text-slate-500 mt-1">
          Riwayat Surat Peringatan (SP) yang diterbitkan atas nama Anda.
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            Tidak ada Surat Peringatan.
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {records.map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-300 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {r.letter_number} · {format(new Date(r.letter_date), 'dd MMM yyyy', { locale: idLocale })}
                  </p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${LEVEL_BADGE_CLASS[r.level]}`}>
                    {r.level}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleView(r)} disabled={busyId === r.id}>
                    {busyId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} Lihat
                  </Button>
                  <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700" onClick={() => handleDownload(r)} disabled={busyId === r.id}>
                    <Download className="w-3.5 h-3.5" /> Download
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <PdfPreviewModal
        open={!!previewUrl}
        onClose={() => setPreviewUrl(null)}
        url={previewUrl}
        title="Preview Surat Peringatan"
      />
    </div>
  );
};

export default TherapistWarningLetterList;
