import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { PageHead, Panel, PanelTitle, EmptyState, Spinner } from '@/components/superadmin/ui';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = (n) => (n ?? 0).toLocaleString('id-ID');

const Stat = ({ label, value, hint }) => (
  <div className="bg-white p-4 min-[700px]:p-5 min-w-0">
    <p className="text-[12.5px] font-medium text-app-muted">{label}</p>
    <p className="mt-1 text-[28px] leading-tight font-semibold tracking-tight tabular-nums truncate">{value}</p>
    {hint && <p className="text-xs text-app-muted mt-0.5">{hint}</p>}
  </div>
);

const SuperAdminOverview = () => {
  const navigate = useNavigate();
  const [state, setState] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [clinicsRes, users, patients, therapists] = await Promise.all([
        supabase.from('clinics').select('id, name, subscription_status, max_patients, max_therapists'),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('patients').select('*', { count: 'exact', head: true }),
        supabase.from('physiotherapists').select('*', { count: 'exact', head: true }),
      ]);
      const clinics = clinicsRes.data || [];
      // Jumlah pasien per klinik untuk membaca pemakaian kuota.
      const usage = await Promise.all(
        clinics.map(async (c) => {
          const { count } = await supabase.from('patients').select('*', { count: 'exact', head: true }).eq('clinic_id', c.id);
          return { ...c, patientCount: count || 0 };
        })
      );
      if (cancelled) return;
      setState({
        clinics: usage,
        users: users.count || 0,
        patients: patients.count || 0,
        therapists: therapists.count || 0,
      });
    })();
    return () => { cancelled = true; };
  }, []);

  if (!state) return <Spinner />;

  const { clinics } = state;
  const ratio = (c) => (c.max_patients ? c.patientCount / c.max_patients : 0);
  const byUsage = [...clinics].filter((c) => c.max_patients).sort((a, b) => ratio(b) - ratio(a));
  const attention = [];
  clinics.forEach((c) => {
    if (c.subscription_status && c.subscription_status !== 'active') {
      attention.push({
        id: `s-${c.id}`, name: c.name, to: '/super-admin/subscriptions', cta: 'Atur langganan',
        text: c.subscription_status === 'trial' ? 'Masih berstatus trial' : 'Langganan nonaktif',
      });
    }
    if (ratio(c) >= 0.85) {
      attention.push({
        id: `q-${c.id}`, name: c.name, to: '/super-admin/subscriptions', cta: 'Naikkan kuota',
        text: `Kuota pasien terpakai ${Math.round(ratio(c) * 100)}% (${fmt(c.patientCount)} dari ${fmt(c.max_patients)})`,
      });
    }
  });

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <PageHead title="Ringkasan Sistem" description={`Gambaran seluruh klinik dalam sistem, ${today}.`} />

      <Panel className="overflow-hidden grid grid-cols-2 min-[760px]:grid-cols-4 gap-px bg-app-border" aria-label="Statistik">
        <Stat label="Total klinik" value={fmt(clinics.length)} hint={`${clinics.filter((c) => c.subscription_status === 'active').length} aktif`} />
        <Stat label="Total user" value={fmt(state.users)} />
        <Stat label="Total pasien" value={fmt(state.patients)} />
        <Stat label="Total terapis" value={fmt(state.therapists)} />
      </Panel>

      <div className="grid gap-5 grid-cols-[minmax(0,1fr)] min-[1000px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Panel className="pb-2">
          <PanelTitle hint={attention.length ? `${attention.length} item` : undefined}>Perlu perhatian</PanelTitle>
          {attention.length === 0 ? (
            <EmptyState title="Semua klinik dalam kondisi baik" icon={CheckCircle2}>Tidak ada langganan bermasalah atau kuota yang hampir penuh.</EmptyState>
          ) : (
            <ul className="mt-2 px-2">
              {attention.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 border-t border-app-border first:border-t-0">
                  <div className="flex-1 basis-56 min-w-0">
                    <p className="font-semibold text-sm break-words">{a.name}</p>
                    <p className="text-[13px] text-app-muted">{a.text}</p>
                  </div>
                  <Button size="sm" variant="outline" className="min-h-9" onClick={() => navigate(a.to)}>{a.cta}</Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="pb-5">
          <PanelTitle hint="terpakai / maksimum">Pemakaian kuota pasien</PanelTitle>
          {byUsage.length === 0 ? (
            <EmptyState title="Belum ada batas kuota">Atur maksimum pasien di menu Langganan.</EmptyState>
          ) : (
            <ul className="mt-3 px-5 flex flex-col gap-3.5">
              {byUsage.map((c) => {
                const r = ratio(c);
                return (
                  <li key={c.id} className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
                    <div className="flex justify-between gap-3 text-[13px]">
                      <span className="min-w-0 truncate font-medium">{c.name}</span>
                      <span className="shrink-0 text-app-muted tabular-nums">{fmt(c.patientCount)} / {fmt(c.max_patients)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-app-soft overflow-hidden" role="img" aria-label={`${Math.round(r * 100)} persen`}>
                      <div className={cn('h-full rounded-full', r >= 1 ? 'bg-red-600' : r >= 0.85 ? 'bg-amber-500' : 'bg-app-accent')} style={{ width: `${Math.min(100, Math.round(r * 100))}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
};

export default SuperAdminOverview;
