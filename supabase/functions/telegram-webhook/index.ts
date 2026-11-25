// Bot Telegram dua arah untuk owner Kaffah: membalas perintah /kosong dengan
// jadwal kosong dari database.
//
// Deploy dengan --no-verify-jwt (Telegram tidak membawa JWT). Dua jalur masuk:
//  1) Update dari Telegram: header X-Telegram-Bot-Api-Secret-Token harus sama
//     dengan TELEGRAM_INTERNAL_SECRET (dipasang saat setWebhook). Pesan hanya
//     dibalas kalau berasal dari TELEGRAM_CHAT_ID (chat pribadi owner); pesan
//     dari siapa pun yang lain diabaikan tanpa balasan.
//  2) Administrasi: header x-internal-secret + body { "action": "setup" |
//     "status" | "remove" } untuk memasang, memeriksa, atau melepas webhook.
//
// Perintah: /kosong [hari ini|besok|lusa|senin..minggu|dd/mm|dd mmm], /bantuan.
// Teks biasa "jadwal kosong besok" juga dikenali.
//
// Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_INTERNAL_SECRET
import { createClient } from "npm:@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
const SECRET = Deno.env.get("TELEGRAM_INTERNAL_SECRET");

const WITA_OFFSET_MS = 8 * 3600 * 1000;
const MAX_AHEAD_DAYS = 30; // slot digenerate 30 hari ke depan
const DAYS = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3, apr: 4, april: 4,
  mei: 5, jun: 6, juni: 6, jul: 7, juli: 7, agu: 8, agt: 8, agustus: 8,
  sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, nov: 11, november: 11,
  des: 12, desember: 12,
};

const HELP = [
  "Perintah yang tersedia:",
  "/kosong  jadwal kosong hari ini",
  "/kosong besok",
  "/kosong lusa",
  "/kosong senin  (hari itu yang terdekat)",
  "/kosong 15/11  atau  /kosong 15 nov",
  "",
  "Boleh juga ditulis biasa, mis. \"jadwal kosong besok\".",
  "",
  "/izin  ajukan izin owner: pilih tanggal lalu jam dengan tombol",
  "/izin besok  langsung ke pilihan jam besok",
  "",
  "Asisten AI WhatsApp:",
  "- Reply pesan draf AI dengan jawaban/arahan yang benar untuk mengoreksi (juga untuk pesan yang tidak dibalas AI), atau \"ok\" bila sudah tepat.",
  "- Tulis aturan umum langsung (tanpa reply), mis. \"jangan balas dulu, beri jeda minimal 2 menit\".",
  "/jeda 2 menit  atur jeda menjawab",
  "/skor  skor ketepatan AI 24 jam terakhir",
  "/uji  uji regresi AI (soal tetap) dan bandingkan dengan uji sebelumnya",
  "/aturan  daftar arahan, /hapus N  hapus arahan",
  "/status  status AI",
  "",
  "Pengajuan override: reply notifikasinya dengan \"ok\" untuk menyetujui atau \"ga\" untuk menolak.",
  "",
  "Grup revisi: buat grup baru, tambahkan bot (jadikan admin), lalu ketik /grup_revisi di grup itu.",
].join("\n");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function safeEqual(a: string, b: string) {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

// Tanggal WITA hari ini, disimpan sebagai Date tengah malam UTC (pakai getUTC*).
function todayWita(): Date {
  const t = new Date(Date.now() + WITA_OFFSET_MS);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const iso = (d: Date) => d.toISOString().slice(0, 10);

function buildDate(y: number, m: number, d: number): Date | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt : null;
}

// Mengembalikan tanggal, atau string pesan galat kalau tidak dikenali.
function parseDate(argRaw: string, today: Date): Date | string {
  const s = argRaw.trim().toLowerCase().replace(/\s+/g, " ");
  if (s === "" || s === "hari ini" || s === "hariini" || s === "sekarang") return today;
  if (s === "besok") return addDays(today, 1);
  if (s === "lusa") return addDays(today, 2);

  const dayIdx = DAYS.indexOf(s);
  if (dayIdx >= 0) {
    const delta = ((dayIdx - today.getUTCDay() + 7) % 7) || 7;
    return addDays(today, delta);
  }

  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : today.getUTCFullYear();
    return buildDate(y, Number(m[2]), Number(m[1])) ?? "Tanggalnya tidak valid.";
  }
  m = s.match(/^(\d{1,2}) ([a-z]+)(?: (\d{4}))?$/);
  if (m && MONTHS[m[2]]) {
    const y = m[3] ? Number(m[3]) : today.getUTCFullYear();
    return buildDate(y, MONTHS[m[2]], Number(m[1])) ?? "Tanggalnya tidak valid.";
  }
  return "Saya belum paham tanggalnya.\n\n" + HELP;
}

// Menerjemahkan teks pesan menjadi aksi; null = bukan perintah yang dikenali.
function detect(text: string): { kind: "kosong"; arg: string } | { kind: "help" } | null {
  const t = text.trim().toLowerCase();
  let m = t.match(/^\/(?:kosong|jadwal|slot)(?:@\w+)?\s*(.*)$/);
  if (m) return { kind: "kosong", arg: m[1] };
  m = t.match(/^(?:cek |lihat )?(?:jadwal|slot|jam) kosong\s*(.*)$/);
  if (m) return { kind: "kosong", arg: m[1] };
  if (/^\/(?:start|help|bantuan)(?:@\w+)?\b/.test(t)) return { kind: "help" };
  return null;
}

async function tg(method: string, payload: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }));
}

const reply = (text: string) => tg("sendMessage", { chat_id: CHAT_ID, text, disable_web_page_preview: true });

// ---- Izin owner lewat tombol (/izin) ----
type IzinSlot = { st: string; en: string; booked: boolean };
const bitOn = (mask: number, i: number) => (mask >> i) & 1;
const compact = (d: string) => d.replace(/-/g, "");
const expand = (c: string) => `${c.slice(0, 4)}-${c.slice(4, 6)}-${c.slice(6, 8)}`;
const dot = (t: string) => t.replace(":", ".");

function sbClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

// Layar pilih tanggal.
async function izinDatesView(): Promise<{ text: string; kb: any[][] } | string> {
  const { data, error } = await sbClient().rpc("tg_izin_dates");
  if (error || data === null) {
    console.error("tg_izin_dates gagal:", error?.message);
    return "⚠️ Jadwal belum bisa diambil sekarang. Coba lagi sebentar lagi.";
  }
  const list = data as { d: string; n: number; label: string }[];
  if (list.length === 0) return "Tidak ada jadwal yang bisa dikosongkan.";
  const kb: any[][] = [];
  for (let i = 0; i < list.length; i += 2) {
    kb.push(list.slice(i, i + 2).map((x) => ({ text: `${x.label} (${x.n})`, callback_data: `iz:d:${compact(x.d)}` })));
  }
  kb.push([{ text: "✖ Batal", callback_data: "iz:x" }]);
  return { text: "🗓 IZIN\nPilih tanggal yang ingin dikosongkan:", kb };
}

// Layar pilih jam pada satu tanggal; mask = jam terpilih (bit ke-i = slot ke-i).
async function izinSlotsView(dateIso: string, mask: number): Promise<{ text: string; kb: any[][] } | string> {
  const { data, error } = await sbClient().rpc("tg_izin_slots", { p_date: dateIso });
  if (error || data === null) {
    console.error("tg_izin_slots gagal:", error?.message);
    return "⚠️ Jadwal belum bisa diambil sekarang. Coba lagi sebentar lagi.";
  }
  const slots = (data.slots ?? []) as IzinSlot[];
  if (slots.length === 0) return `Tidak ada jadwal tersisa pada ${data.label}.`;
  const c = compact(dateIso);
  const kb: any[][] = [];
  for (let i = 0; i < slots.length; i += 2) {
    kb.push(slots.slice(i, i + 2).map((s, j) => {
      const idx = i + j;
      const lbl = `${bitOn(mask, idx) ? "☑" : "☐"} ${dot(s.st)}-${dot(s.en)}${s.booked ? " 👤" : ""}`;
      return { text: lbl, callback_data: `iz:t:${c}:${idx}:${mask}` };
    }));
  }
  const full = (1 << slots.length) - 1;
  const picked = slots.filter((_, i) => bitOn(mask, i)).length;
  kb.push([
    { text: mask === full ? "Kosongkan pilihan" : "Pilih semua", callback_data: `iz:a:${c}:${mask === full ? 0 : full}` },
    ...(picked > 0 ? [{ text: `✅ Konfirmasi (${picked})`, callback_data: `iz:ok:${c}:${mask}` }] : []),
  ]);
  kb.push([{ text: "⬅️ Tanggal", callback_data: "iz:b" }, { text: "✖ Batal", callback_data: "iz:x" }]);
  const hasBooked = slots.some((s) => s.booked);
  return {
    text: `🗓 IZIN - ${data.label}\nKetuk jam yang ingin dikosongkan, lalu Konfirmasi.` +
      (hasBooked ? "\n👤 = sudah ada pasien" : ""),
    kb,
  };
}

async function showIzin(chatId: string | number, view: { text: string; kb: any[][] } | string, editMsgId?: number) {
  const body: any = typeof view === "string"
    ? { text: view, reply_markup: { inline_keyboard: [] } }
    : { text: view.text, reply_markup: { inline_keyboard: view.kb } };
  if (editMsgId) {
    await tg("editMessageText", { chat_id: chatId, message_id: editMsgId, disable_web_page_preview: true, ...body });
  } else {
    await tg("sendMessage", { chat_id: chatId, disable_web_page_preview: true, ...body });
  }
}

// Perintah /izin [tanggal]: tanpa tanggal tampil pilihan tanggal.
async function startIzin(chatId: string | number, arg: string) {
  if (arg.trim() === "") {
    await showIzin(chatId, await izinDatesView());
    return;
  }
  const today = todayWita();
  const parsed = parseDate(arg, today);
  if (typeof parsed === "string") {
    await tg("sendMessage", { chat_id: chatId, text: parsed });
    return;
  }
  if (parsed.getTime() < today.getTime()) {
    await tg("sendMessage", { chat_id: chatId, text: "Tanggal itu sudah lewat." });
    return;
  }
  await showIzin(chatId, await izinSlotsView(iso(parsed), 0));
}

async function handleIzinCallback(cb: any) {
  const answer = (text?: string) => tg("answerCallbackQuery", { callback_query_id: cb.id, ...(text ? { text } : {}) });
  const msg = cb.message;
  const chatId = msg?.chat?.id;
  if (String(cb.from?.id) !== CHAT_ID || chatId === undefined) {
    await answer("Tidak diizinkan.");
    return;
  }
  const parts = String(cb.data).split(":");
  const act = parts[1];
  const mid = msg.message_id;
  if (act === "x") {
    await answer("Dibatalkan");
    await tg("editMessageText", { chat_id: chatId, message_id: mid, text: "Izin dibatalkan." , reply_markup: { inline_keyboard: [] } });
    return;
  }
  if (act === "b") {
    await answer();
    await showIzin(chatId, await izinDatesView(), mid);
    return;
  }
  const dateC = parts[2] ?? "";
  if (!/^\d{8}$/.test(dateC)) {
    await answer("Tombol tidak dikenali.");
    return;
  }
  const dateIso = expand(dateC);
  if (act === "d") {
    await answer();
    await showIzin(chatId, await izinSlotsView(dateIso, 0), mid);
    return;
  }
  let mask = Number(parts[act === "t" ? 4 : 3]);
  if (!Number.isInteger(mask) || mask < 0 || mask > 0xfffff) {
    await answer("Tombol tidak dikenali.");
    return;
  }
  if (act === "t") {
    const idx = Number(parts[3]);
    if (!Number.isInteger(idx) || idx < 0 || idx > 19) {
      await answer("Tombol tidak dikenali.");
      return;
    }
    mask ^= 1 << idx;
  }
  if (act === "t" || act === "a") {
    await answer();
    await showIzin(chatId, await izinSlotsView(dateIso, mask), mid);
    return;
  }
  if (act === "ok") {
    const sb = sbClient();
    const { data: sd, error: se } = await sb.rpc("tg_izin_slots", { p_date: dateIso });
    const slots = ((sd?.slots ?? []) as IzinSlot[]);
    const starts = slots.filter((_, i) => bitOn(mask, i)).map((s) => s.st);
    if (se || starts.length === 0) {
      await answer("Pilih jam dulu.");
      return;
    }
    const { data, error } = await sb.rpc("tg_izin_apply", { p_date: dateIso, p_starts: starts });
    if (error || typeof data !== "string") {
      console.error("tg_izin_apply gagal:", error?.message);
      await answer("Gagal memproses. Coba lagi.");
      return;
    }
    await answer(data.split("\n")[0]);
    await tg("editMessageText", { chat_id: chatId, message_id: mid, text: data, reply_markup: { inline_keyboard: [] } });
    return;
  }
  await answer("Tombol tidak dikenali.");
}

// Klik tombol Setujui/Tolak pada notifikasi pengajuan override.
async function handleCallback(cb: any) {
  if (String(cb.data ?? "").startsWith("iz:")) {
    await handleIzinCallback(cb);
    return;
  }
  const answer = (text: string) => tg("answerCallbackQuery", { callback_query_id: cb.id, text });
  const msg = cb.message;
  if (String(cb.from?.id) !== CHAT_ID || String(msg?.chat?.id) !== CHAT_ID) {
    await answer("Tidak diizinkan.");
    return;
  }
  const m = String(cb.data ?? "").match(/^ov:([ar]):([0-9a-f-]{36})$/);
  if (!m) {
    await answer("Tombol tidak dikenali.");
    return;
  }
  const approve = m[1] === "a";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await supabase.rpc("tg_decide_override_id", { p_id: m[2], p_approve: approve });
  if (error || typeof data !== "string") {
    console.error("tg_decide_override_id gagal:", error?.message);
    await answer("Gagal memproses. Coba lagi.");
    return;
  }
  await answer(data.split("\n")[0]);
  // Hapus tombol hanya kalau keputusan sudah final (bukan galat sementara).
  if (!data.startsWith("⚠️")) {
    await tg("editMessageReplyMarkup", { chat_id: CHAT_ID, message_id: msg.message_id, reply_markup: { inline_keyboard: [] } });
  }
  await tg("sendMessage", { chat_id: CHAT_ID, text: data, reply_to_message_id: msg.message_id, disable_web_page_preview: true });
}

async function handleUpdate(update: any) {
  if (update?.callback_query) {
    await handleCallback(update.callback_query);
    return;
  }
  const msg = update?.message;
  if (!msg || typeof msg.text !== "string") return;
  // /izin (atau teks "izin [tanggal]") dari owner, di chat pribadi maupun grup notifikasi.
  if (String(msg.from?.id) === CHAT_ID && !msg.reply_to_message) {
    const t = msg.text.trim().toLowerCase();
    const im = t.match(/^\/izin(?:@\w+)?\s*(.*)$/) ?? t.match(/^(?:ajukan |mau )?izin((?: (?:hari ini|besok|lusa|senin|selasa|rabu|kamis|jumat|sabtu|minggu|\d{1,2}[\/.\-]\d{1,2}|\d{1,2} [a-z]+))?)$/);
    if (im) {
      await startIzin(msg.chat.id, im[1] ?? "");
      return;
    }
  }
  // Pesan owner di grup (mis. grup revisi AI) diteruskan ke wa-ai-reply, yang memeriksa grupnya.
  if (String(msg.chat?.id) !== CHAT_ID && String(msg.from?.id) === CHAT_ID && ["group", "supergroup"].includes(String(msg.chat?.type))) {
    // Reply ke notifikasi "AI tidak membalas pesan ini" = jawaban owner: dirapikan dan disimpan oleh
    // wa-ai-revision-notify. Bila bukan reply ke notifikasi itu (handled=false), lanjut ke wa-ai-reply.
    if (msg.reply_to_message?.message_id) {
      const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/wa-ai-revision-notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({
          answer: {
            chat_id: String(msg.chat.id),
            reply_to_message_id: msg.reply_to_message.message_id,
            message_id: msg.message_id,
            text: msg.text,
          },
        }),
      }).then((x) => x.json()).catch(() => null);
      if (r?.handled) return;
    }
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/wa-ai-reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({ telegram_update: update }),
    }).catch(() => null);
    return;
  }
  // Hanya chat pribadi milik owner yang dilayani.
  if (String(msg.chat?.id) !== CHAT_ID || String(msg.from?.id) !== CHAT_ID) return;

  // Balasan "ok"/"ga" pada notifikasi pengajuan override = setujui/tolak.
  const quoted = String(msg.reply_to_message?.text ?? "");
  if (quoted.includes("Pengajuan pengecualian")) {
    const word = msg.text.trim().toLowerCase().replace(/[.!\s]+$/g, "");
    const approve = /^(ok|oke|okay|ya|y|setuju|acc)$/.test(word);
    const reject = /^(ga|gak|nggak|ngga|tidak|tolak|no|n)$/.test(word);
    if (approve || reject) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data, error } = await supabase.rpc("tg_decide_override", { p_text: quoted, p_approve: approve });
      if (error || typeof data !== "string") {
        console.error("tg_decide_override gagal:", error?.message);
        await reply("⚠️ Gagal memproses perintah. Coba lagi atau putuskan lewat halaman Pengajuan di aplikasi.");
      } else {
        await reply(data);
      }
      return;
    }
  }

  // Koreksi draf AI WhatsApp (reply), aturan umum, dan perintah /skor /jeda /aturan /hapus /status
  // ditangani wa-ai-reply. Teks bebas yang bukan perintah jadwal juga dianggap arahan untuk AI.
  const body = msg.text.trim();
  const forAi = msg.reply_to_message ||
    /^\/(?:skor|uji|jeda|aturan|hapus|status)(?:@\w+)?\b/i.test(body) ||
    (detect(body) === null && !body.startsWith("/"));
  if (forAi) {
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/wa-ai-reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ telegram_update: update }),
    });
    if (!res.ok) await reply("Maaf, koreksi belum bisa disimpan sekarang. Coba lagi sebentar lagi.");
    return;
  }

  const cmd = detect(msg.text);
  if (!cmd) {
    await reply(HELP);
    return;
  }
  if (cmd.kind === "help") {
    await reply(HELP);
    return;
  }

  const today = todayWita();
  const parsed = parseDate(cmd.arg, today);
  if (typeof parsed === "string") {
    await reply(parsed);
    return;
  }
  if (parsed.getTime() < today.getTime()) {
    await reply("Tanggal itu sudah lewat.");
    return;
  }
  const last = addDays(today, MAX_AHEAD_DAYS);
  if (parsed.getTime() > last.getTime()) {
    await reply(`Jadwal baru tersedia sampai ${MAX_AHEAD_DAYS} hari ke depan (s/d ${iso(last)}).`);
    return;
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await supabase.rpc("tg_free_slots", { p_date: iso(parsed) });
  if (error || typeof data !== "string") {
    console.error("tg_free_slots gagal:", error?.message);
    await reply("Maaf, jadwal kosong belum bisa diambil sekarang. Coba lagi sebentar lagi.");
    return;
  }
  await reply(data);
}

async function handleAdmin(action: string) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/telegram-webhook`;
  if (action === "setup") {
    const hook = await tg("setWebhook", {
      url,
      secret_token: SECRET,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    });
    const cmds = await tg("setMyCommands", {
      commands: [
        { command: "kosong", description: "Jadwal kosong (mis. /kosong besok)" },
        { command: "izin", description: "Ajukan izin: pilih jadwal yang dikosongkan" },
        { command: "skor", description: "Skor ketepatan AI WhatsApp" },
        { command: "uji", description: "Uji regresi AI (soal tetap)" },
        { command: "jeda", description: "Atur jeda AI menjawab (mis. /jeda 2 menit)" },
        { command: "aturan", description: "Daftar arahan owner untuk AI" },
        { command: "status", description: "Status AI WhatsApp" },
        { command: "bantuan", description: "Daftar perintah" },
      ],
    });
    return { setWebhook: hook.ok ? "ok" : hook.description, setMyCommands: cmds.ok ? "ok" : cmds.description };
  }
  if (action === "status") {
    const info = await tg("getWebhookInfo", {});
    const r = info?.result ?? {};
    return {
      ok: info.ok,
      terpasang: r.url === url,
      pending_update_count: r.pending_update_count,
      last_error_message: r.last_error_message ?? null,
    };
  }
  if (action === "remove") {
    const res = await tg("deleteWebhook", { drop_pending_updates: true });
    return { deleteWebhook: res.ok ? "ok" : res.description };
  }
  return { error: "action tidak dikenal" };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  if (!BOT_TOKEN || !CHAT_ID || !SECRET) return json({ ok: false, error: "Secret Telegram belum lengkap" }, 500);

  const internal = req.headers.get("x-internal-secret");
  if (internal !== null) {
    if (!safeEqual(internal, SECRET)) return json({ ok: false }, 401);
    const body = await req.json().catch(() => ({}));
    return json(await handleAdmin(String(body?.action ?? "")));
  }

  const tgSecret = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!safeEqual(tgSecret, SECRET)) return json({ ok: false }, 401);

  // Telegram mengulang kiriman kalau respons bukan 200, jadi galat di sini
  // dicatat saja dan tetap dibalas 200.
  try {
    await handleUpdate(await req.json());
  } catch (e) {
    console.error("handleUpdate gagal:", (e as Error)?.message || e);
  }
  return json({ ok: true });
});
