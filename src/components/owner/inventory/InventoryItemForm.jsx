import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { createInventoryItem, getAccountingSubcategories } from '@/lib/api';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import SearchableSelect from '@/components/ui/searchable-select';

const UNIT_OPTIONS = ['Liter', 'ML', 'Kg', 'Gram', 'Pcs', 'Box', 'Botol', 'Jerigen', 'Pack'];

const InventoryItemForm = ({ onSuccess }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [subcategoryOptions, setSubcategoryOptions] = useState([]);
  const [form, setForm] = useState({
    item_name: '', unit: 'Pcs', quantity: '', total_price: '',
    minimum_stock: '', purchase_date: format(new Date(), 'yyyy-MM-dd'),
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
    fetchSubcategories();
  }, []);

  const pricePerUnit = Number(form.quantity) > 0 ? Number(form.total_price) / Number(form.quantity) : 0;

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
    if (!form.item_name || !form.unit || !form.quantity || !form.total_price) {
      toast({ variant: 'destructive', title: 'Data belum lengkap', description: 'Nama barang, satuan, kuantitas, dan harga wajib diisi.' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await createInventoryItem({ ...form, created_by: user?.id });
      if (error) throw error;
      toast({ title: 'Barang ditambahkan', description: `${form.item_name} berhasil disimpan ke stok gudang.` });
      setForm({ item_name: '', unit: 'Pcs', quantity: '', total_price: '', minimum_stock: '', purchase_date: format(new Date(), 'yyyy-MM-dd'), category_id: '', subcategory_id: '', categoryName: '' });
      if (onSuccess) onSuccess();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: err.message || 'Terjadi kesalahan.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-xl border border-slate-200">
      <h3 className="text-lg font-semibold text-slate-900 mb-2">Tambah Barang Baru</h3>
      <div className="space-y-2">
        <Label htmlFor="item_name">Nama Barang</Label>
        <Input id="item_name" placeholder="Misal: Sabun Cuci Tangan" value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="unit">Satuan</Label>
          <select id="unit" className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
            {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity">Kuantitas Awal</Label>
          <Input id="quantity" type="number" step="0.01" min="0" placeholder="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="total_price">Harga Total Pembelian (Rp)</Label>
          <Input id="total_price" type="number" min="0" placeholder="0" value={form.total_price} onChange={(e) => setForm({ ...form, total_price: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="purchase_date">Tanggal Beli</Label>
          <Input id="purchase_date" type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="minimum_stock">Stok Minimum (opsional, untuk alert)</Label>
        <Input id="minimum_stock" type="number" step="0.01" min="0" placeholder="0" value={form.minimum_stock} onChange={(e) => setForm({ ...form, minimum_stock: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="subcategory">Kategori Akuntansi (opsional)</Label>
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
      {pricePerUnit > 0 && (
        <div className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-600">
          Harga per {form.unit || 'satuan'}: <span className="font-semibold text-slate-900">Rp {pricePerUnit.toLocaleString('id-ID', { maximumFractionDigits: 2 })}</span>
        </div>
      )}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Simpan Barang
      </Button>
    </form>
  );
};

export default InventoryItemForm;