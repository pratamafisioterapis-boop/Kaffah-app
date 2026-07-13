import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { restockInventoryItem } from '@/lib/api';
import { format } from 'date-fns';

const InventoryRestockModal = ({ isOpen, onClose, item, onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ quantity: '', total_price: '', purchase_date: format(new Date(), 'yyyy-MM-dd'), notes: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.quantity || !form.total_price) {
      toast({ variant: 'destructive', title: 'Data belum lengkap' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await restockInventoryItem({ item_id: item.id, ...form });
      if (error) throw error;
      toast({ title: 'Stok berhasil ditambahkan' });
      setForm({ quantity: '', total_price: '', purchase_date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal restock', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Tambah Stok: {item.item_name}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-slate-500">Stok saat ini: <span className="font-semibold text-slate-800">{item.current_stock} {item.unit}</span></p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kuantitas Beli ({item.unit})</Label>
              <Input type="number" step="0.01" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Harga Total (Rp)</Label>
              <Input type="number" min="0" value={form.total_price} onChange={(e) => setForm({ ...form, total_price: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tanggal Beli</Label>
            <Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Catatan (opsional)</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Misal: beli di toko X" />
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

export default InventoryRestockModal;