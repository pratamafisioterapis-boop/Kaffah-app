import React, { useEffect, useState } from 'react';
import { Bot, ChevronLeft, ChevronRight, Moon, Sun, User } from 'lucide-react';
import FinanceTile, { TileEmpty, TileLoading } from '@/components/owner/finance/FinanceTile';
import { ADMIN_SHIFTS, fetchAdminReplyPerformance, formatDuration, speedGrade, witaParts } from '@/lib/adminReplyPerformance';

const TONE = {
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
};

const fmtDate = (d) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
};

const shiftDate = (date, delta) => {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + delta));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
};
const fmtLong = (d) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const fmtShort = (d) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const pad2 = (n) => String(n).padStart(2, '0');
const toIso = (t) => `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
const fromIso = (d) => { const [y, m, day] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, day)); };
// Minggu = Senin–Minggu yang memuat tanggal itu.
const weekRange = (d) => {
  const t = fromIso(d);
  const back = (t.getUTCDay() + 6) % 7;
  const start = new Date(t.getTime() - back * 86400e3);
  return { start: toIso(start), end: toIso(new Date(start.getTime() + 6 * 86400e3)) };
};
const monthRange = (d) => {
  const t = fromIso(d);
  return { start: toIso(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1))), end: toIso(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0))) };
};
const fmtMonth = (d) => fromIso(d).toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' });

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
        <TileEmpty>Belum ada pesan pasien di jam kerja {shift.name} pada waktu ini.</TileEmpty>
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
const AdminReplyPerformance = () => {
  const today = witaParts(Date.now()).date;
  // Bawaan: ringkasan hari ini. Bisa diganti Minggu / Bulan / Kustom, dan digeser maju-mundur.
  const [view, setView] = useState('day'); // day | week | month | custom
  const [anchor, setAnchor] = useState(today); // tanggal acuan untuk hari/minggu/bulan
  const [custom, setCustom] = useState({ start: shiftDate(today, -6), end: today });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  let range = { start: anchor, end: anchor };
  if (view === 'week') range = weekRange(anchor);
  else if (view === 'month') range = monthRange(anchor);
  else if (view === 'custom') range = custom;
  const startDate = range.start;
  const endDate = range.end;
  const isDay = startDate === endDate;
  const validRange = startDate && endDate && startDate <= endDate;

  useEffect(() => {
    if (!validRange) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAdminReplyPerformance({ startDate, endDate })
      .then((r) => { if (!cancelled) setData(r); })
      .catch((e) => { console.error('Gagal memuat performa admin', e); if (!cancelled) setError(e.message || 'Gagal memuat data'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [startDate, endDate, validRange]);

  const stepBack = () => setAnchor(view === 'month' ? shiftDate(monthRange(anchor).start, -1) : shiftDate(anchor, view === 'week' ? -7 : -1));
  const stepNext = () => setAnchor(view === 'month' ? shiftDate(monthRange(anchor).end, 1) : shiftDate(anchor, view === 'week' ? 7 : 1));
  const atEnd = range.end >= today;
  const heading = view === 'day' ? (anchor === today ? `Hari ini · ${fmtLong(anchor)}` : fmtLong(anchor))
    : view === 'week' ? `${fmtShort(range.start)} – ${fmtShort(range.end)}`
    : view === 'month' ? fmtMonth(anchor)
    : validRange ? `${fmtShort(range.start)} – ${fmtShort(range.end)}` : 'Pilih tanggal awal dan akhir';
  const tabs = [['day', 'Hari'], ['week', 'Minggu'], ['month', 'Bulan'], ['custom', 'Kustom']];
  const navBtn = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-white text-slate-600 active:scale-95 disabled:opacity-30';

  const picker = (
    <div className="space-y-2">
      <div className="grid grid-cols-4 rounded-full bg-slate-100 p-1 text-sm font-semibold">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" onClick={() => { setView(key); if (key !== 'custom') setAnchor(today); }}
            className={`rounded-full py-1.5 transition-colors ${view === key ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{label}</button>
        ))}
      </div>
      {view === 'custom' ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-500">Dari
            <input type="date" value={custom.start} max={today} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, start: e.target.value }))} className="mt-1 h-10 w-full rounded-full border bg-white px-3 text-center text-sm font-semibold text-slate-700" />
          </label>
          <label className="text-xs text-slate-500">Sampai
            <input type="date" value={custom.end} max={today} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, end: e.target.value }))} className="mt-1 h-10 w-full rounded-full border bg-white px-3 text-center text-sm font-semibold text-slate-700" />
          </label>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Sebelumnya" onClick={stepBack} className={navBtn}><ChevronLeft className="h-5 w-5" /></button>
          <div className="flex h-10 min-w-0 flex-1 items-center justify-center rounded-full border bg-white px-3 text-center text-sm font-semibold text-slate-700">
            <span className="truncate">{heading}</span>
          </div>
          <button type="button" aria-label="Berikutnya" disabled={atEnd} onClick={stepNext} className={navBtn}><ChevronRight className="h-5 w-5" /></button>
        </div>
      )}
      {view === 'day' && (
        <input type="date" value={anchor} max={today} onChange={(e) => e.target.value && setAnchor(e.target.value)} className="h-9 w-full rounded-full border bg-white px-3 text-center text-xs text-slate-500" aria-label="Pilih tanggal" />
      )}
      {!validRange && <div className="text-xs text-red-500">Tanggal awal tidak boleh setelah tanggal akhir.</div>}
    </div>
  );

  if (!validRange) return <div className="space-y-4">{picker}</div>;
  if (loading) return <div className="space-y-4">{picker}<TileLoading /></div>;
  if (error) return <div className="space-y-4">{picker}<TileEmpty>Gagal memuat performa admin: {error}</TileEmpty></div>;
  if (!data || data.all.total === 0) {
    return (
      <div className="space-y-4">
        {picker}
        <TileEmpty>{isDay ? 'Belum ada pesan pasien pada jam kerja admin di hari ini. Coba pilih hari lain.' : 'Belum ada pesan pasien pada jam kerja admin di rentang ini. Coba rentang lain.'}</TileEmpty>
      </div>
    );
  }

  const { sila, dinda, all, outside, days } = data;
  const totalPct = (n) => (all.total ? Math.round((n / all.total) * 100) : 0);

  return (
    <div className="space-y-4">
      {picker}
      {/* Ringkasan satu kalimat */}
      <FinanceTile title={view === 'day' ? (anchor === today ? 'Ringkasan hari ini' : `Ringkasan ${fmtShort(anchor)}`) : view === 'week' ? 'Ringkasan minggu ini' : view === 'month' ? `Ringkasan ${fmtMonth(anchor)}` : 'Ringkasan rentang terpilih'} icon={User}>
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

      {/* Per hari (hanya saat melihat seluruh periode) */}
      {!isDay && (
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
        <p className="mt-2 text-xs text-slate-400">Pilih &quot;Hari&quot; di atas untuk melihat satu hari saja.</p>
      </FinanceTile>
      )}

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
