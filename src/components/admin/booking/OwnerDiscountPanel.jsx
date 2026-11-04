import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { KAFFAH_CLINIC_ID } from '@/lib/clinicIds';

const idr = (v) => `Rp ${Math.round(Number(v) || 0).toLocaleString('id-ID')}`;

const MODES = [
  { id: 'percentage', label: 'Persen (%)', hint: 'Contoh: 10' },
  { id: 'nominal', label: 'Rupiah (Rp)', hint: 'Potongan, mis. 75000' },
  { id: 'final', label: 'Nominal dibayar', hint: 'Yang harus dibayar, mis. 150000' },
];

// Kaffah: owner memberi diskon langsung dari kartu appointment.
const OwnerDiscountPanel = ({ appointment, onChanged }) => {
  const { toast } = useToast();
  const { userDetails, role } = useAuth();
  const allowed = (role === 'owner' || role === 'super_admin') && userDetails?.clinic_id === KAFFAH_CLINIC_ID;

  const [recap, setRecap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('final');
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!allowed || !appointment?.id) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('daily_recaps')
      .select('id, amount, amount_original, discount_type, discount_value, invoice_created_at, special_type, payment_method')
      .eq('appointment_id', appointment.id)
      .maybeSingle();
    setRecap(data || null);
    setLoading(false);
  }, [allowed, appointment?.id]);

  useEffect(() => { load(); }, [load]);

  const base = Number(recap?.amount_original ?? recap?.amount ?? 0);
  const num = Number(String(input).replace(/\D/g, '')) || 0;
  const pctInput = mode === 'percentage' ? Number(String(input).replace(',', '.')) || 0 : 0;

  const preview = useMemo(() => {
    if (!base) return null;
    if (mode === 'percentage') {
      const p = Math.min(Math.max(pctInput, 0), 100);
      const disc = Math.round(base * p / 100);
      return { discount: disc, pay: base - disc };
    }
    if (mode === 'nominal') {
      const d = Math.min(num, base);
      return { discount: d, pay: base - d };
    }
    const pay = Math.min(num, base);
    return { discount: base - pay, pay };
  }, [base, mode, num, pctInput]);

  if (!allowed || loading || !recap) return null;
  if (!recap.invoice_created_at || recap.special_type === 'free' || recap.payment_method === 'Package' || base <= 0) return null;

  const hasDiscount = !!recap.discount_type && Number(recap.discount_value) > 0;

  const submit = async (p_mode, p_value) => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('owner_set_appointment_discount', {
        p_appointment_id: appointment.id, p_mode, p_value,
      });
      if (error) throw error;
      toast({ title: p_mode === 'clear' ? 'Diskon dihapus' : 'Diskon tersimpan' });
      setInput('');
      await load();
      onChanged?.();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan diskon', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const valid = preview && (mode === 'final' ? input !== '' && num < base : preview.discount > 0);

  return (
    <div className="rounded-app border border-amber-200 bg-amber-50/60 p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <Percent className="w-4 h-4" /> Diskon Owner
      </div>
      <div className="text-sm text-slate-700 space-y-0.5">
        <div className="flex justify-between"><span>Tagihan</span><span>{idr(base)}</span></div>
        {hasDiscount && (
          <div className="flex justify-between text-amber-800">
            <span>Diskon ({recap.discount_type === 'percentage' ? `${Number(recap.discount_value)}%` : idr(recap.discount_value)})</span>
            <span>- {idr(base - Number(recap.amount))}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold"><span>Harus dibayar</span><span>{idr(recap.amount)}</span></div>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {MODES.map((m) => (
          <Button key={m.id} type="button" size="sm" variant={mode === m.id ? 'default' : 'outline'}
            className="text-xs px-1" onClick={() => { setMode(m.id); setInput(''); }}>
            {m.label}
          </Button>
        ))}
      </div>
      <Input
        inputMode="decimal"
        value={input}
        placeholder={MODES.find((m) => m.id === mode).hint}
        onChange={(e) => setInput(e.target.value)}
      />
      {input !== '' && preview && (
        <p className="text-xs text-slate-600">
          Diskon <b>{idr(preview.discount)}</b> → pasien membayar <b>{idr(preview.pay)}</b>
        </p>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={saving || !valid}
          onClick={() => submit(mode, mode === 'percentage' ? pctInput : num)}>
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Terapkan
        </Button>
        {hasDiscount && (
          <Button size="sm" variant="outline" disabled={saving} onClick={() => submit('clear', null)}>
            Hapus diskon
          </Button>
        )}
      </div>
    </div>
  );
};

export default OwnerDiscountPanel;
