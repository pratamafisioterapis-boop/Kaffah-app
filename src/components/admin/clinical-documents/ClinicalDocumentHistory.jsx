import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Trash2, Loader2, FileX2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getClinicalDocuments, deleteClinicalDocument } from '@/lib/api';
import ClinicalDocumentPreviewModal from './ClinicalDocumentPreviewModal';

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

const ClinicalDocumentHistory = ({ documentType, TemplateComponent, previewTitle, clinic, refreshKey }) => {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getClinicalDocuments(documentType);
    if (error) toast({ variant: 'destructive', title: 'Gagal memuat riwayat', description: error.message });
    else setRows(data || []);
    setLoading(false);
  }, [documentType, toast]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleDelete = async (row) => {
    if (!window.confirm(`Hapus dokumen ini untuk ${row.data?.patient_name || 'pasien'}?`)) return;
    setDeletingId(row.id);
    const { error } = await deleteClinicalDocument(row.id);
    setDeletingId(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message });
      return;
    }
    toast({ title: 'Dihapus', description: 'Dokumen berhasil dihapus.' });
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Memuat riwayat...</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/30">
        <div className="p-3 rounded-full bg-slate-100 mb-3"><FileX2 className="w-6 h-6 text-slate-400" /></div>
        <p className="text-sm text-slate-500">Belum ada dokumen yang dibuat.</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile / PWA: cards */}
      <div className="sm:hidden space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-slate-900 break-words">{row.data?.patient_name || row.patients?.full_name || '-'}</p>
                <p className="text-xs text-slate-400 mt-0.5">{row.patients?.medical_record_number || '-'} · {formatDate(row.document_date)}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">Fisioterapis: {row.data?.therapist_name || row.physiotherapists?.name || '-'}</p>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => setSelectedRow(row)}>
                <Eye className="w-3.5 h-3.5" /> Lihat
              </Button>
              <Button size="sm" variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50" disabled={deletingId === row.id} onClick={() => handleDelete(row)}>
                {deletingId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
        <table className="w-full text-sm text-left">
          <thead className="bg-gradient-to-r from-slate-50 to-slate-100/60 text-slate-500 uppercase text-[11px] tracking-wider">
            <tr>
              <th className="px-6 py-3.5 font-semibold">Tanggal</th>
              <th className="px-6 py-3.5 font-semibold">Pasien</th>
              <th className="px-6 py-3.5 font-semibold">No. RM</th>
              <th className="px-6 py-3.5 font-semibold">Fisioterapis</th>
              <th className="px-6 py-3.5 font-semibold text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-6 py-3.5 text-slate-600">{formatDate(row.document_date)}</td>
                <td className="px-6 py-3.5 font-medium text-slate-900">{row.data?.patient_name || row.patients?.full_name || '-'}</td>
                <td className="px-6 py-3.5 text-slate-600 font-mono text-xs">{row.patients?.medical_record_number || '-'}</td>
                <td className="px-6 py-3.5 text-slate-600">{row.data?.therapist_name || row.physiotherapists?.name || '-'}</td>
                <td className="px-6 py-3.5">
                  <div className="flex items-center justify-center gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setSelectedRow(row)}>
                      <Eye className="w-3.5 h-3.5" /> Lihat
                    </Button>
                    <Button size="sm" variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50" disabled={deletingId === row.id} onClick={() => handleDelete(row)}>
                      {deletingId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ClinicalDocumentPreviewModal
        isOpen={!!selectedRow}
        onClose={() => setSelectedRow(null)}
        title={previewTitle}
        fileName={`${previewTitle.replace(/\s+/g, '_')}_${(selectedRow?.data?.patient_name || 'Pasien').replace(/\s+/g, '_')}`}
      >
        {selectedRow && <TemplateComponent data={selectedRow.data} clinic={clinic} />}
      </ClinicalDocumentPreviewModal>
    </>
  );
};

export default ClinicalDocumentHistory;
