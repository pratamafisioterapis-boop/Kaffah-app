import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHead, Panel, EmptyState, Spinner } from '@/components/superadmin/ui';
import { cn } from '@/lib/utils';

const COLS = 'min-[1180px]:grid-cols-[minmax(0,2fr)_130px_120px_110px_110px_96px]';
const Cell = ({ label, children, className }) => (
  <div className={cn('min-w-0', className)}>
    <span className="min-[1180px]:hidden block text-xs font-medium text-app-muted mb-1">{label}</span>
    {children}
  </div>
);

const SuperAdminSubscriptions = () => {
  const { toast } = useToast();
  const [clinics, setClinics] = useState([]);
  const [patientCounts, setPatientCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [dirty, setDirty] = useState({});

  const fetchClinics = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('clinics').select('*').order('name');
    if (error) toast({ variant: 'destructive', title: 'Gagal memuat data', description: error.message });
    setClinics(data || []);
    setLoading(false);
    // Pemakaian kuota: hitung pasien per klinik (tidak menghalangi tampilan form).
    const entries = await Promise.all((data || []).map(async (c) => {
      const { count } = await supabase.from('patients').select('*', { count: 'exact', head: true }).eq('clinic_id', c.id);
      return [c.id, count || 0];
    }));
    setPatientCounts(Object.fromEntries(entries));
  };

  useEffect(() => { fetchClinics(); }, []);

  const updateField = (id, field, value) => {
    setClinics((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
    setDirty((prev) => ({ ...prev, [id]: true }));
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
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
    } else {
      setDirty((prev) => { const n = { ...prev }; delete n[clinic.id]; return n; });
      toast({ title: `Langganan ${clinic.name} diperbarui` });
    }
  };

  if (loading) return <Spinner />;

  return (
    <>
      <PageHead title="Langganan Klinik" description="Atur paket dan batas pemakaian tiap klinik. Tombol Simpan aktif setelah ada perubahan." />
      <Panel className="overflow-hidden">
        {clinics.length === 0 ? (
          <EmptyState title="Belum ada klinik">Tambahkan klinik lewat menu Manajemen Klinik.</EmptyState>
        ) : (
          <>
            <div className={cn('hidden min-[1180px]:grid gap-4 px-5 py-2.5 bg-slate-50 border-b border-app-border text-xs font-semibold text-app-muted', COLS)}>
              <span>Klinik</span><span>Paket</span><span>Status</span><span>Maks terapis</span><span>Maks pasien</span><span />
            </div>
            {clinics.map((c) => {
              const used = patientCounts[c.id];
              const max = c.max_patients ?? 50;
              const r = used != null && max ? used / max : 0;
              return (
                <div key={c.id} className={cn('grid grid-cols-2 gap-x-3 gap-y-3 p-4 border-t border-app-border first:border-t-0 items-center min-[1180px]:gap-4 min-[1180px]:px-5', COLS)}>
                  <div className="col-span-2 min-[1180px]:col-auto min-w-0">
                    <p className="font-semibold break-words">{c.name}</p>
                    {used != null && max > 0 && (
                      <>
                        <div className="mt-2 h-2 rounded-full bg-app-soft overflow-hidden" role="img" aria-label={`${Math.round(r * 100)} persen kuota pasien`}>
                          <div className={cn('h-full rounded-full', r >= 1 ? 'bg-red-600' : r >= 0.85 ? 'bg-amber-500' : 'bg-app-accent')} style={{ width: `${Math.min(100, Math.round(r * 100))}%` }} />
                        </div>
                        <p className="text-xs text-app-muted mt-1 tabular-nums">{used.toLocaleString('id-ID')} dari {max.toLocaleString('id-ID')} pasien</p>
                      </>
                    )}
                  </div>
                  <Cell label="Paket">
                    <Select value={c.subscription_plan || 'basic'} onValueChange={(v) => updateField(c.id, 'subscription_plan', v)}>
                      <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </Cell>
                  <Cell label="Status">
                    <Select value={c.subscription_status || 'active'} onValueChange={(v) => updateField(c.id, 'subscription_status', v)}>
                      <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Aktif</SelectItem>
                        <SelectItem value="inactive">Nonaktif</SelectItem>
                        <SelectItem value="trial">Trial</SelectItem>
                      </SelectContent>
                    </Select>
                  </Cell>
                  <Cell label="Maks terapis">
                    <Input type="number" inputMode="numeric" min={0} className="min-h-11 tabular-nums max-md:text-base" value={c.max_therapists ?? 5} onChange={(e) => updateField(c.id, 'max_therapists', parseInt(e.target.value) || 0)} />
                  </Cell>
                  <Cell label="Maks pasien">
                    <Input type="number" inputMode="numeric" min={0} className="min-h-11 tabular-nums max-md:text-base" value={c.max_patients ?? 50} onChange={(e) => updateField(c.id, 'max_patients', parseInt(e.target.value) || 0)} />
                  </Cell>
                  <div className="col-span-2 min-[1180px]:col-auto">
                    <Button onClick={() => handleSave(c)} disabled={!dirty[c.id] || savingId === c.id} className="w-full min-h-11 bg-app-accent hover:bg-app-accent-hover">
                      {savingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </Panel>
    </>
  );
};

export default SuperAdminSubscriptions;
