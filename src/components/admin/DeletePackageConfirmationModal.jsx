import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';

const DeletePackageConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  packageData,
  isDeleting = false
}) => {
  if (!packageData) return null;

  const sessionsUsed = packageData.sessions_used || 0;
  const hasUsage = sessionsUsed > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isDeleting && onClose(open)}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Konfirmasi Hapus Paket
          </DialogTitle>
          <DialogDescription className="pt-2">
            Apakah Anda yakin ingin menghapus paket ini?
          </DialogDescription>
        </DialogHeader>

        <div className="bg-slate-50 p-4 rounded-md border border-slate-200 space-y-3 my-2 text-sm">
          <div className="grid grid-cols-3 gap-2">
            <span className="text-slate-500">Pasien:</span>
            <span className="col-span-2 font-medium">{packageData.patient?.full_name || packageData.guest_name || '-'}</span>
            
            <span className="text-slate-500">Paket:</span>
            <span className="col-span-2 font-medium">{packageData.package_name}</span>
            
            <span className="text-slate-500">Terpakai:</span>
            <span className="col-span-2 font-medium">
               {sessionsUsed} sesi
            </span>
          </div>
        </div>

        {hasUsage && (
             <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700 flex items-start gap-2">
                 <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                 <p>
                    <strong>Peringatan:</strong> Paket ini sudah memiliki {sessionsUsed} sesi terpakai. 
                    Menghapus paket ini mungkin mempengaruhi data riwayat kunjungan.
                 </p>
             </div>
        )}

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="ghost" onClick={onClose} disabled={isDeleting}>
                Batal
            </Button>
            <Button 
                variant="destructive" 
                onClick={onConfirm}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
            >
                {isDeleting ? (
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Menghapus...
                    </>
                ) : (
                    <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Ya, Hapus Paket
                    </>
                )}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeletePackageConfirmationModal;