import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, PlusCircle, UserX, AlertCircle } from 'lucide-react';

const ExpiredPackageWarningModal = ({ 
  isOpen, 
  onClose, 
  patientName, 
  packageInfo, 
  onExtend, 
  onBuyNew,
  onDismiss 
}) => {
  if (!packageInfo) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md border-l-4 border-l-amber-500">
        <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600 mb-2">
                <AlertTriangle className="h-6 w-6" />
                <DialogTitle className="text-xl">Paket Telah Kadaluarsa</DialogTitle>
            </div>
            <DialogDescription className="text-slate-600">
                Paket untuk pasien <span className="font-bold text-slate-800">{patientName}</span> telah berakhir. Anda tidak dapat menggunakan paket ini untuk kunjungan baru kecuali diperpanjang.
            </DialogDescription>
        </DialogHeader>
        
        <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 text-sm space-y-2 mt-2">
            <div className="flex justify-between items-center">
                <span className="text-slate-600">Nama Paket:</span>
                <span className="font-semibold text-slate-900">{packageInfo.package_name}</span>
            </div>
            <div className="flex justify-between items-center">
                <span className="text-slate-600">Sisa Sesi:</span>
                <span className="font-semibold text-slate-900">{packageInfo.sessions_remaining} dari {packageInfo.total_sessions}</span>
            </div>
            <div className="flex justify-between items-center">
                <span className="text-slate-600">Tanggal Expired:</span>
                <span className="font-semibold text-red-600">{packageInfo.end_date}</span>
            </div>
             <div className="flex justify-between items-center pt-1 border-t border-amber-200 mt-1">
                <span className="text-slate-600">Status:</span>
                <span className="font-bold text-amber-700 uppercase text-xs px-2 py-0.5 bg-amber-100 rounded">EXPIRED</span>
            </div>
        </div>

        <div className="flex flex-col gap-3 pt-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Pilih Tindakan:</p>
            
            <Button onClick={onExtend} className="w-full justify-start bg-blue-600 hover:bg-blue-700 text-white h-11">
                <Clock className="w-4 h-4 mr-3" />
                <div className="flex flex-col items-start text-xs">
                    <span className="font-semibold text-sm">Perpanjang Paket Ini</span>
                    <span className="opacity-90">Perbarui masa berlaku paket</span>
                </div>
            </Button>
            
            <Button onClick={onBuyNew} variant="outline" className="w-full justify-start border-green-600 text-green-700 hover:bg-green-50 h-11">
                <PlusCircle className="w-4 h-4 mr-3" />
                <div className="flex flex-col items-start text-xs">
                    <span className="font-semibold text-sm">Beli Paket Baru</span>
                    <span className="opacity-90">Input pembelian paket baru</span>
                </div>
            </Button>
            
            <Button onClick={onDismiss} variant="ghost" className="w-full justify-start text-slate-500 hover:text-slate-700 hover:bg-slate-100 h-11">
                <UserX className="w-4 h-4 mr-3" />
                <div className="flex flex-col items-start text-xs">
                    <span className="font-semibold text-sm">Lanjut Tanpa Paket</span>
                    <span className="opacity-90">Input sebagai kunjungan reguler/umum</span>
                </div>
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExpiredPackageWarningModal;