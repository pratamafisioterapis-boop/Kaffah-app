import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { updateInventoryItem, getAccountingSubcategories } from '@/lib/api';
import SearchableSelect from '@/components/ui/searchable-select';

const UNIT_OPTIONS = ['Liter', 'ML', 'Kg', 'Gram', 'Pcs', 'Box', 'Botol', 'Jerigen', 'Pack'];

const InventoryItemEditModal = ({ isOpen, onClose, item, onSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [subcategoryOptions, setSubcategoryOptions] = useState([]);
  const [form, setForm] = useState({
    item_name: '', unit: 'Pcs', minimum_stock: '', is_active: true,
    category_id: '', subcategory_id: '', categoryName: ''
  });

  useEffect(() => {
    const fetchSubcategories = async () => {
      const { data } = await getAccountingSubcategories();
      if (data) {
        setSubcategoryOptions(
          data
            .filter(sub => sub.parent_category?.type !== 'income')
            .map(sub => ({
              label: sub.subcategory_name,
              value: sub.id,
              categoryName: sub.parent_category?.category_name,
              categoryId: sub.parent_category?.id,
              description: `Kategori: ${sub.parent_category?.category_name || 'N/A'}`
            }))
        );
      }
    };
    if (isOpen) fetchSubcategories();
  }, [isOpen]);

  useEffect(() => {
    if (item && isOpen) {
      setForm({
        item_name: item.item_name || '',
        unit: item.unit || 'Pcs',
        minimum_stock: item.minimum_stock ?? '',
        is_active: item.is_active !== false,
        category_id: item.category_id || '',
        subcategory_id: item.subcategory_id || '',
        categoryName: item.category?.category_name || ''
      });
    }
  }, [item, isOpen]);

  const handleSubCategoryChange = (val) => {
    const selected = subcategoryOptions.find(opt => opt.value === val);
    setForm(prev => ({
      ...prev,
      subcategory_id: val,
      category_id: selected ? selected.categoryId : prev.category_id,
      categoryName: selected ? selected.categoryName : prev.categoryName
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.item_name || !form.unit) {
      toast({ variant: 'destructive', title: 'Data belum lengkap', description: 'Nama barang dan satuan wajib diisi.' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await updateInventoryItem(item.id, form);
      if (error) throw error;
      toast({ title: 'Barang diperbarui' });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: err.message || 'Terjadi kesalahan.' });
    } finally {
      setLoading(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit Barang: {item.item_name}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nama Barang</Label>
            <Input value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Satuan</Label>
              <select className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Stok Minimum</Label>
              <Input type="number" step="0.01" min="0" value={form.minimum_stock} onChange={(e) => setForm({ ...form, minimum_stock: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Kategori Akuntansi</Label>
            <SearchableSelect
              options={subcategoryOptions}
              value={form.subcategory_id}
              onChange={handleSubCategoryChange}
              placeholder="Pilih sub kategori..."
              allowCreate={false}
              notFoundText="Sub kategori tidak ditemukan."
            />
            {form.categoryName && (
              <p className="text-xs text-slate-500">Kategori induk: {form.categoryName}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              id="is_active"
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300"
            />
            <Label htmlFor="is_active" className="cursor-pointer">Barang aktif</Label>
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

export default InventoryItemEditModal;
