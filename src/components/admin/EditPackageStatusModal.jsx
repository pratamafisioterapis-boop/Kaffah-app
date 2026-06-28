import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { updatePackageTracking } from '@/lib/api';

const EditPackageStatusModal = ({ isOpen, onClose, packageData, onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    status: 'aktif',
    end_date: '',
    extended_until: ''
  });

  // State for confirmation dialog
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [isAutoComplete, setIsAutoComplete] = useState(false);

  useEffect(() => {
    if (packageData) {
      setFormData({
        status: packageData.status || 'aktif',
        end_date: packageData.end_date && typeof packageData.end_date === 'string' 
          ? packageData.end_date.split('T')[0] 
          : '',
        extended_until: packageData.extended_until && typeof packageData.extended_until === 'string' 
          ? packageData.extended_until.split('T')[0] 
          : ''
      });
    } else {
        // Reset or set defaults if no packageData
        setFormData({
            status: 'aktif',
            end_date: '',
            extended_until: ''
        });
    }
  }, [packageData, isOpen]); 

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!packageData) return;
    
    const newStatus = formData.status;
    const oldStatus = packageData.status;

    // Task 1: Detect status change to "selesai"
    if (newStatus === 'selesai') {
      if (oldStatus === 'selesai') {
        toast({
          title: "Info",
          description: "Paket sudah selesai.",
        });
        return;
      } else {
        // Prepare auto-complete confirmation
        setIsAutoComplete(true);
        setConfirmMessage(`Ubah status menjadi Selesai?\nSesi terpakai akan otomatis menjadi ${packageData.total_sessions} dari ${packageData.total_sessions}.`);
        setShowConfirm(true);
        return;
      }
    }

    // Normal status change
    setIsAutoComplete(false);
    setConfirmMessage("Apakah Anda yakin ingin mengubah status paket ini?");
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setLoading(true);
    // Hide confirm dialog immediately to show progress on main modal
    setShowConfirm(false);

    try {
      const updates = {
        status: formData.status,
        end_date: formData.end_date || null,
        extended_until: formData.extended_until || null,
        updated_at: new Date().toISOString()
      };

      // Task 2: Auto-complete logic
      if (isAutoComplete) {
        updates.sessions_used = packageData.total_sessions;
        updates.sessions_remaining = 0;
      }

      // Call API
      const { error } = await updatePackageTracking(packageData.id, updates);

      if (error) throw error;

      toast({
        title: isAutoComplete ? "Paket Selesai" : "Status Diperbarui",
        description: isAutoComplete ? "Paket berhasil diselesaikan." : "Status paket berhasil diperbarui.",
      });
      
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error updating package:', error);
      toast({
        variant: "destructive",
        title: "Gagal Update",
        description: error.message || "Gagal mengubah status paket"
      });
    } finally {
      setLoading(false);
    }
  };

  const getFormattedDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd MMMM yyyy', { locale: id });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !loading && onClose(open)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Status Paket</DialogTitle>
            <DialogDescription>
              Ubah status dan masa berlaku paket pasien.
            </DialogDescription>
          </DialogHeader>

          {packageData && (
            <div className="bg-slate-50 p-4 rounded-md mb-4 text-sm grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                  <span className="text-slate-500 block text-xs">Pasien</span>
                  <span className="font-medium text-slate-900">{packageData.patient?.full_name}</span>
              </div>
              <div>
                  <span className="text-slate-500 block text-xs">Paket</span>
                  <span className="font-medium text-slate-900">{packageData.package_name}</span>
              </div>
              <div>
                  <span className="text-slate-500 block text-xs">Tanggal Beli</span>
                  <span className="font-medium text-slate-900">{getFormattedDate(packageData.start_date)}</span>
              </div>
              <div>
                  <span className="text-slate-500 block text-xs">Penggunaan</span>
                  <span className="font-medium text-slate-900">
                    {packageData.computed_sessions_used !== undefined ? packageData.computed_sessions_used : packageData.sessions_used} / {packageData.computed_total_sessions !== undefined ? packageData.computed_total_sessions : packageData.total_sessions} Sesi
                  </span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status Paket</Label>
              <Select 
                value={formData.status} 
                onValueChange={(val) => setFormData(prev => ({ ...prev, status: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aktif">Aktif</SelectItem>
                  <SelectItem value="selesai">Selesai (Habis)</SelectItem>
                  <SelectItem value="expired">Expired (Kadaluarsa)</SelectItem>
                  <SelectItem value="diperpanjang">Diperpanjang</SelectItem>
                  <SelectItem value="pending">Pending (Belum Dimulai)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="end_date">Tanggal Selesai</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="extended_until">Diperpanjang Hingga</Label>
                <Input
                  id="extended_until"
                  type="date"
                  value={formData.extended_until}
                  onChange={(e) => setFormData(prev => ({ ...prev, extended_until: e.target.value }))}
                  disabled={formData.status !== 'diperpanjang'}
                />
              </div>
            </div>
            
            {formData.status === 'diperpanjang' && (
              <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                Paket diperpanjang akan menggunakan tanggal "Diperpanjang Hingga" sebagai batas waktu baru.
              </p>
            )}

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => onClose(false)} disabled={loading}>
                Batal
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Konfirmasi Perubahan Status
            </DialogTitle>
            <DialogDescription className="pt-2 whitespace-pre-line text-slate-600">
              {confirmMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={loading}>
              Batal
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={loading} 
              className={isAutoComplete ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EditPackageStatusModal;