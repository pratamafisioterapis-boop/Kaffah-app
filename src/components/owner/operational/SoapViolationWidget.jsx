import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useSoapFirstSettings } from '@/hooks/useSoapFirst';
import { fetchSoapViolations } from '@/lib/soapFirst';
import SoapViolationSessionsDialog from '@/components/shared/SoapViolationSessionsDialog';
import FinanceTile, { TileEmpty, TileLoading } from '@/components/owner/finance/FinanceTile';

/** Sesi yang melanggar aturan SOAP per terapis pada periode dashboard (khusus klinik dengan SOAP-first). */
const SoapViolationWidget = ({ dateRange, className }) => {
  const { settings, loaded } = useSoapFirstSettings();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const enabled = !!settings?.enabled;

  useEffect(() => {
    if (!enabled || !dateRange?.startDate || !dateRange?.endDate) return undefined;
    let cancelled = false;
    setLoading(true);
    fetchSoapViolations({ startDate: dateRange.startDate, endDate: dateRange.endDate })
      .then((r) => { if (!cancelled) setResult(r); })
      .catch((e) => { console.error('Gagal memuat pelanggaran SOAP', e); if (!cancelled) setResult({ total: 0, byTherapist: [] }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled, dateRange?.startDate, dateRange?.endDate]);

  if (!loaded || !enabled) return null;

  return (
    <FinanceTile title="Pelanggaran SOAP per Terapis" icon={ShieldAlert} className={className}>
      {loading ? <TileLoading /> : !result || result.byTherapist.length === 0 ? (
        <TileEmpty>Tidak ada sesi yang melanggar aturan SOAP pada periode ini.</TileEmpty>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-slate-600"><span className="text-2xl font-extrabold text-red-600">{result.total}</span> sesi melanggar</div>
          {result.byTherapist.map((t) => (
            <button type="button" key={t.id} onClick={() => setDetail(t)} className="flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2 text-left text-sm hover:bg-slate-50">
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-800">{t.name}</div>
                <div className="text-[11px] text-slate-500">
                  Terlambat {t.terlambat} · Tidak diisi {t.tidakDiisi}{t.ditandai ? ` · Ditandai owner ${t.ditandai}` : ''}
                </div>
              </div>
              <span className="ml-2 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">{t.count}</span>
            </button>
          ))}
        </div>
      )}
      <SoapViolationSessionsDialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)} title={detail ? `Pelanggaran SOAP — ${detail.name}` : ''} sessions={detail?.sessions || []} />
    </FinanceTile>
  );
};

export default SoapViolationWidget;
