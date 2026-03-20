import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';
import { deleteAdminExpense } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

const AdminExpenseDeleteConfirmationModal = ({ isOpen, onClose, expense, onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!expense) return;
    
    setLoading(true);
    try {
      const { error } = await deleteAdminExpense(expense.id);
      if (error) throw error;
      
      toast({ 
        title: "Berhasil", 
        description: "Pengeluaran berhasil dihapus.",
        className: "bg-red-50 border-red-200 text-red-900" 
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error("Delete error:", error);
      toast({ variant: "destructive", title: "Gagal", description: error.message || "Gagal menghapus pengeluaran." });
    } finally {
      setLoading(false);
    }
  };

  if (!expense) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !loading && onClose(val)}>
      <DialogContent className="sm:max-w-[450px] bg-white rounded-xl border-0 shadow-xl">
        <DialogHeader className="flex flex-col items-center gap-2 pb-2">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-2">
             <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <DialogTitle className="text-center text-xl font-bold text-slate-900">Hapus Pengeluaran?</DialogTitle>
          <DialogDescription className="text-center">
            Apakah Anda yakin ingin menghapus data pengeluaran ini? Tindakan ini tidak dapat dibatalkan.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3 text-sm my-4">
           <div className="flex justify-between items-center pb-2 border-b border-slate-200 border-dashed">
              <span className="text-slate-500 font-medium">Tanggal</span>
              <span className="font-semibold text-slate-800">{expense.transaction_date ? format(new Date(expense.transaction_date), 'dd/MM/yyyy') : '-'}</span>
           </div>
           <div className="flex justify-between items-center pb-2 border-b border-slate-200 border-dashed">
              <span className="text-slate-500 font-medium">Kategori</span>
              <span className="font-semibold text-slate-800">{expense.sub_category || expense.category}</span>
           </div>
           <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Jumlah</span>
              <span className="font-bold text-red-600 text-base">Rp {Number(expense.amount).toLocaleString('id-ID')}</span>
           </div>
        </div>

        <DialogFooter className="grid grid-cols-2 gap-3 sm:justify-center">
          <Button variant="outline" onClick={() => onClose()} disabled={loading} className="w-full">
            Batal
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading} className="w-full bg-red-600 hover:bg-red-700">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Ya, Hapus
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminExpenseDeleteConfirmationModal;