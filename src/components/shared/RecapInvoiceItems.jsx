import React, { useEffect, useState } from 'react';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/customSupabaseClient';
import { KWITANSI_CATEGORIES } from '@/components/admin/InvoiceTemplateKwitansi';

// Total bersih satu baris item & seluruh daftar (dipakai untuk mengisi Nominal recap).
export const itemLineTotal = (it) => (Number(it.qty) || 0) * (Number(it.price) || 0) - (Number(it.discount) || 0);
export const itemsNetTotal = (items) => (items || []).reduce((s, it) => s + itemLineTotal(it), 0);

// Pemilih item invoice (klinik dengan template Kwitansi). Item dipilih dari
// Katalog Harga klinik dan disimpan di daily_recaps.invoice_items.
// Status stok barang gudang: 'empty' | 'short' | 'low' | null.
// current_stock di DB sudah dikurangi qty yang tersimpan sebelumnya, jadi saat
// edit, stok tersedia = current_stock + qty tersimpan item yang sama.
const stockStatus = (inv, qty, savedQty = 0) => {
  if (!inv) return null;
  const available = Number(inv.current_stock) + savedQty;
  if (available <= 0) return { level: 'empty', text: 'Stok habis' };
  if (qty > available) return { level: 'short', text: `Stok kurang (tersedia ${available} ${inv.unit})` };
  const left = available - qty;
  const min = Number(inv.minimum_stock) || 0;
  if (left <= 0) return { level: 'low', text: `Stok jadi habis setelah terjual` };
  if (min > 0 && left <= min) return { level: 'low', text: `Stok menipis (sisa ${left} ${inv.unit})` };
  return null;
};

const RecapInvoiceItems = ({ clinicId, items, onChange, allowManual = false, defaultCategory = 'procedure', savedItems = [] }) => {
  const [catalog, setCatalog] = useState([]);
  const [pick, setPick] = useState('');

  useEffect(() => {
    if (!clinicId) return;
    supabase.from('price_catalog_items').select('id, category, name, selling_price, base_price, inventory_item_id, inventory_items:inventory_item_id ( current_stock, minimum_stock, unit )')
      .eq('clinic_id', clinicId).order('name')
      .then(({ data }) => setCatalog(data || []));
  }, [clinicId]);

  const savedQtyOf = (catalogId) =>
    (savedItems || []).filter((x) => x.catalog_item_id === catalogId).reduce((a, x) => a + (Number(x.qty) || 0), 0);
  const itemStatus = (it) => {
    if (!it.catalog_item_id) return null;
    const c = catalog.find((x) => x.id === it.catalog_item_id);
    if (!c?.inventory_items) return null;
    // total qty semua baris dengan barang yang sama
    const totalQty = items.filter((x) => x.catalog_item_id === it.catalog_item_id).reduce((a, x) => a + (Number(x.qty) || 0), 0);
    return stockStatus(c.inventory_items, totalQty, savedQtyOf(it.catalog_item_id));
  };

  const patch = (i, p) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...p } : it)));

  const addFromCatalog = () => {
    const c = catalog.find((x) => x.id === pick);
    if (!c) return;
    const price = c.selling_price ?? c.base_price ?? 0;
    onChange([...items, { category: c.category, name: c.name, qty: 1, price: Number(price), discount: 0, ...(c.inventory_item_id ? { catalog_item_id: c.id } : {}) }]);
    setPick('');
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select className="flex-1 min-w-0 border rounded-md h-9 px-2 text-sm bg-white" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">+ Pilih item dari katalog…</option>
          {KWITANSI_CATEGORIES.map((cat) => (
            <optgroup key={cat.value} label={cat.label}>
              {catalog.filter((c) => c.category === cat.value).map((c) => (
                <option key={c.id} value={c.id}>{c.name} — {Number(c.selling_price ?? c.base_price ?? 0).toLocaleString('id-ID')}{c.inventory_items ? ` (${Number(c.inventory_items.current_stock) <= 0 ? 'STOK HABIS' : `stok ${Number(c.inventory_items.current_stock)} ${c.inventory_items.unit}${Number(c.inventory_items.minimum_stock) > 0 && Number(c.inventory_items.current_stock) <= Number(c.inventory_items.minimum_stock) ? ', menipis' : ''}`})` : ''}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <Button type="button" size="sm" variant="outline" onClick={addFromCatalog} disabled={!pick}>
          <Plus className="w-4 h-4 mr-1" />Tambah
        </Button>
        {allowManual && (
          <Button type="button" size="sm" variant="outline"
            onClick={() => onChange([...items, { category: defaultCategory, name: '', qty: 1, price: 0, discount: 0 }])}>
            <Plus className="w-4 h-4 mr-1" />Manual
          </Button>
        )}
      </div>

      {items.length === 0 && (
        <p className="text-xs text-slate-500">Belum ada item. Pilih dari katalog harga; Nominal dihitung otomatis dari daftar ini.</p>
      )}

      {items.map((it, i) => (
        <div key={i} className="border rounded-app-sm p-2 space-y-2 bg-white">
          <div className="flex gap-2 items-center">
            <select className="border rounded h-8 px-1 text-xs bg-white" value={it.category}
              onChange={(e) => patch(i, { category: e.target.value })}>
              {KWITANSI_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <Input className="h-8 text-sm flex-1 min-w-0" value={it.name} onChange={(e) => patch(i, { name: e.target.value })} />
            <button type="button" className="text-red-500 shrink-0" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          {(() => {
            const st = itemStatus(it);
            if (!st) return null;
            const cls = st.level === 'low'
              ? 'text-amber-700 bg-amber-50 border-amber-200'
              : 'text-rose-700 bg-rose-50 border-rose-200';
            return (
              <p className={`flex items-center gap-1.5 text-xs font-medium rounded-md border px-2 py-1 ${cls}`}>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{st.text}
              </p>
            );
          })()}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs text-slate-500">Qty</Label>
              <Input className="h-8 text-sm" type="number" min="1" value={it.qty} onChange={(e) => patch(i, { qty: Number(e.target.value) || 1 })} />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Harga satuan</Label>
              <Input className="h-8 text-sm" type="number" min="0" value={it.price} onChange={(e) => patch(i, { price: Number(e.target.value) || 0 })} />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Diskon</Label>
              <Input className="h-8 text-sm" type="number" min="0" value={it.discount} onChange={(e) => patch(i, { discount: Number(e.target.value) || 0 })} />
            </div>
          </div>
        </div>
      ))}

      {items.length > 0 && (
        <div className="flex justify-between text-sm font-semibold pt-1 border-t">
          <span>Total</span>
          <span>Rp {Math.round(itemsNetTotal(items)).toLocaleString('id-ID')}</span>
        </div>
      )}
    </div>
  );
};

export default RecapInvoiceItems;
