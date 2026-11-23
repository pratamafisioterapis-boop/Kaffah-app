import React, { useEffect, useState } from 'react';
import { Bot, Moon, Sun, User } from 'lucide-react';
import FinanceTile, { TileEmpty, TileLoading } from '@/components/owner/finance/FinanceTile';
import { ADMIN_SHIFTS, fetchAdminReplyPerformance, formatDuration, speedGrade } from '@/lib/adminReplyPerformance';

const TONE = {
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
};

const fmtDate = (d) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
};

const Row = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-3 border-t border-slate-100 py-2 text-sm first:border-t-0">
    <span className="text-slate-500">{label}</span>
    <span className="text-right font-semibold text-slate-800 tabular-nums">{value}</span>
  </div>
);

/** Kartu satu admin: rata-rata balas dalam bahasa sederhana. */
const AdminCard = ({ shift, stats, icon: Icon }) => {
  const grade = speedGrade(stats.avg);
  return (
    <FinanceTile title={`${shift.name} · jam ${shift.label}`} icon={Icon}>
      {stats.total === 0 ? (
        <TileEmpty>Belum ada pesan pasien di jam kerja {shift.name} pada periode ini.</TileEmpty>
      ) : (
        <>
          <div className="mb-3">
            <div className="text-xs text-slate-500">Rata-rata admin membalas dalam</div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-3xl font-extrabold text-slate-800 tabular-nums">{stats.timed ? formatDuration(stats.avg) : '–'}</span>
              {grade && <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${TONE[grade.tone]}`}>{grade.label}</span>}
            </div>
            {!stats.timed && stats.handled > 0 && (
              <div className="mt-1 text-xs text-slate-400">Waktu balasan sedang dihitung (diperbarui tiap 20 menit).</div>
            )}
          </div>
          <Row label="Pesan yang ditangani admin" value={stats.handled} />
          <Row label="Dibalas dalam 5 menit" value={stats.timed ? `${stats.within5} dari ${stats.timed}` : '–'} />
          <Row label="Dibalas lebih dari 15 menit" value={stats.timed ? stats.over15 : '–'} />
          <Row label="Tercepat / terlama" value={stats.timed ? `${formatDuration(stats.fastest)} / ${formatDuration(stats.slowest)}` : '–'} />
          {stats.noReply > 0 && <Row label="Tidak terlihat balasan (lewat 24 jam)" value={stats.noReply} />}
        </>
      )}
    </FinanceTile>
  );
};

const SEGMENTS = [
  { key: 'ai', label: 'Dijawab AI', color: 'bg-emerald-500', dot: 'bg-emerald-500' },
  { key: 'adminFirst', label: 'Dijawab admin lebih dulu', color: 'bg-indigo-500', dot: 'bg-indigo-500' },
  { key: 'handoff', label: 'Diserahkan AI ke admin', color: 'bg-amber-400', dot: 'bg-amber-400' },
  { key: 'ack', label: 'Tidak perlu dibalas (ok, siap, dll.)', color: 'bg-slate-300', dot: 'bg-slate-300' },
];

/** Performa admin membalas pesan WhatsApp pasien dibanding AI (khusus Kaffah). */
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
  if (!data || data.all.total === 0) {
    return <TileEmpty>Belum ada pesan pasien pada periode ini. Coba pilih rentang tanggal yang lebih panjang.</TileEmpty>;
  }

  const { sila, dinda, all, outside, days } = data;
  const totalPct = (n) => (all.total ? Math.round((n / all.total) * 100) : 0);

  return (
    <div className="space-y-4">
      {/* Ringkasan satu kalimat */}
      <FinanceTile title="Ringkasan periode ini" icon={User}>
        <p className="text-base leading-relaxed text-slate-700">
          Ada <b>{all.total} pesan pasien</b> pada jam kerja admin.{' '}
          <b className="text-emerald-600">{all.ai}</b> dijawab AI sendiri,{' '}
          <b className="text-indigo-600">{all.adminFirst}</b> dijawab admin lebih dulu,{' '}
          <b className="text-amber-600">{all.handoff}</b> diserahkan AI ke admin
          {all.ack ? <>, dan {all.ack} tidak perlu dibalas</> : null}.
        </p>
        <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Pembagian siapa yang menjawab pesan">
          {SEGMENTS.map((s) => (all[s.key] ? (
            <div key={s.key} className={s.color} style={{ width: `${(all[s.key] / all.total) * 100}%` }} />
          ) : null))}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {SEGMENTS.map((s) => (
            <div key={s.key} className="flex items-center gap-2 text-sm">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`} />
              <span className="text-slate-600">{s.label}</span>
              <span className="ml-auto font-semibold text-slate-800 tabular-nums">{all[s.key]} <span className="font-normal text-slate-400">({totalPct(all[s.key])}%)</span></span>
            </div>
          ))}
        </div>
        {outside > 0 && (
          <p className="mt-3 text-xs text-slate-400">{outside} pesan masuk di luar jam kerja admin dan tidak dinilai.</p>
        )}
      </FinanceTile>

      {/* Kartu per admin + AI */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <AdminCard shift={ADMIN_SHIFTS[0]} stats={sila} icon={Sun} />
        <AdminCard shift={ADMIN_SHIFTS[1]} stats={dinda} icon={Moon} />
        <FinanceTile title="AI Asisten" icon={Bot}>
          {all.ai === 0 ? <TileEmpty>AI belum menjawab pesan pada periode ini.</TileEmpty> : (
            <>
              <div className="mb-3">
                <div className="text-xs text-slate-500">AI menjawab sendiri</div>
                <div className="text-3xl font-extrabold text-slate-800 tabular-nums">{all.ai} <span className="text-base font-semibold text-slate-400">pesan</span></div>
              </div>
              <Row label="Menjawab setelah rata-rata" value={formatDuration(all.aiAvg)} />
              <Row label="Dari seluruh pesan" value={`${totalPct(all.ai)}%`} />
              <p className="pt-2 text-xs text-slate-400">
                AI sengaja menunggu sebentar supaya admin sempat menjawab lebih dulu, jadi waktu ini bukan kecepatan maksimalnya.
              </p>
            </>
          )}
        </FinanceTile>
      </div>

      {/* Per hari */}
      <FinanceTile title="Rincian per hari" icon={User}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="py-1.5 pr-3 font-semibold">Hari</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Pesan</th>
                <th className="py-1.5 pr-3 text-right font-semibold">AI</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Admin</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Diserahkan</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Rata-rata Sila</th>
                <th className="py-1.5 text-right font-semibold">Rata-rata Dinda</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date} className="border-t border-slate-100 tabular-nums">
                  <td className="py-2 pr-3 font-medium text-slate-700">{fmtDate(d.date)}</td>
                  <td className="py-2 pr-3 text-right">{d.all.total}</td>
                  <td className="py-2 pr-3 text-right">{d.all.ai}</td>
                  <td className="py-2 pr-3 text-right">{d.all.adminFirst}</td>
                  <td className="py-2 pr-3 text-right">{d.all.handoff}</td>
                  <td className="py-2 pr-3 text-right">{d.sila.timed ? formatDuration(d.sila.avg) : '–'}</td>
                  <td className="py-2 text-right">{d.dinda.timed ? formatDuration(d.dinda.avg) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FinanceTile>

      <details className="rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-700">Cara membaca angka ini</summary>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Sila bertugas jam 09.00–17.00. Dinda bertugas dari 17.00 sampai tombol <em>Akhiri Sesi</em> pasien terakhir malam itu; jika tidak ada, sampai 21.00.</li>
          <li>Pesan dinilai milik admin yang bertugas saat pesan itu masuk. Pesan di luar jam kerja tidak dinilai.</li>
          <li>&quot;Rata-rata admin membalas&quot; dihitung dari pesan pasien masuk sampai balasan admin pertama di WhatsApp, hanya untuk pesan yang dijawab admin (dijawab lebih dulu dari AI atau diserahkan AI).</li>
          <li>Pesan yang dijawab AI tidak punya waktu balas admin, karena memang tidak dijawab admin.</li>
          <li>Pesan beruntun dari pasien yang sama dihitung satu kali. &quot;Ok&quot;, &quot;siap&quot;, dan sejenisnya dihitung terpisah sebagai tidak perlu dibalas.</li>
          <li>Waktu balasan admin diperbarui tiap 20 menit, jadi pesan yang baru masuk bisa tampil &quot;–&quot; sebentar.</li>
        </ul>
      </details>
    </div>
  );
};

export default AdminReplyPerformance;
