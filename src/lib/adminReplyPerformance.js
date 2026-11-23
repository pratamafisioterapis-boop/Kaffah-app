import { supabase } from '@/lib/customSupabaseClient';
import { KAFFAH_CLINIC_ID } from '@/lib/clinicIds';

// Jam kerja admin Kaffah (WITA, UTC+8).
//  - Sila : 09.00 – 17.00
//  - Dinda: 17.00 sampai tombol "Akhiri Sesi" pasien terakhir malam itu; bila tidak ada, sampai 21.00.
export const ADMIN_SHIFTS = [
  { key: 'sila', name: 'Sila', label: '09.00 – 17.00' },
  { key: 'dinda', name: 'Dinda', label: '17.00 – sesi terakhir (maks. 21.00 bila tak ada)' },
];
const SILA_START = 9 * 60;
const SILA_END = 17 * 60;
const DINDA_DEFAULT_END = 21 * 60;
const WITA_OFFSET_MS = 8 * 3600e3;

const pad = (n) => String(n).padStart(2, '0');
/** 'yyyy-MM-dd' dan menit-sejak-tengah-malam dalam WITA untuk sebuah timestamp (ms). */
export const witaParts = (ms) => {
  const d = new Date(ms + WITA_OFFSET_MS);
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60,
  };
};

/**
 * Admin yang bertanggung jawab atas pesan pasien yang masuk pada waktu `ms`.
 * `lastEndByDate` = { 'yyyy-MM-dd': menit WITA "Akhiri Sesi" terakhir (>= 17.00) }.
 * Mengembalikan 'sila' | 'dinda' | null (di luar jam kerja).
 */
export const shiftOwnerAt = (ms, lastEndByDate = {}) => {
  const { date, minutes } = witaParts(ms);
  if (minutes >= SILA_START && minutes < SILA_END) return 'sila';
  const end = lastEndByDate[date] ?? DINDA_DEFAULT_END;
  if (minutes >= SILA_END && minutes < end) return 'dinda';
  return null;
};

const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);

/** Durasi (ms) → "3 mnt 20 dtk" / "1 j 5 mnt". */
export const formatDuration = (ms) => {
  if (ms == null || !Number.isFinite(ms)) return '–';
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} dtk`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt${s % 60 ? ` ${s % 60} dtk` : ''}`;
  const h = Math.floor(m / 60);
  return `${h} j${m % 60 ? ` ${m % 60} mnt` : ''}`;
};

const QUALITY = ['sesuai', 'sebagian', 'tidak', 'koreksi'];

/**
 * rows: [{ inboundAt, aiAt, outcome, verdict, adminRepliedAt }] (ms atau null).
 * Hanya pesan yang masuk saat jam kerja yang dinilai; sisanya dihitung "di luar jam kerja".
 */
export const computePerformance = (rows, lastEndByDate = {}) => {
  const people = {
    sila: { rows: [] },
    dinda: { rows: [] },
  };
  let outside = 0;
  rows.forEach((r) => {
    const who = shiftOwnerAt(r.inboundAt, lastEndByDate);
    if (!who) { outside += 1; return; }
    people[who].rows.push(r);
  });

  const summarize = (list) => {
    const adminTimes = list.filter((r) => r.adminRepliedAt != null).map((r) => Math.max(0, r.adminRepliedAt - r.inboundAt));
    const unanswered = list.filter((r) => r.adminRepliedAt == null && r.verdict === 'belum_dibalas').length;
    const aiTimes = list.filter((r) => r.outcome === 'simulated' && r.aiAt != null).map((r) => Math.max(0, r.aiAt - r.inboundAt));
    const handoff = list.filter((r) => r.outcome === 'handoff').length;
    const quality = Object.fromEntries(QUALITY.map((q) => [q, list.filter((r) => r.verdict === q).length]));
    const scored = QUALITY.reduce((a, q) => a + quality[q], 0);
    const pairs = list.filter((r) => r.adminRepliedAt != null && r.outcome === 'simulated' && r.aiAt != null);
    const aiFaster = pairs.filter((r) => r.aiAt < r.adminRepliedAt).length;
    return {
      total: list.length,
      replied: adminTimes.length,
      unanswered,
      adminMedian: median(adminTimes),
      adminMean: mean(adminTimes),
      within5: pct(adminTimes.filter((t) => t <= 5 * 60e3).length, adminTimes.length),
      within15: pct(adminTimes.filter((t) => t <= 15 * 60e3).length, adminTimes.length),
      aiCount: aiTimes.length,
      aiMedian: median(aiTimes),
      handoff,
      quality,
      aiAccuracy: scored ? Math.round(((quality.sesuai + quality.sebagian * 0.5) / scored) * 100) : null,
      scored,
      pairs: pairs.length,
      aiFasterPct: pct(aiFaster, pairs.length),
      medianGap: pairs.length
        ? median(pairs.map((r) => (r.adminRepliedAt - r.inboundAt) - (r.aiAt - r.inboundAt)))
        : null,
    };
  };

  const all = [...people.sila.rows, ...people.dinda.rows];
  const byDay = {};
  all.forEach((r) => {
    const { date } = witaParts(r.inboundAt);
    (byDay[date] = byDay[date] || { sila: [], dinda: [] })[shiftOwnerAt(r.inboundAt, lastEndByDate)].push(r);
  });
  const days = Object.keys(byDay).sort().reverse().map((date) => ({
    date,
    dindaEnd: lastEndByDate[date] ?? null,
    sila: summarize(byDay[date].sila),
    dinda: summarize(byDay[date].dinda),
    ai: summarize([...byDay[date].sila, ...byDay[date].dinda]),
  }));

  return {
    sila: summarize(people.sila.rows),
    dinda: summarize(people.dinda.rows),
    all: summarize(all),
    outside,
    days,
  };
};

const PAGE = 1000;
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, (i + 1) * n));

/** Ambil data periode (yyyy-MM-dd, WITA) dari Supabase lalu hitung performanya. */
export const fetchAdminReplyPerformance = async ({ startDate, endDate, clinicId = KAFFAH_CLINIC_ID }) => {
  const fromIso = `${startDate}T00:00:00+08:00`;
  const toIso = `${endDate}T23:59:59.999+08:00`;
  // Draf AI dibuat beberapa menit setelah pesan masuk; beri ruang 1 hari di ujung akhir.
  const toPadded = new Date(Date.parse(toIso) + 24 * 3600e3).toISOString();

  const logs = [];
  for (let page = 0; page < 30; page += 1) {
    const { data, error } = await supabase
      .from('wa_ai_logs')
      .select('id, created_at, outcome, verdict, admin_replied_at, inbound_message_id')
      .eq('clinic_id', clinicId)
      .eq('mode', 'review')
      .in('outcome', ['simulated', 'handoff'])
      .gte('created_at', fromIso)
      .lte('created_at', toPadded)
      .not('inbound_message_id', 'is', null)
      .order('created_at', { ascending: true })
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) throw error;
    logs.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }

  const inboundTimes = new Map();
  const ids = [...new Set(logs.map((l) => l.inbound_message_id))];
  for (const part of chunk(ids, 150)) {
    const { data, error } = await supabase.from('wa_inbox_messages').select('id, created_at').in('id', part);
    if (error) throw error;
    (data || []).forEach((m) => inboundTimes.set(m.id, Date.parse(m.created_at)));
  }

  const lo = Date.parse(fromIso);
  const hi = Date.parse(toIso);
  const rows = logs
    .map((l) => ({
      inboundAt: inboundTimes.get(l.inbound_message_id),
      aiAt: Date.parse(l.created_at),
      outcome: l.outcome,
      verdict: l.verdict,
      adminRepliedAt: l.admin_replied_at ? Date.parse(l.admin_replied_at) : null,
    }))
    .filter((r) => Number.isFinite(r.inboundAt) && r.inboundAt >= lo && r.inboundAt <= hi);

  // Tombol "Akhiri Sesi" (daily_recaps.end_time): yang terakhir tiap malam (>= 17.00) menutup shift Dinda.
  const lastEndByDate = {};
  const { data: recaps, error: recapErr } = await supabase
    .from('daily_recaps')
    .select('end_time')
    .eq('clinic_id', clinicId)
    .not('end_time', 'is', null)
    .gte('end_time', fromIso)
    .lte('end_time', toPadded)
    .limit(5000);
  if (recapErr) throw recapErr;
  (recaps || []).forEach((r) => {
    const t = Date.parse(r.end_time);
    if (!Number.isFinite(t)) return;
    const { date, minutes } = witaParts(t);
    if (minutes < SILA_END) return;
    lastEndByDate[date] = Math.max(lastEndByDate[date] ?? 0, minutes);
  });

  return { ...computePerformance(rows, lastEndByDate), rowCount: rows.length };
};
