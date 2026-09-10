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
        <div className="relative overflow-hidden rounded-[18px] sm:rounded-[22px] border border-[#DCE8F2] shadow-sm h-44 sm:h-52 md:h-60 lg:h-72">
          <img
            src="/hero/clinara-recap-hero.png"
            alt="Kaffah Physiotherapy"
            className="absolute inset-0 w-full h-full object-cover object-[38%_center]"
          />
          <div className="absolute inset-0 flex flex-col justify-center px-4 sm:px-6 md:px-10 lg:px-14">
            <div className="max-w-[74%] sm:max-w-[62%] md:max-w-sm">
              <p className="text-[#5B6B7D] text-xs sm:text-sm font-medium mb-1">{clinicName || ''}</p>
              <h1
                style={{ fontFamily: "'Caveat', cursive" }}
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#102F52] leading-[0.85]"
              >
                Rekap<br />
                <span className="text-[#2F8CFF] underline decoration-wavy decoration-2 md:decoration-[3px] underline-offset-4 md:underline-offset-8">
                  Harian
                </span>
              </h1>
              <p className="text-[#5B6B7D] text-[10px] sm:text-xs md:text-sm mt-1.5 md:mt-3 leading-snug md:leading-relaxed">
                Kelola data kunjungan dan pendapatan harian klinik.
              </p>
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