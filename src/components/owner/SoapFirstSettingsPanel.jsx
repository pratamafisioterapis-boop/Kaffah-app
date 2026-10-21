import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';

const num = (v) => (v === '' || v == null ? '' : String(v));

const SoapFirstSettingsPanel = () => {
  const { toast } = useToast();
  const { userDetails } = useAuth();
  const clinicId = userDetails?.clinic_id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [form, setForm] = useState(null);
  const [types, setTypes] = useState([]);
  const [prices, setPrices] = useState({});
  const [packages, setPackages] = useState([]);
  const [pkgPrices, setPkgPrices] = useState({});

  const load = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const [settingsRes, typeRes, priceRes, pkgRes] = await Promise.all([
        supabase.from('soap_first_settings').select('*').eq('clinic_id', clinicId).maybeSingle(),
        supabase.from('operational_options').select('id, label').eq('clinic_id', clinicId).eq('category', 'patient_type').eq('is_active', true).order('label'),
        supabase.from('clinic_service_prices').select('patient_type_id, price').eq('clinic_id', clinicId),
        supabase.from('operational_options').select('id, label, session_count, price').eq('clinic_id', clinicId).eq('category', 'tipe_paket').eq('is_active', true).order('session_count'),
      ]);
      setForm(settingsRes.data || null);
      setTypes(typeRes.data || []);
      setPrices(Object.fromEntries((priceRes.data || []).map((p) => [p.patient_type_id, num(p.price)])));
      const pk = (pkgRes.data || []).filter((p) => (p.session_count || 0) > 1);
      setPackages(pk);
      setPkgPrices(Object.fromEntries(pk.map((p) => [p.id, num(p.price)])));
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    setSaving('settings');
    try {
      const { error } = await supabase.from('soap_first_settings').update({
        enabled: !!form.enabled,
        start_date: form.start_date,
        incentive_grace_minutes: Number(form.incentive_grace_minutes) || 0,
        reminder_after_minutes: Number(form.reminder_after_minutes) || 0,
        two_complaint_package_surcharge: Number(form.two_complaint_package_surcharge) || 0,
        updated_at: new Date().toISOString(),
        updated_by: userDetails?.id || null,
      }).eq('clinic_id', clinicId);
      if (error) throw error;
      toast({ title: 'Pengaturan disimpan' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: err.message });
    } finally {
      setSaving('');
    }
  };

  const savePrices = async () => {
    setSaving('prices');
    try {
      const rows = types
        .filter((t) => prices[t.id] !== '' && prices[t.id] != null)
        .map((t) => ({ clinic_id: clinicId, patient_type_id: t.id, price: Number(prices[t.id]) || 0, updated_at: new Date().toISOString() }));
      if (rows.length) {
        const { error } = await supabase.from('clinic_service_prices').upsert(rows, { onConflict: 'clinic_id,patient_type_id' });
        if (error) throw error;
      }
      toast({ title: 'Harga tipe pasien disimpan' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: err.message });
    } finally {
      setSaving('');
    }
  };

  const savePackagePrices = async () => {
    setSaving('packages');
    try {
      for (const p of packages) {
        const value = pkgPrices[p.id];
        const { error } = await supabase.from('operational_options').update({ price: value === '' || value == null ? null : Number(value) }).eq('id', p.id);
        if (error) throw error;
      }
      toast({ title: 'Harga paket disimpan' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: err.message });
    } finally {
      setSaving('');
    }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  if (!form) return <p className="text-sm text-slate-500">Fitur ini belum disiapkan untuk klinik Anda.</p>;

  const setF = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>SOAP sebelum pembayaran</CardTitle>
          <CardDescription>
            Bila aktif, pembayaran pasien non-paket (dan sesi 1 paket) terkunci sampai terapis menyelesaikan SOAP. Tipe pasien & nominal dihitung otomatis dari SOAP dan daftar harga di bawah.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={!!form.enabled} onChange={(e) => setF('enabled', e.target.checked)} />
            Aktifkan aturan SOAP sebelum pembayaran
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Berlaku untuk rekap mulai tanggal</Label>
              <Input type="date" value={form.start_date || ''} onChange={(e) => setF('start_date', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tambahan paket 2 keluhan (Rp per sesi)</Label>
              <Input type="number" value={num(form.two_complaint_package_surcharge)} onChange={(e) => setF('two_complaint_package_surcharge', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Toleransi SOAP setelah slot berakhir (menit)</Label>
              <Input type="number" value={num(form.incentive_grace_minutes)} onChange={(e) => setF('incentive_grace_minutes', e.target.value)} />
              <p className="text-[11px] text-slate-500">Lewat batas ini jasa insentif sesi dihitung nol (tidak ditampilkan ke terapis).</p>
            </div>
            <div className="space-y-1">
              <Label>Pengingat SOAP setelah slot mulai (menit)</Label>
              <Input type="number" value={num(form.reminder_after_minutes)} onChange={(e) => setF('reminder_after_minutes', e.target.value)} />
            </div>
          </div>
          <Button onClick={saveSettings} disabled={saving === 'settings'}>
            {saving === 'settings' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Simpan Pengaturan
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Harga per tipe pasien</CardTitle>
          <CardDescription>Harga yang ditagihkan ke pasien. Admin tidak dapat mengubah nominal ini.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {types.map((t) => (
              <div key={t.id} className="flex items-center gap-2">
                <Label className="flex-1 min-w-0 text-xs">{t.label}</Label>
                <Input type="number" className="w-36 shrink-0 text-right" value={prices[t.id] ?? ''} onChange={(e) => setPrices((prev) => ({ ...prev, [t.id]: e.target.value }))} placeholder="Belum diatur" />
              </div>
            ))}
          </div>
          <Button onClick={savePrices} disabled={saving === 'prices'}>
            {saving === 'prices' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Simpan Harga
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Harga paket</CardTitle>
          <CardDescription>Paket tanpa harga tidak dapat dijual. Tambahan 2 keluhan dihitung otomatis (tarif per sesi × jumlah sesi).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {packages.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <Label className="flex-1 min-w-0 text-xs">{new RegExp(`\\b${p.session_count}\\s*sesi\\b`, 'i').test(p.label) ? p.label : `${p.label} (${p.session_count} sesi)`}</Label>
                <Input type="number" className="w-36 shrink-0 text-right" value={pkgPrices[p.id] ?? ''} onChange={(e) => setPkgPrices((prev) => ({ ...prev, [p.id]: e.target.value }))} placeholder="Belum diatur" />
              </div>
            ))}
          </div>
          <Button onClick={savePackagePrices} disabled={saving === 'packages'}>
            {saving === 'packages' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Simpan Harga Paket
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-slate-500">Jenis diskon dan nilainya diatur di tab “Jenis Diskon”. Diskon tidak berlaku untuk paket; diskon homecare hanya lewat persetujuan owner.</p>
    </div>
  );
};

export default SoapFirstSettingsPanel;
