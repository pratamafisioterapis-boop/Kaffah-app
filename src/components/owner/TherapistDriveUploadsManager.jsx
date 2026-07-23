import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, ExternalLink, RefreshCw, FolderOpen, Loader2, User, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { getClinicDriveUploads, deleteDriveUpload } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const getDriveDownloadLink = (webViewLink) => {
  if (!webViewLink) return null;
  const match = webViewLink.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const fileId = match ? match[1] : null;
  if (!fileId) return null;
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
};

const TherapistDriveUploadsManager = () => {
  const { toast } = useToast();
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUploads = async () => {
    setLoading(true);
    const { data, error } = await getClinicDriveUploads();
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal Memuat', description: error.message });
    } else {
      setUploads(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUploads();
  }, []);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const { success, error } = await deleteDriveUpload(deleteTarget.id);
    if (success) {
      toast({ title: 'Terhapus', description: 'Konten terapis telah dihapus dari Drive.' });
      setUploads((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setDeleteTarget(null);
    } else {
      toast({ variant: 'destructive', title: 'Gagal Menghapus', description: error?.message });
    }
    setIsDeleting(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-blue-600" /> Konten Upload Terapis
          </h3>
          <p className="text-sm text-slate-500">Pantau dan kelola konten yang diunggah terapis ke Google Drive klinik.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchUploads} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
      ) : uploads.length === 0 ? (
        <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
          Belum ada konten yang diunggah terapis.
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {uploads.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{item.file_name}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {item.therapist_name} • {item.created_at ? format(new Date(item.created_at), 'dd MMM yyyy, HH:mm', { locale: idLocale }) : '-'}
                    {item.label ? ` • ${item.label}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {item.web_view_link && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => window.open(item.web_view_link, '_blank')} title="Buka di Drive">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                )}
                {getDriveDownloadLink(item.web_view_link) && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" onClick={() => window.open(getDriveDownloadLink(item.web_view_link), '_blank')} title="Download">
                    <Download className="w-4 h-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => setDeleteTarget(item)} title="Hapus">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" /> Hapus Konten Terapis
            </DialogTitle>
            <DialogDescription className="pt-2">
              Hapus "{deleteTarget?.file_name}" milik {deleteTarget?.therapist_name} secara permanen dari Google Drive? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>Batal</Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
              {isDeleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Ya, Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TherapistDriveUploadsManager;
