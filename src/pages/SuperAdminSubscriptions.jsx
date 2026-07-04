import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, DollarSign } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SuperAdminSubscriptions = () => {
  const { toast } = useToast();
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const fetchClinics = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('clinics').select('*').order('name');
    if (error) toast({ variant: 'destructive', title: 'Gagal memuat data', description: error.message });
    setClinics(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchClinics(); }, []);

  const updateField = (id, field, value) => {
    setClinics(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleSave = async (clinic) => {
    setSavingId(clinic.id);
    const { error } = await supabase.from('clinics').update({
      subscription_plan: clinic.subscription_plan,
      subscription_status: clinic.subscription_status,
      max_therapists: clinic.max_therapists,
      max_patients: clinic.max_patients,
    }).eq('id', clinic.id);
    setSavingId(null);
    if (error) toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
    else toast({ title: `Langganan ${clinic.name} diperbarui` });
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-blue-600" /> Langganan Klinik
        </h1>
        <p className="text-sm text-slate-500">Atur paket & batas pemakaian tiap klinik.</p>
      </div>

      <div className="space-y-4">
        {clinics.map((c) => (
          <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <div className="md:col-span-2">
              <p className="font-semibold text-slate-800">{c.name}</p>
            </div>
            <div>
              <label className="text-xs text-slate-500">Plan</label>
              <Select value={c.subscription_plan || 'basic'} onValueChange={(v) => updateField(c.id, 'subscription_plan', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Status</label>
              <Select value={c.subscription_status || 'active'} onValueChange={(v) => updateField(c.id, 'subscription_status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="inactive">Nonaktif</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Max Terapis</label>
              <Input type="number" value={c.max_therapists ?? 5} onChange={(e) => updateField(c.id, 'max_therapists', parseInt(e.target.value) || 0)} />
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-slate-500">Max Pasien</label>
                <Input type="number" value={c.max_patients ?? 50} onChange={(e) => updateField(c.id, 'max_patients', parseInt(e.target.value) || 0)} />
              </div>
              <Button size="sm" onClick={() => handleSave(c)} disabled={savingId === c.id} className="bg-blue-600">
                {savingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan'}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SuperAdminSubscriptions;