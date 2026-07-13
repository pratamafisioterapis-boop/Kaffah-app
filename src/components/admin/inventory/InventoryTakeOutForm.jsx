import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { getInventoryItems, takeInventoryStock } from '@/lib/api';
import { format } from 'date-fns';
import SearchableSelect from '@/components/ui/searchable-select';

const InventoryTakeOutForm = ({ onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ item_id: '', quantity: '', taken_date: format(new Date(), 'yyyy-MM-dd'), notes: '' });

  useEffect(() => { (async () => { const { data } = await getInventoryItems(); setItems(data || []); })(); }, []);

  const selectedItem = items.find(i => i.id === form.item_id);
  const estimatedCost = selectedItem && form.quantity ? Number(form.quantity) * Number(selectedItem.price_per_unit) : 0;
  const itemOptions = items.map(i => ({
    label: `${i.item_name} (sisa ${Number(i.current_stock).toLocaleString('id-ID', { maximumFractionDigits: 2 })} ${i.unit})`,
    value: i.id
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.item_id || !form.quantity || !form.taken_date) {
      toast({ variant: 'destructive', title: 'Data belum lengkap' });
      return;
    }
    if (selectedItem && Number(form.quantity) > Number(selectedItem.current_stock)) {
      toast({ variant: 'destructive', title: 'Stok tidak cukup', description: `Sisa stok hanya ${selectedItem.current_stock} ${selectedItem.unit}` });
      return;
    }
    setLoading(true);
    try {
      const { error } = await takeInventoryStock(form);
      if (error) throw error;
      toast({ title: 'Barang berhasil diambil', description: 'Stok gudang berkurang dan pengeluaran tercatat otomatis.' });
      setForm({ item_id: '', quantity: '', taken_date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
      if (onSuccess) onSuccess();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal mengambil barang', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-xl border border-slate-200">
      <h3 className="text-lg font-semibold text-slate-900 mb-2">Ambil Barang Gudang</h3>
      <div className="space-y-2">
        <Label>Pilih Barang</Label>
        <SearchableSelect options={itemOptions} value={form.item_id} onChange={(val) => setForm({ ...form, item_id: val })} placeholder="Pilih barang..." allowCreate={false} notFoundText="Barang tidak ditemukan." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Jumlah {selectedItem ? `(${selectedItem.unit})` : ''}</Label>
          <Input type="number" step="0.01" min="0" placeholder="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Tanggal Ambil</Label>
          <Input type="date" value={form.taken_date} onChange={(e) => setForm({ ...form, taken_date: e.target.value })} />
        </div>
      </div>

      {selectedItem && ['Liter', 'Kg'].includes(selectedItem.unit) && (
        <div className="space-y-2">
          <Label className="text-xs text-slate-500">
            Atau isi dalam {selectedItem.unit === 'Liter' ? 'mL' : 'Gram'} (otomatis dikonversi ke {selectedItem.unit})
          </Label>
          <Input
            type="number"
            step="1"
            min="0"
            placeholder={selectedItem.unit === 'Liter' ? 'Misal: 500' : 'Misal: 250'}
            onChange={(e) => {
              const smallUnitValue = Number(e.target.value) || 0;
              setForm({ ...form, quantity: smallUnitValue > 0 ? String(smallUnitValue / 1000) : '' });
            }}
          />
        </div>
      )}
      <div className="space-y-2">
        <Label>Catatan (opsional)</Label>
        <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Misal: isi ulang botol dispenser" />
      </div>
      {selectedItem && form.quantity && (
        <div className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-600">
          Estimasi nilai pengeluaran: <span className="font-semibold text-slate-900">Rp {estimatedCost.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
          <br />Otomatis tercatat di Accounting {'>'} Pengeluaran.
        </div>
      )}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Ambil Barang
      </Button>
    </form>
  );
};

export default InventoryTakeOutForm;