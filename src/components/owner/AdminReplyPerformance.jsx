import React, { useEffect, useState } from 'react';
import { Bot, Clock, MessageSquareReply, Moon, Sun, Zap } from 'lucide-react';
import FinanceTile, { TileEmpty, TileLoading } from '@/components/owner/finance/FinanceTile';
import { ADMIN_SHIFTS, fetchAdminReplyPerformance, formatDuration } from '@/lib/adminReplyPerformance';

const fmtDate = (d) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
};
const fmtMinutes = (min) => (min == null ? '21.00' : `${String(Math.floor(min / 60)).padStart(2, '0')}.${String(Math.floor(min % 60)).padStart(2, '0')}`);

const Stat = ({ label, value, hint }) => (
  <div className="rounded-xl bg-slate-50 px-3 py-2">
    <div className="text-[11px] text-slate-500">{label}</div>
    <div className="text-base font-bold text-slate-800 tabular-nums">{value}</div>
    {hint ? <div className="text-[10px] text-slate-400">{hint}</div> : null}
  </div>
);

const PersonCard = ({ shift, stats, icon: Icon }) => (
  <FinanceTile title={`${shift.name} · ${shift.label}`} icon={Icon}>
    {stats.total === 0 ? <TileEmpty>Belum ada pesan pasien pada jam kerja ini.</TileEmpty> : (
      <div className="space-y-3">
        <div>
          <div className="text-[11px] text-slate-500">Waktu balas admin (median)</div>
          <div className="text-3xl font-extrabold text-slate-800 tabular-nums">{formatDuration(stats.adminMedian)}</div>
          <div className="text-[11px] text-slate-400">rata-rata {formatDuration(stats.adminMean)} · {stats.replied} balasan terdeteksi</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Pesan masuk" value={stats.total} hint={stats.ack ? `+${stats.ack} tak perlu dibalas` : undefined} />
          <Stat label="Diserahkan ke admin" value={stats.handoff} />
          <Stat label="Dibalas ≤ 5 mnt" value={stats.within5 == null ? '–' : `${stats.within5}%`} />
          <Stat label="Dibalas ≤ 15 mnt" value={stats.within15 == null ? '–' : `${stats.within15}%`} />
          <Stat label="Tanpa balasan >24 jam" value={stats.unanswered} />
          <Stat label="Menunggu data waktu" value={stats.awaitingData} hint="diisi tiap 20 mnt" />
        </div>
      </div>
    )}
  </FinanceTile>
);

/** Bar perbandingan waktu balas: makin pendek makin bagus. */
const CompareBars = ({ items }) => {
  const max = Math.max(...items.map((i) => i.value || 0), 1);
  return (
    <div className="space-y-3">
      {items.map((i) => (
        <div key={i.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-semibold text-slate-700">{i.label}</span>
            <span className="tabular-nums text-slate-600">{formatDuration(i.value)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${i.color}`} style={{ width: `${i.value ? Math.max(3, (i.value / max) * 100) : 0}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

/** Performa admin membalas pesan WhatsApp pasien dibanding draf AI (khusus Kaffah). */
const AdminReplyPerformance = ({ dateRange }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!dateRange?.startDate || !dateRange?.endDate) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAdminReplyPerformance({ startDate: dateRange.startDate, endDate: dateRange.endDate })
      .then((r) => { if (!cancelled) setData(r); })
      .catch((e) => { console.error('Gagal memuat performa admin', e); if (!cancelled) setError(e.message || 'Gagal memuat data'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dateRange?.startDate, dateRange?.endDate]);

  if (loading) return <TileLoading />;
  if (error) return <TileEmpty>Gagal memuat performa admin: {error}</TileEmpty>;
  if (!data || data.rowCount === 0) {
    return <TileEmpty>Belum ada pesan pasien pada periode ini.</TileEmpty>;
  }

  const { sila, dinda, all, outside, days } = data;
  
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Waktu balas dihitung dari pesan pasien masuk sampai balasan admin pertama di WhatsApp. Pesan dinilai milik admin yang bertugas saat pesan masuk:
        Sila 09.00–17.00, Dinda 17.00 sampai tombol <em>Akhiri Sesi</em> pasien terakhir malam itu (jika tidak ada, sampai 21.00).
        {outside > 0 ? ` ${outside} pesan masuk di luar jam kerja dan tidak dihitung.` : ''}
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <PersonCard shift={ADMIN_SHIFTS[0]} stats={sila} icon={Sun} />
        <PersonCard shift={ADMIN_SHIFTS[1]} stats={dinda} icon={Moon} />
        <FinanceTile title="AI" icon={Bot}>
          {all.aiCount === 0 ? <TileEmpty>Belum ada balasan AI.</TileEmpty> : (
            <div className="space-y-3">
              <div>
                <div className="text-[11px] text-slate-500">Waktu balas AI (median)</div>
                <div className="text-3xl font-extrabold text-slate-800 tabular-nums">{formatDuration(all.aiMedian)}</div>
                <div className="text-[11px] text-slate-400">sudah termasuk jeda tunggu admin yang diatur</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Dibalas AI" value={all.aiReplied} />
                <Stat label="Diserahkan ke admin" value={all.handoff} />
                <Stat label="Ketepatan vs admin" value={all.aiAccuracy == null ? '–' : `${all.aiAccuracy}%`} hint={all.scored ? `${all.scored} dinilai (mode review)` : 'hanya mode review'} />
              </div>
            </div>
          )}
        </FinanceTile>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FinanceTile title="Admin vs AI: waktu balas (median)" icon={Zap}>
          <CompareBars
            items={[
              { label: 'Sila', value: sila.adminMedian, color: 'bg-amber-400' },
              { label: 'Dinda', value: dinda.adminMedian, color: 'bg-indigo-400' },
              { label: 'AI', value: all.aiMedian, color: 'bg-emerald-500' },
            ]}
          />
        </FinanceTile>
        <FinanceTile title="Siapa membalas lebih dulu" icon={MessageSquareReply}>
          {all.contested === 0 ? <TileEmpty>Belum ada pesan yang bisa dijawab AI pada periode ini.</TileEmpty> : (
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Pesan dibandingkan" value={all.contested} hint="tanpa serah-terima & tak perlu dibalas" />
              <Stat label="Admin lebih dulu" value={`${all.adminFirst} (${all.adminWinPct}%)`} />
              <Stat label="AI lebih dulu" value={`${all.aiReplied} (${100 - all.adminWinPct}%)`} />
              <Stat label="Pesan beruntun digabung" value={data.merged} hint="dijawab sekali" />
            </div>
          )}
        </FinanceTile>
      </div>

      <FinanceTile title="Per hari (median waktu balas)" icon={Clock}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="py-1.5 pr-2 font-semibold">Tanggal</th>
                <th className="py-1.5 pr-2 font-semibold">Sila</th>
                <th className="py-1.5 pr-2 font-semibold">Dinda</th>
                <th className="py-1.5 pr-2 font-semibold">Shift Dinda selesai</th>
                <th className="py-1.5 font-semibold">AI</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date} className="border-t border-slate-100 tabular-nums">
                  <td className="py-1.5 pr-2 font-medium text-slate-700">{fmtDate(d.date)}</td>
                  <td className="py-1.5 pr-2">{d.sila.total ? `${formatDuration(d.sila.adminMedian)} (${d.sila.total})` : '–'}</td>
                  <td className="py-1.5 pr-2">{d.dinda.total ? `${formatDuration(d.dinda.adminMedian)} (${d.dinda.total})` : '–'}</td>
                  <td className="py-1.5 pr-2 text-slate-500">{fmtMinutes(d.dindaEnd)}{d.dindaEnd == null ? '' : ' (Akhiri Sesi)'}</td>
                  <td className="py-1.5">{d.ai.aiCount ? formatDuration(d.ai.aiMedian) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Angka dalam kurung = jumlah pesan pasien pada shift itu.</p>
      </FinanceTile>
    </div>
  );
};

export default AdminReplyPerformance;
