import React, { useState } from 'react';
import { 
  Trash2, 
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import DailyRecap from '@/components/admin/DailyRecap';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const OwnerDailyRecap = () => {
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const { toast } = useToast();
  const { clinicName } = useAuth();
  
  // Delete State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDateRange, setDeleteDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [deleting, setDeleting] = useState(false);

  // --- Delete Logic ---
  const handleDeleteByRange = async () => {
    if (!deleteDateRange.startDate || !deleteDateRange.endDate) {
      toast({
        variant: "destructive",
        title: "Error Validasi",
        description: "Harap pilih tanggal mulai dan tanggal akhir."
      });
      return;
    }

    if (new Date(deleteDateRange.startDate) > new Date(deleteDateRange.endDate)) {
       toast({
        variant: "destructive",
        title: "Error Validasi",
        description: "Tanggal mulai tidak boleh lebih besar dari tanggal akhir."
      });
      return;
    }

    if (!window.confirm(`PERINGATAN: Anda akan menghapus SEMUA data rekap harian dari tanggal ${deleteDateRange.startDate} sampai ${deleteDateRange.endDate}. Tindakan ini tidak dapat dibatalkan. Lanjutkan?`)) {
        return;
    }

    setDeleting(true);
    try {
      const { error, count } = await supabase
        .from('daily_recaps')
        .delete({ count: 'exact' })
        .gte('recap_date', deleteDateRange.startDate)
        .lte('recap_date', deleteDateRange.endDate);

      if (error) throw error;

      toast({
        title: "Penghapusan Berhasil",
        description: `${count || 'Sejumlah'} data rekap harian telah dihapus permanen.`
      });
      setDeleteDialogOpen(false);
      // tidak perlu reload, realtime sudah handle update
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Gagal Menghapus",
        description: err.message
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner khusus PWA */}
      {isPWA && (
        <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 shadow-xl border border-slate-700/50 relative">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #d4af6a 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="relative flex items-center gap-4 px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 backdrop-blur-sm border border-amber-300/30 flex items-center justify-center shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold tracking-widest text-amber-300/80 uppercase mb-1">{clinicName || ''}</p>
              <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">Rekap Harian</h2>
              <p className="text-sm text-slate-400 mt-0.5">Kelola data kunjungan dan pendapatan harian klinik</p>
            </div>
          </div>
        </div>
      )}
      {/* Re-use the Admin Component for viewing/managing individual items */}
      <DailyRecap showPaymentFilter />

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
               <Trash2 className="w-5 h-5" /> Hapus Data Rekap Harian
            </DialogTitle>
            <DialogDescription>
              Pilih rentang tanggal data yang ingin dihapus. <br/>
              <span className="font-bold text-red-500">PERINGATAN: Data yang dihapus tidak dapat dikembalikan!</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Dari Tanggal</label>
              <Input
                type="date"
                value={deleteDateRange.startDate}
                onChange={(e) => setDeleteDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Sampai Tanggal</label>
              <Input
                type="date"
                value={deleteDateRange.endDate}
                onChange={(e) => setDeleteDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Batal</Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteByRange}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Menghapus...' : 'Hapus Permanen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OwnerDailyRecap;