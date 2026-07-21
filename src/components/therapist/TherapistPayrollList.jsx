import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Receipt, Eye, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getMyPayrollRecords, getCurrentClinic } from '@/lib/api';
import { generatePayslipPDF, payslipFileName } from '@/lib/payslipGenerator';
import PdfPreviewModal from '@/components/shared/PdfPreviewModal';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const STATUS_LABEL = { draft: 'Draft', approved: 'Disetujui', paid: 'Dibayar' };
const STATUS_BADGE_CLASS = {
  draft: 'bg-amber-50 text-amber-700 border border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border border-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
};

const TherapistPayrollList = ({ therapist }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clinic, setClinic] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    fetchRecords();
    fetchClinic();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    const { data } = await getMyPayrollRecords();
    setRecords(data || []);
    setLoading(false);
  };

  const fetchClinic = async () => {
    const { data } = await getCurrentClinic();
    if (data) setClinic(data);
  };

  const handleView = (record) => {
    const doc = generatePayslipPDF(record, therapist || {}, clinic || {});
    setPreviewUrl(URL.createObjectURL(doc.output('blob')));
  };

  const handleDownload = (record) => {
    const doc = generatePayslipPDF(record, therapist || {}, clinic || {});
    doc.save(payslipFileName(record, therapist || {}));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Receipt className="w-6 h-6 text-emerald-600" />
          Payroll
        </h2>
        <p className="text-slate-500 mt-1">
          Slip gaji Anda. Lihat rincian dan unduh dokumen PDF untuk setiap periode.
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            Belum ada slip gaji yang diterbitkan.
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
                    {format(new Date(r.payroll_period_end), 'MMMM yyyy', { locale: idLocale })}
                  </p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE_CLASS[r.status] || STATUS_BADGE_CLASS.paid}`}>
                    {STATUS_LABEL[r.status] || STATUS_LABEL.paid}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleView(r)}>
                    <Eye className="w-3.5 h-3.5" /> Lihat
                  </Button>
                  <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleDownload(r)}>
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
        title="Preview Slip Gaji"
      />
    </div>
  );
};

export default TherapistPayrollList;
