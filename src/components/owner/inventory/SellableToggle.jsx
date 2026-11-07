import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// Toggle "barang ini juga dijual" + pilihan kategori Katalog Harga.
const SellableToggle = ({ id = 'is_sellable', isSellable, sellCategory, onChange }) => (
  <div className="rounded-app-sm border border-slate-200 bg-slate-50 p-3 space-y-2">
    <div className="flex items-center justify-between gap-3">
      <div>
        <Label htmlFor={id} className="cursor-pointer">Barang ini juga dijual</Label>
        <p className="text-xs text-slate-500">
          Muncul di Katalog Harga; stok gudang berkurang otomatis saat terjual di invoice.
        </p>
      </div>
      <Switch id={id} checked={!!isSellable} onCheckedChange={(v) => onChange({ is_sellable: v })} />
    </div>
    {isSellable && (
      <div className="flex items-center gap-2">
        <Label className="text-xs text-slate-500 shrink-0">Kategori katalog</Label>
        <select
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm"
          value={sellCategory || 'consumable'}
          onChange={(e) => onChange({ sell_category: e.target.value })}
        >
          <option value="consumable">Consumable</option>
          <option value="drug">Drug</option>
        </select>
      </div>
    )}
  </div>
);

export default SellableToggle;
