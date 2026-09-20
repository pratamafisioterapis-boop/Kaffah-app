import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { updateInventoryStockIn } from '@/lib/api';

const InventoryStockInEditModal = ({ isOpen, onClose, row, item, onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ quantity: '', total_price: '', purchase_date: '', notes: '' });

  useEffect(() => {
    if (row && isOpen) {
      setForm({
        quantity: row.quantity ?? '',
        total_price: row.total_price ?? '',
        purchase_date: row.purchase_date ? row.purchase_date.slice(0, 10) : '',
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
    if (form.total_price === '' || Number(form.total_price) < 0) {
      toast({ variant: 'destructive', title: 'Data belum lengkap', description: 'Harga total tidak valid.' });
      return;
    }
    if (!form.purchase_date) {
      toast({ variant: 'destructive', title: 'Data belum lengkap', description: 'Tanggal pembelian wajib diisi.' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await updateInventoryStockIn(row.id, form);
      if (error) throw error;
      toast({ title: 'Riwayat pembelian diperbarui' });
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
        <DialogHeader><DialogTitle>Edit Pembelian: {item?.item_name || row.inventory_items?.item_name || '-'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Jumlah ({item?.unit || row.inventory_items?.unit})</Label>
              <Input type="number" step="0.01" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tanggal Pembelian</Label>
              <Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Harga Total (Rp)</Label>
            <Input type="number" step="0.01" min="0" value={form.total_price} onChange={(e) => setForm({ ...form, total_price: e.target.value })} />
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

export default InventoryStockInEditModal;
