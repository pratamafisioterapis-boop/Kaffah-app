import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { confirmAction } from '@/lib/confirmAction';

const CATEGORIES = [
  { value: 'procedure', label: 'Procedure' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'drug', label: 'Drug' },
  { value: 'consultation', label: 'Consultation' },
  { value: 'administration', label: 'Administration' },
];

const EMPTY_FORM = {
  name: '', base_price: '', margin_pct: '0', selling_price: '',
  company_portion_pct: '100', doctor_portion_pct: '0',
};

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

// Harga jual otomatis = harga dasar + margin, kalau harga dasar terisi.
const calcSelling = (base, margin) => Math.round(num(base) * (1 + num(margin) / 100));

const PriceCatalogManager = () => {
  const { toast } = useToast();
  const { userDetails } = useAuth();
  const clinicId = userDetails?.clinic_id;
  const [category, setCategory] = useState('procedure');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchItems = async () => {
    if (!clinicId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('price_catalog_items')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('name', { ascending: true });
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Gagal memuat katalog harga.' });
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [clinicId]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => i.category === category && (!q || (i.name || '').toLowerCase().includes(q)));
  }, [items, category, search]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ variant: 'destructive', title: 'Nama wajib diisi' });
      return;
    }
    setSaving(true);
    const selling = form.selling_price !== '' ? num(form.selling_price)
      : (num(form.base_price) > 0 ? calcSelling(form.base_price, form.margin_pct) : null);
    const { data, error } = await supabase
      .from('price_catalog_items')
      .insert({
        clinic_id: clinicId,
        category,
        name: form.name.trim(),
        base_price: num(form.base_price),
        margin_pct: num(form.margin_pct),
        selling_price: selling,
        company_portion_pct: num(form.company_portion_pct),
        doctor_portion_pct: num(form.doctor_portion_pct),
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
      return;
    }
    setItems((prev) => [...prev, data]);
    setForm(EMPTY_FORM);
    toast({ title: 'Item ditambahkan' });
  };

  const patchLocal = (id, patch) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  // Simpan satu baris ke database (dipanggil saat input blur / checkbox berubah).
  const persist = async (id, patch) => {
    const { error } = await supabase
      .from('price_catalog_items')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
      fetchItems();
    }
  };

  const handleMarginOrBaseBlur = (item) => {
    const patch = {
      base_price: num(item.base_price),
      margin_pct: num(item.margin_pct),
    };
    if (num(item.base_price) > 0) patch.selling_price = calcSelling(item.base_price, item.margin_pct);
    patchLocal(item.id, patch);
    persist(item.id, patch);
  };

  const handleDelete = async (item) => {
    if (!await confirmAction(`Hapus "${item.name}"?`)) return;
    const { error } = await supabase.from('price_catalog_items').delete().eq('id', item.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message });
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  const cell = 'w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm';

  const numInput = (item, field, opts = {}) => (
    <input
      type="number"
      min="0"
      className={`${cell} ${opts.className || ''}`}
      value={item[field] ?? ''}
      onChange={(e) => patchLocal(item.id, { [field]: e.target.value })}
      onBlur={opts.onBlur || (() => persist(item.id, { [field]: item[field] === '' || item[field] == null ? null : num(item[field]) }))}
    />
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Katalog Harga</h3>
        <p className="text-sm text-slate-500">
          Daftar Procedure, Consumable, Drug, Consultation, dan Administration beserta harga, margin, dan porsi.
          Saat ini hanya disimpan sebagai data.
        </p>
      </div>

      <Tabs value={category} onValueChange={setCategory}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c.value} value={c.value}>{c.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <form onSubmit={handleAdd} className="grid grid-cols-2 md:grid-cols-7 gap-2 items-end rounded-app-sm border border-slate-200 p-3 bg-slate-50">
        <div className="col-span-2">
          <label className="text-xs text-slate-500">Nama</label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama item" />
        </div>
        <div>
          <label className="text-xs text-slate-500">Harga Dasar (Rp)</label>
          <Input type="number" min="0" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Margin (%)</label>
          <Input type="number" min="0" value={form.margin_pct} onChange={(e) => setForm({ ...form, margin_pct: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Harga Jual (Rp)</label>
          <Input type="number" min="0" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Porsi Klinik (%)</label>
          <Input type="number" min="0" value={form.company_portion_pct} onChange={(e) => setForm({ ...form, company_portion_pct: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Porsi Dokter (%)</label>
          <Input type="number" min="0" value={form.doctor_portion_pct} onChange={(e) => setForm({ ...form, doctor_portion_pct: e.target.value })} />
        </div>
        <Button type="submit" disabled={saving} className="col-span-2 md:col-span-7 md:w-fit">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          Tambah ke {CATEGORIES.find((c) => c.value === category)?.label}
        </Button>
      </form>

      <div className="relative max-w-xs">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
        <Input className="pl-8" placeholder="Cari..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="overflow-x-auto rounded-app-sm border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="p-2 min-w-[180px]">Name</th>
              <th className="p-2 min-w-[110px]">Base Price (Rp)</th>
              <th className="p-2 min-w-[90px]">Margin (%)</th>
              <th className="p-2 min-w-[110px]">Selling Price (Rp)</th>
              <th className="p-2 min-w-[100px]">Company Portion (%)</th>
              <th className="p-2 min-w-[100px]">Doctor Portion (%)</th>
              <th className="p-2">Editable</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={8} className="p-6 text-center text-slate-500">Belum ada data.</td></tr>
            ) : visible.map((item, idx) => (
              <tr key={item.id} className={idx % 2 ? 'bg-white' : 'bg-slate-50/50'}>
                <td className="p-2">
                  <input
                    className={cell}
                    value={item.name}
                    onChange={(e) => patchLocal(item.id, { name: e.target.value })}
                    onBlur={() => item.name.trim() && persist(item.id, { name: item.name.trim() })}
                  />
                </td>
                <td className="p-2">{numInput(item, 'base_price', { onBlur: () => handleMarginOrBaseBlur(item) })}</td>
                <td className="p-2">{numInput(item, 'margin_pct', { onBlur: () => handleMarginOrBaseBlur(item) })}</td>
                <td className="p-2">{numInput(item, 'selling_price')}</td>
                <td className="p-2">{numInput(item, 'company_portion_pct')}</td>
                <td className="p-2">{numInput(item, 'doctor_portion_pct')}</td>
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={!!item.editable}
                    onChange={(e) => { patchLocal(item.id, { editable: e.target.checked }); persist(item.id, { editable: e.target.checked }); }}
                  />
                </td>
                <td className="p-2">
                  <Button type="button" variant="ghost" size="icon" onClick={() => handleDelete(item)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PriceCatalogManager;
