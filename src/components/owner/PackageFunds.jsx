import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

import { Package } from 'lucide-react';
import FinanceTile, { TileEmpty, TileLoading } from '@/components/owner/finance/FinanceTile';
import SegControl from '@/components/owner/finance/SegControl';
import AnimatedNumber from '@/components/owner/finance/AnimatedNumber';
import { Pill } from '@/components/owner/finance/TxList';
import { fmtShort, fmtRp } from '@/components/owner/finance/financeTheme';

const PackageFunds = () => {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState([]);
  const [sortBy, setSortBy] = useState('value');

  useEffect(() => {
    fetchPackageFunds();
  }, []);

  const fetchPackageFunds = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('package_tracking')
        .select(`
          id,
          package_name,
          total_sessions,
          sessions_remaining,
          status,
          nominal,
          created_at,
          patients!patient_id (
            full_name
          )
        `)
        .gt('sessions_remaining', 0)
        .eq('status', 'aktif')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const processed = (data || []).map((item) => {
        const nominal = Number(item.nominal || 0);
        const totalSessions = Number(item.total_sessions || 0);
        const remaining = Number(item.sessions_remaining || 0);

        const remainingValue =
          totalSessions > 0
            ? (nominal / totalSessions) * remaining
            : 0;

        return {
          ...item,
          patientName:
            item.patients?.full_name || '-',
          remainingValue
        };
      });

      setPackages(processed);

    } catch (err) {
      console.error('PACKAGE FUND ERROR:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalDanaPaket = packages.reduce(
    (sum, item) => sum + item.remainingValue,
    0
  );
  const totalSisaSesi = packages.reduce((sum, item) => sum + Number(item.sessions_remaining || 0), 0);

  const sorted = [...packages].sort((a, b) =>
    sortBy === 'value' ? b.remainingValue - a.remainingValue : a.sessions_remaining - b.sessions_remaining
  );

  return (
    <div className="grid gap-4">
      <FinanceTile tone="sky" icon={Package} title="Total Dana Paket" tinted>
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-3xl sm:text-4xl font-black tabular-nums leading-none text-app-ink" title={fmtRp(totalDanaPaket)}>
            <AnimatedNumber value={totalDanaPaket} format={fmtShort} />
          </p>
          <Pill tone="sky">{packages.length} paket</Pill>
          <Pill>{totalSisaSesi} sesi</Pill>
        </div>
        <p className="text-xs text-slate-500 mt-1.5">{fmtRp(totalDanaPaket)}</p>
      </FinanceTile>

      <FinanceTile
        tone="sky"
        icon={Package}
        title="Paket Aktif"
        action={
          <SegControl
            items={[{ value: 'value', label: 'Nilai' }, { value: 'sessions', label: 'Sisa sesi' }]}
            value={sortBy}
            onChange={setSortBy}
          />
        }
      >
        {loading ? (
          <TileLoading />
        ) : sorted.length === 0 ? (
          <TileEmpty>Tidak ada paket aktif</TileEmpty>
        ) : (
          <div className="divide-y divide-slate-100">
            {sorted.map((item) => {
              const total = Number(item.total_sessions || 0);
              const used = Math.max(total - Number(item.sessions_remaining || 0), 0);
              const pct = total > 0 ? (used / total) * 100 : 0;
              return (
                <div key={item.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 px-1 py-3">
                  <span className="min-w-0 break-words text-sm font-semibold text-slate-800">{item.patientName}</span>
                  <span className="text-base font-black tabular-nums text-blue-600" title={fmtRp(item.remainingValue)}>{fmtShort(item.remainingValue)}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Pill>{item.package_name || '-'}</Pill>
                    <Pill tone={item.sessions_remaining <= 2 ? 'warn' : 'pos'}>sisa {item.sessions_remaining}</Pill>
                    <Pill tone="pos">{item.status}</Pill>
                  </span>
                  <span />
                  <span className="col-span-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <span className="block h-full rounded-full bg-blue-500 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </FinanceTile>
    </div>
  );
};

export default PackageFunds;
