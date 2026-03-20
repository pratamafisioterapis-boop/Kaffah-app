import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2 } from 'lucide-react';
import { deletePackageTracking } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const DeletePackageModal = ({ isOpen, onClose, packageData, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!packageData) return;
    
    setLoading(true);
    try {
      const { error } = await deletePackageTracking(packageData.id);
      
      if (error) throw error;
      
      toast({
        title: "Paket Dihapus",
        description: `Paket ${packageData.package_name} milik ${packageData.patient?.full_name} berhasil dihapus.`,
      });
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Failed to delete package:", err);
      toast({
        variant: "destructive",
        title: "Gagal Menghapus",
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="w-5 h-5" /> Hapus Paket
          </DialogTitle>
          <DialogDescription>
            Konfirmasi penghapusan paket ini. Tindakan ini tidak dapat dibatalkan.
          </DialogDescription>
        </DialogHeader>

        {packageData && (
          <div className="bg-slate-50 p-4 rounded-md space-y-2 border border-slate-200">
             <div className="grid grid-cols-3 gap-1 text-sm">
                <span className="text-slate-500">Pasien:</span>
                <span className="col-span-2 font-medium">{packageData.patient?.full_name}</span>
                
                <span className="text-slate-500">Paket:</span>
                <span className="col-span-2 font-medium">{packageData.package_name}</span>
                
                <span className="text-slate-500">Total Sesi:</span>
                <span className="col-span-2 font-medium">{packageData.total_sessions} Sesi</span>
             </div>
             
             <div className="mt-3 p-2 bg-red-50 text-red-700 text-xs rounded border border-red-100">
                ⚠️ Peringatan: Menghapus paket ini akan menyebabkan semua rekap harian yang menggunakan paket ini ditandai sebagai "Paket dihapus".
             </div>
          </div>
        )}

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Konfirmasi Hapus
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeletePackageModal;