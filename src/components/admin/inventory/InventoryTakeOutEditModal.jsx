import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { updateInventoryStockOut } from '@/lib/api';

const InventoryTakeOutEditModal = ({ isOpen, onClose, row, onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ quantity: '', taken_date: '', notes: '' });

  useEffect(() => {
    if (row && isOpen) {
      setForm({
        quantity: row.quantity ?? '',
        taken_date: row.taken_date ? row.taken_date.slice(0, 10) : '',
        notes: row.notes || ''
      });
    }
  }, [row, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.quantity || Number(form.quantity) <= 0) {
      toast({ variant: 'destructive', title: 'Data belum lengkap', description: 'Jumlah harus lebih dari 0.' });
      return;
    }
    if (!form.taken_date) {
      toast({ variant: 'destructive', title: 'Data belum lengkap', description: 'Tanggal ambil wajib diisi.' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await updateInventoryStockOut(row.id, form);
      if (error) throw error;
      toast({ title: 'Riwayat pengambilan diperbarui' });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: err.message || 'Terjadi kesalahan.' });
    } finally {
      setLoading(false);
    }
  };

  if (!row) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit Pengambilan: {row.inventory_items?.item_name || '-'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Jumlah ({row.unit})</Label>
              <Input type="number" step="0.01" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tanggal Ambil</Label>
              <Input type="date" value={form.taken_date} onChange={(e) => setForm({ ...form, taken_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Catatan</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Opsional" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default InventoryTakeOutEditModal;
