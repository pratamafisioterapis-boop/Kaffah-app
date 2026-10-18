import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

import { Package } from 'lucide-react';
import FinanceTile, { TileEmpty, TileLoading } from '@/components/owner/finance/FinanceTile';
import SegControl from '@/components/owner/finance/SegControl';
import AnimatedNumber from '@/components/owner/finance/AnimatedNumber';
import { Pill, LIST_H } from '@/components/owner/finance/TxList';
import { cn } from '@/lib/utils';

const PILL_SM = 'px-1.5 py-0 text-[10.5px]';
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
          <div className={LIST_H}><TileLoading /></div>
        ) : sorted.length === 0 ? (
          <TileEmpty>Tidak ada paket aktif</TileEmpty>
        ) : (
          <div className={cn(LIST_H, 'divide-y divide-slate-100 overflow-y-auto overflow-x-hidden overscroll-contain pr-1')}>
            {sorted.map((item) => {
              const total = Number(item.total_sessions || 0);
              const used = Math.max(total - Number(item.sessions_remaining || 0), 0);
              const pct = total > 0 ? (used / total) * 100 : 0;
              return (
                <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-1 py-2">
                  <span className="min-w-0 break-words text-[13px] leading-snug font-semibold text-slate-800">{item.patientName}</span>
                  <span className="text-[13px] leading-snug font-black tabular-nums text-blue-600" title={fmtRp(item.remainingValue)}>{fmtShort(item.remainingValue)}</span>
                  <span className="flex flex-wrap items-center gap-1">
                    <Pill className={PILL_SM}>{item.package_name || '-'}</Pill>
                    <Pill tone={item.sessions_remaining <= 2 ? 'warn' : 'pos'} className={PILL_SM}>sisa {item.sessions_remaining}</Pill>
                    <Pill tone="pos" className={PILL_SM}>{item.status}</Pill>
                  </span>
                  <span />
                  <span className="col-span-2 h-1 rounded-full bg-slate-100 overflow-hidden">
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
