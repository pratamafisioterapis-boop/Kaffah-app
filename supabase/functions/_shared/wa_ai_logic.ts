// Logika murni (tanpa I/O) untuk asisten AI WhatsApp: waktu WITA, jam buka, nomor,
// nama pasien baru, harga & promo. Dipisah agar bisa diuji tanpa database.
// Aturan harga/promo bersumber dari docs/AI_KNOWLEDGE_KAFFAH.md.

const WITA_OFFSET_MS = 8 * 3600 * 1000;

export type WitaParts = { date: string; time: string; dow: number; minutes: number };

/** Waktu dinding WITA (UTC+8) dari sebuah instan. dow: 0=Minggu … 6=Sabtu. */
export function witaParts(d: Date): WitaParts {
  const w = new Date(d.getTime() + WITA_OFFSET_MS);
  const iso = w.toISOString(); // sudah digeser, jadi bagian "UTC"-nya adalah jam WITA
  return {
    date: iso.slice(0, 10),
    time: iso.slice(11, 16),
    dow: w.getUTCDay(),
    minutes: w.getUTCHours() * 60 + w.getUTCMinutes(),
  };
}

/** Senin–Jumat 09.00–21.00, Sabtu–Minggu 09.00–17.00 (WITA). */
export function isWithinBusinessHours(d: Date): boolean {
  const { dow, minutes } = witaParts(d);
  const close = dow >= 1 && dow <= 5 ? 21 * 60 : 17 * 60;
  return minutes >= 9 * 60 && minutes < close;
}

// ---------------------------------------------------------------- jam aktif AI

/** Jam operasional per hari (0=Minggu … 6=Sabtu): [buka, tutup] "HH:MM" WITA. */
export type BusinessHours = Record<string, [string, string] | null>;

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  "1": ["09:00", "21:00"], "2": ["09:00", "21:00"], "3": ["09:00", "21:00"],
  "4": ["09:00", "21:00"], "5": ["09:00", "21:00"],
  "6": ["09:00", "17:00"], "0": ["09:00", "17:00"],
};

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** Apakah klinik sedang buka (WITA) menurut jadwal; hari bernilai null = tutup seharian. */
export function isOpenAt(d: Date, hours?: BusinessHours | null): boolean {
  const h = hours && Object.keys(hours).length ? hours : DEFAULT_BUSINESS_HOURS;
  const { dow, minutes } = witaParts(d);
  const day = h[String(dow)];
  if (!day) return false;
  return minutes >= toMinutes(day[0]) && minutes < toMinutes(day[1]);
}

export type AiMode = "both" | "closed_only" | "silent_only";
export type Policy = {
  mode: AiMode;
  delay_seconds: number; // admin diam selama ini (jam buka)
  closed_delay_seconds: number; // jeda saat jam tutup (0 = langsung)
  business_hours?: BusinessHours | null;
};

/**
 * both: jam buka -> tunggu admin diam N detik; jam tutup -> balas setelah jeda tutup.
 * closed_only: hanya saat jam tutup. silent_only: kapan pun, tunggu admin diam N detik.
 */
export function dueDecision(
  now: Date,
  p: Policy,
): { act: boolean; delaySeconds: number; reason: string } {
  const open = isOpenAt(now, p.business_hours);
  if (p.mode === "silent_only") {
    return { act: true, delaySeconds: p.delay_seconds, reason: "admin_diam" };
  }
  if (!open) return { act: true, delaySeconds: p.closed_delay_seconds, reason: "jam_tutup" };
  if (p.mode === "both") return { act: true, delaySeconds: p.delay_seconds, reason: "admin_diam" };
  return { act: false, delaySeconds: 0, reason: "jam_buka_mode_hanya_tutup" };
}

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/**
 * Pesan jadwal kosong dengan format yang sama dengan tombol salin di aplikasi:
 * terapis diurutkan berdasarkan jam kosong paling awal (seri: urutan terapis di aplikasi), nama terapis tebal (*...*), tiap jam
 * diawali 🕒, ditutup tanda tangan klinik.
 */
export function formatScheduleMessage(
  date: string,
  blocks: { name: string; times: string[]; rank?: number }[],
): string {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const head = `Berikut jadwal yang tersedia untuk hari ${HARI[dow]}, ${d} ${BULAN[m - 1]} ${y}:`;
  const body = [...blocks]
    .map((b) => ({ ...b, times: [...b.times].sort() }))
    .filter((b) => b.times.length)
    // Jam kosong paling awal dulu; bila sama, ikuti urutan terapis di aplikasi (rank).
    .sort((a, b) => a.times[0].localeCompare(b.times[0]) || (a.rank ?? 0) - (b.rank ?? 0))
    .map((b) => `*${b.name}*\n${b.times.map((t) => `🕒 ${t}`).join("\n")}`)
    .join("\n\n");
  return `${head}\n\n${body}\n\n\nKaffah Physiotherapy`;
}

/** 62812… → varian penulisan yang mungkin tersimpan di tabel pasien. */
export function phoneVariants(waId: string): string[] {
  const d = (waId || "").replace(/\D/g, "");
  const local = d.startsWith("62") ? d.slice(2) : d.replace(/^0/, "");
  if (local.length < 7) return [];
  return [...new Set([`62${local}`, `0${local}`, local, `+62${local}`])];
}

/** Nama pasien baru ditulis dengan awalan "Ka " di guest name. */
export function withKaPrefix(name: string): string {
  const n = (name || "").replace(/\s+/g, " ").trim();
  if (!n) return "";
  return /^ka\s/i.test(n) ? n.replace(/^ka\s/i, "Ka ") : `Ka ${n}`;
}

/** Tanggal "YYYY-MM-DD" + jam "HH:MM[:SS]" WITA → ISO dengan offset +08:00. */
export function witaTimestamp(date: string, time: string): string {
  const t = time.length === 5 ? `${time}:00` : time;
  return `${date}T${t}+08:00`;
}

export type Slot = {
  therapist_id: string;
  slot_start: string;
  slot_end?: string;
  duration_minutes?: number;
  status: string;
};

/** Hanya slot berstatus 'aktif' yang belum lewat (beri jeda agar sempat datang). */
export function openFutureSlots(
  slots: Slot[],
  date: string,
  now: Date,
  bufferMinutes = 30,
): Slot[] {
  const n = witaParts(now);
  return slots.filter((s) => {
    if (s.status !== "aktif") return false;
    if (date > n.date) return true;
    if (date < n.date) return false;
    const [h, m] = s.slot_start.split(":").map(Number);
    return h * 60 + m >= n.minutes + bufferMinutes;
  });
}

// ---------------------------------------------------------------- harga & promo

export type PriceInput = {
  kind: "regular" | "recovery";
  package_sessions?: 0 | 3 | 6 | 12;
  patient_age?: number | null;
  complaint_count?: number;
  promo?: "none" | "berdua" | "referral";
};

export type PriceQuote = {
  price: number;
  breakdown: string[];
  notes: string[];
  needs_admin: boolean;
};

const PACKAGE_PRICE: Record<number, number> = { 3: 530_000, 6: 1_000_000, 12: 1_900_000 };
const EXTRA_COMPLAINT = 25_000;
const PROMO_DISCOUNT = 20_000;

export const rupiah = (n: number) => "Rp" + n.toLocaleString("id-ID");

export function quotePrice(i: PriceInput): PriceQuote {
  const breakdown: string[] = [];
  const notes: string[] = [];
  let needsAdmin = false;
  const sessions = i.package_sessions || 0;
  const complaints = Math.max(1, i.complaint_count || 1);
  const multi = complaints > 1;
  const isChild = i.patient_age != null && i.patient_age <= 17;
  const promo = i.promo || "none";

  // Paket: tidak ada diskon/promo apa pun; tidak ada paket recovery maupun paket anak.
  if (sessions) {
    if (i.kind === "recovery") {
      return {
        price: 0,
        breakdown,
        notes: ["Tidak ada paket Recovery; hanya per sesi Rp220.000."],
        needs_admin: true,
      };
    }
    if (isChild) {
      return {
        price: 0,
        breakdown,
        notes: ["Pasien anak hanya harga satuan Rp150.000 per sesi, tidak ada paket anak."],
        needs_admin: true,
      };
    }
    const base = PACKAGE_PRICE[sessions];
    if (!base) {
      return { price: 0, breakdown, notes: ["Paket yang tersedia hanya 3, 6, atau 12 sesi."], needs_admin: true };
    }
    let total = base;
    breakdown.push(`Paket ${sessions} sesi: ${rupiah(base)}`);
    if (multi) {
      const extra = EXTRA_COMPLAINT * sessions;
      total += extra;
      breakdown.push(`Keluhan lebih dari satu: ${rupiah(EXTRA_COMPLAINT)} x ${sessions} sesi = ${rupiah(extra)}`);
    }
    if (promo !== "none") notes.push("Paket tidak mendapat diskon atau promo apa pun.");
    return { price: total, breakdown, notes, needs_admin: false };
  }

  // Per sesi
  let price: number;
  if (i.kind === "recovery") {
    price = multi ? 250_000 : 220_000;
    breakdown.push(multi ? "Recovery + keluhan lain: Rp250.000" : "Recovery: Rp220.000");
  } else if (isChild) {
    price = 150_000;
    breakdown.push("Tarif pasien anak (sampai 17 tahun): Rp150.000");
    if (multi) {
      needsAdmin = true;
      notes.push("Anak dengan lebih dari satu keluhan: belum ada aturan harga, konfirmasi ke admin.");
    }
  } else {
    price = multi ? 200_000 + EXTRA_COMPLAINT : 200_000;
    breakdown.push(multi ? "Regular + keluhan tambahan: Rp225.000" : "Regular: Rp200.000");
  }

  // Promo: tidak digabung; tarif anak sudah terhitung promo, jadi tidak ditambah promo lain.
  if (promo !== "none") {
    if (isChild && i.kind !== "recovery") {
      notes.push("Tarif anak Rp150.000 sudah terhitung promo, tidak ditambah promo lain.");
    } else {
      price -= PROMO_DISCOUNT;
      breakdown.push(
        `Promo ${promo === "berdua" ? "datang berdua" : "referral"}: -${rupiah(PROMO_DISCOUNT)} per pasien`,
      );
      notes.push("Potongan diterapkan admin saat pembayaran; tidak bisa digabung promo lain.");
    }
  }
  return { price, breakdown, notes, needs_admin: needsAdmin };
}
