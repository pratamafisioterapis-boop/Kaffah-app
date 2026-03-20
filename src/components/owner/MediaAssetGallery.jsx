import React, { useEffect, useState } from 'react';
import { Trash2, ExternalLink, RefreshCw, AlertCircle, Calendar, Tag, HardDrive, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useMediaAssets } from '@/lib/hooks/useMediaAssets';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

const MediaAssetGallery = () => {
  const { assets, fetchAssets, deleteAsset, loading } = useMediaAssets();
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState(null);
  const [deletePath, setDeletePath] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleDeleteClick = (asset) => {
    setDeleteId(asset.id);
    setDeletePath(asset.file_path);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId || !deletePath) return;
    
    setIsDeleting(true);
    const result = await deleteAsset(deleteId, deletePath);
    
    if (result.success) {
      toast({
        title: "Terhapus",
        description: "File telah berhasil dihapus."
      });
      setDeleteId(null);
      setDeletePath(null);
    } else {
      toast({
        variant: "destructive",
        title: "Gagal Menghapus",
        description: result.error
      });
    }
    setIsDeleting(false);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Galeri Media</h3>
          <p className="text-sm text-slate-500">Kelola semua aset media yang telah diunggah.</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchAssets} 
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading && assets.length === 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-40 w-full rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : assets.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {assets.map((asset) => (
            <div 
              key={asset.id} 
              className="group bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-200 flex flex-col h-full"
            >
              <div className="relative aspect-video bg-slate-100 border-b border-slate-100 overflow-hidden">
                <img 
                  src={asset.file_url} 
                  alt={asset.name} 
                  className="w-full h-full object-contain p-2"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2">
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="h-8 w-8 rounded-full bg-white shadow-sm hover:bg-slate-50"
                    onClick={() => window.open(asset.file_url, '_blank')}
                    title="Lihat Full Size"
                  >
                    <ExternalLink className="w-4 h-4 text-slate-700" />
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="icon" 
                    className="h-8 w-8 rounded-full shadow-sm"
                    onClick={() => handleDeleteClick(asset)}
                    title="Hapus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="absolute top-2 left-2">
                  <span className="px-2 py-1 bg-white/90 backdrop-blur-sm rounded text-[10px] font-semibold text-slate-700 shadow-sm border border-slate-200 uppercase tracking-wide">
                    {asset.category}
                  </span>
                </div>
              </div>

              <div className="p-4 flex flex-col flex-grow">
                <h4 className="font-medium text-slate-900 text-sm truncate mb-3" title={asset.name}>
                  {asset.name}
                </h4>
                
                <div className="space-y-2 mt-auto">
                  <div className="flex items-center text-xs text-slate-500 gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {asset.created_at ? format(new Date(asset.created_at), 'dd MMM yyyy, HH:mm', { locale: idLocale }) : '-'}
                    </span>
                  </div>
                  <div className="flex items-center text-xs text-slate-500 gap-2">
                    <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formatFileSize(asset.file_size)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">Belum ada media</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
            Mulai dengan mengunggah gambar logo, banner, atau aset visual lainnya untuk klinik Anda.
          </p>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Hapus Aset Media
            </DialogTitle>
            <DialogDescription className="pt-2">
              Apakah Anda yakin ingin menghapus file ini secara permanen? Tindakan ini tidak dapat dibatalkan dan mungkin mempengaruhi tampilan website jika file sedang digunakan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={isDeleting}>
              Batal
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmDelete} 
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Ya, Hapus Permanen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MediaAssetGallery;