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
 * Jenis pesan menurut log AI:
 *  ai          : AI membalas (live) atau menyusun draf (review)
 *  admin_first : admin sudah membalas lewat WhatsApp sebelum AI
 *  handoff     : diserahkan ke admin (AI tidak boleh menjawab)
 *  ack         : "ok"/"siap", tidak perlu dibalas
 *  merged      : pesan beruntun, dijawab lewat pesan terbarunya (tidak dihitung ganda)
 */
export const classifyLog = (l) => {
  if (l.outcome === 'handoff') return 'handoff';
  if (l.outcome === 'replied' || l.outcome === 'simulated') return 'ai';
  if (l.outcome === 'skipped') {
    if (l.skipReason === 'ada_pesan_lebih_baru') return 'merged';
    if (l.skipReason === 'tidak_perlu_dibalas') return 'ack';
    if (l.skipReason === 'admin_sudah_membalas_via_watzap') return 'admin_first';
  }
  return 'other';
};

/**
 * rows: [{ inboundAt, aiAt, outcome, skipReason, mode, verdict, adminRepliedAt }] (ms atau null).
 * Hanya pesan yang masuk saat jam kerja yang dinilai; sisanya dihitung "di luar jam kerja".
 * `now` dipakai menandai pesan lama tanpa balasan admin yang terdeteksi.
 */
export const computePerformance = (rows, lastEndByDate = {}, now = Date.now()) => {
  const people = { sila: [], dinda: [] };
  let outside = 0;
  let merged = 0;
  rows.forEach((r) => {
    const kind = classifyLog(r);
    if (kind === 'merged') { merged += 1; return; }
    if (kind === 'other') return;
    const who = shiftOwnerAt(r.inboundAt, lastEndByDate);
    if (!who) { outside += 1; return; }
    people[who].push({ ...r, kind });
  });

  const summarize = (all) => {
    const ack = all.filter((r) => r.kind === 'ack').length;
    const list = all.filter((r) => r.kind !== 'ack');
    const ai = list.filter((r) => r.kind === 'ai');
    const adminFirst = list.filter((r) => r.kind === 'admin_first');
    const handoff = list.filter((r) => r.kind === 'handoff');

    // Siapa membalas lebih dulu (pesan yang bisa dijawab AI): admin bila sudah membalas sebelum AI.
    const adminWon = (r) => r.kind === 'admin_first' || (r.adminRepliedAt != null && r.adminRepliedAt < r.aiAt);
    const contested = [...ai, ...adminFirst];
    const adminWins = contested.filter(adminWon).length;

    // Waktu balas admin: pesan yang diserahkan / dijawab admin lebih dulu / admin membalas setelah draf.
    const adminRows = list.filter((r) => r.adminRepliedAt != null && (r.kind !== 'ai' || r.mode === 'review' || adminWon(r)));
    const adminTimes = adminRows.map((r) => Math.max(0, r.adminRepliedAt - r.inboundAt));
    const pendingData = list.filter((r) => (r.kind === 'handoff' || r.kind === 'admin_first') && r.adminRepliedAt == null);
    const unanswered = pendingData.filter((r) => now - r.inboundAt > 24 * 3600e3).length;

    const aiTimes = ai.filter((r) => !adminWon(r)).map((r) => Math.max(0, r.aiAt - r.inboundAt));
    const quality = Object.fromEntries(QUALITY.map((q) => [q, list.filter((r) => r.verdict === q).length]));
    const scored = QUALITY.reduce((a, q) => a + quality[q], 0);
    const pairs = ai.filter((r) => r.mode === 'review' && r.adminRepliedAt != null);
    return {
      total: list.length,
      ack,
      handoff: handoff.length,
      aiReplied: ai.length - ai.filter(adminWon).length,
      adminFirst: contested.filter(adminWon).length,
      contested: contested.length,
      adminWinPct: pct(adminWins, contested.length),
      replied: adminTimes.length,
      awaitingData: pendingData.length - unanswered,
      unanswered,
      adminMedian: median(adminTimes),
      adminMean: mean(adminTimes),
      within5: pct(adminTimes.filter((t) => t <= 5 * 60e3).length, adminTimes.length),
      within15: pct(adminTimes.filter((t) => t <= 15 * 60e3).length, adminTimes.length),
      aiCount: aiTimes.length,
      aiMedian: median(aiTimes),
      quality,
      aiAccuracy: scored ? Math.round(((quality.sesuai + quality.sebagian * 0.5) / scored) * 100) : null,
      scored,
      pairs: pairs.length,
    };
  };

  const all = [...people.sila, ...people.dinda];
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
    sila: summarize(people.sila),
    dinda: summarize(people.dinda),
    all: summarize(all),
    outside,
    merged,
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
      .select('id, created_at, outcome, skip_reason, mode, verdict, admin_replied_at, inbound_message_id')
      .eq('clinic_id', clinicId)
      .in('mode', ['live', 'review'])
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
      skipReason: l.skip_reason,
      mode: l.mode,
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
