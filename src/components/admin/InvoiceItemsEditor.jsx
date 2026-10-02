import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { KWITANSI_CATEGORIES, getKwitansiItems } from './InvoiceTemplateKwitansi';

// Editor daftar item invoice (template kwitansi). Item dipilih dari Katalog
// Harga klinik (Setup owner); disimpan di daily_recaps.invoice_items.
const InvoiceItemsEditor = ({ recapId, clinicId, recapData, onSaved }) => {
  const { toast } = useToast();
  const [catalog, setCatalog] = useState([]);
  const [items, setItems] = useState(() => getKwitansiItems(recapData));
  const [pick, setPick] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setItems(getKwitansiItems(recapData)); }, [recapId, recapData?.invoice_items]);

  useEffect(() => {
    if (!clinicId) return;
    supabase.from('price_catalog_items').select('id, category, name, selling_price, base_price')
      .eq('clinic_id', clinicId).order('name')
      .then(({ data }) => setCatalog(data || []));
  }, [clinicId]);

  const patch = (i, p) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...p } : it)));

  const addFromCatalog = () => {
    const c = catalog.find((x) => x.id === pick);
    if (!c) return;
    const price = c.selling_price ?? c.base_price ?? 0;
    setItems((prev) => [...prev, { category: c.category, name: c.name, qty: 1, price: Number(price), discount: 0 }]);
    setPick('');
  };

  const persist = async (value) => {
    setSaving(true);
    const { error } = await supabase.from('daily_recaps').update({ invoice_items: value }).eq('id', recapId);
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan item invoice', description: error.message });
      return;
    }
    toast({ title: 'Item invoice disimpan' });
    onSaved?.(value);
  };

  return (
    <div className="bg-white border-b px-3 sm:px-4 py-3 space-y-2 shrink-0 max-h-[34vh] overflow-y-auto">
      <p className="text-xs font-semibold text-slate-600">Item Invoice (dari Katalog Harga)</p>
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-12 gap-1.5 items-center text-xs">
          <select className="col-span-3 sm:col-span-2 border rounded h-8 px-1 bg-white" value={it.category}
            onChange={(e) => patch(i, { category: e.target.value })}>
            {KWITANSI_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <Input className="col-span-9 sm:col-span-4 h-8" value={it.name} onChange={(e) => patch(i, { name: e.target.value })} />
          <Input className="col-span-2 h-8" type="number" min="1" value={it.qty} onChange={(e) => patch(i, { qty: Number(e.target.value) || 1 })} />
          <Input className="col-span-4 sm:col-span-2 h-8" type="number" min="0" value={it.price} onChange={(e) => patch(i, { price: Number(e.target.value) || 0 })} />
          <Input className="col-span-3 sm:col-span-1 h-8" type="number" min="0" value={it.discount} title="Diskon" onChange={(e) => patch(i, { discount: Number(e.target.value) || 0 })} />
          <button type="button" className="col-span-1 text-red-500 flex justify-center" onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2 items-center">
        <select className="border rounded h-8 px-1 text-xs bg-white min-w-[180px]" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">+ Pilih dari katalog…</option>
          {KWITANSI_CATEGORIES.map((cat) => (
            <optgroup key={cat.value} label={cat.label}>
              {catalog.filter((c) => c.category === cat.value).map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {Number(c.selling_price ?? c.base_price ?? 0).toLocaleString('id-ID')}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <Button type="button" size="sm" variant="outline" onClick={addFromCatalog} disabled={!pick}><Plus className="w-3.5 h-3.5 mr-1" />Tambah</Button>
        <Button type="button" size="sm" onClick={() => persist(items)} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          {saving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}Simpan Item
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => persist(null)} disabled={saving}><RotateCcw className="w-3.5 h-3.5 mr-1" />Reset otomatis</Button>
      </div>
      <p className="text-[10px] text-slate-400">Kolom: kategori · nama · qty · harga satuan · diskon. Total invoice dihitung dari daftar ini.</p>
    </div>
  );
};

export default InvoiceItemsEditor;
