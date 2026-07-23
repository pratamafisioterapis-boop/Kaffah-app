import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ScrollText, Eye, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getMyMouDocuments, getMouSignedFileUrl } from '@/lib/api';
import PdfPreviewModal from '@/components/shared/PdfPreviewModal';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const TherapistMouList = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    const { data } = await getMyMouDocuments();
    setRecords(data || []);
    setLoading(false);
  };

  const handleView = async (record) => {
    setBusyId(record.id);
    const { data: url, error } = await getMouSignedFileUrl(record.signed_file_path);
    setBusyId(null);
    if (url) setPreviewUrl(url);
  };

  const handleDownload = async (record) => {
    setBusyId(record.id);
    const { data: url } = await getMouSignedFileUrl(record.signed_file_path);
    setBusyId(null);
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = record.signed_file_name || 'MOU-Kemitraan.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ScrollText className="w-6 h-6 text-emerald-600" />
          MOU Kemitraan
        </h2>
        <p className="text-slate-500 mt-1">
          Dokumen Perjanjian Kerjasama Kemitraan yang telah ditandatangani, per periode tahunan.
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            Belum ada dokumen MOU yang diterbitkan.
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
                  <p className="text-sm font-medium text-slate-700">
                    {format(new Date(r.period_start), 'dd MMM yyyy', { locale: idLocale })} — {format(new Date(r.period_end), 'dd MMM yyyy', { locale: idLocale })}
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Tahun ke-{r.period_number}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleView(r)} disabled={busyId === r.id}>
                    {busyId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} Lihat
                  </Button>
                  <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleDownload(r)} disabled={busyId === r.id}>
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
        title="Preview MOU Kemitraan"
      />
    </div>
  );
};

export default TherapistMouList;
