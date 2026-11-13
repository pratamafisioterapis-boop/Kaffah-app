// Kirim notifikasi Telegram ke pemilik klinik (chat pribadi).
//
// Dipanggil dari trigger/cron Postgres lewat net.http_post, jadi fungsi ini
// harus di-deploy dengan --no-verify-jwt dan dijaga sendiri oleh header
// x-internal-secret (sama dengan secret TELEGRAM_INTERNAL_SECRET).
//
// Body: { "event": "booking_baru", "text": "isi pesan", "clinic_id": "<uuid>" }
//   atau { "event": "laporan_malam", "texts": ["pesan 1", "pesan 2"], ... }
//   - text dikirim apa adanya (teks biasa, tanpa parse_mode, supaya karakter
//     seperti _ atau * dari nama pasien tidak merusak pesan).
//
// Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_INTERNAL_SECRET
import { createClient } from "npm:@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
const INTERNAL_SECRET = Deno.env.get("TELEGRAM_INTERNAL_SECRET");

// Hanya klinik ini yang boleh memicu notifikasi.
const ALLOWED_CLINIC_ID = "bfdc3fd8-a052-4753-a5b7-229930b3237a";
const MAX_LEN = 4000; // batas Telegram 4096

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Perbandingan waktu-konstan agar secret tidak bisa ditebak lewat timing.
function safeEqual(a: string, b: string) {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  if (!BOT_TOKEN || !CHAT_ID || !INTERNAL_SECRET) {
    return json({ ok: false, error: "Secret Telegram belum lengkap" }, 500);
  }

  const provided = req.headers.get("x-internal-secret") || "";
  if (!safeEqual(provided, INTERNAL_SECRET)) {
    return json({ ok: false, error: "Tidak diizinkan" }, 401);
  }

  // `text` = satu pesan; `texts` = beberapa pesan yang dikirim berurutan
  // (maks. 5), mis. laporan malam 1/2 dan 2/2.
  let payload: { event?: string; text?: string; texts?: string[]; clinic_id?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "Body bukan JSON" }, 400);
  }

  const event = String(payload.event || "umum").slice(0, 60);
  const raw = Array.isArray(payload.texts) ? payload.texts : [payload.text];
  const items = raw
    .map((t) => String(t ?? "").trim())
    .filter((t) => t.length > 0)
    .slice(0, 5);
  if (items.length === 0) return json({ ok: false, error: "text wajib diisi" }, 400);
  if (payload.clinic_id && payload.clinic_id !== ALLOWED_CLINIC_ID) {
    return json({ ok: false, error: "Klinik tidak diizinkan" }, 403);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let allSent = true;
  let firstError: string | null = null;

  // Berurutan (await di dalam loop) supaya pesan 1/2 selalu tiba sebelum 2/2.
  for (const text of items) {
    const message = text.length > MAX_LEN ? text.slice(0, MAX_LEN) + "…" : text;

    let status = "failed";
    let error: string | null = null;
    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: message,
          disable_web_page_preview: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) status = "sent";
      else error = String(data?.description || `HTTP ${res.status}`).slice(0, 300);
    } catch (e) {
      error = String((e as Error)?.message || e).slice(0, 300);
    }

    if (status !== "sent") {
      allSent = false;
      firstError = firstError ?? error;
    }

    // Catat hasil; kegagalan mencatat tidak boleh mengubah respons ke pemanggil.
    try {
      await supabase.from("telegram_logs").insert({
        clinic_id: ALLOWED_CLINIC_ID,
        event,
        message,
        status,
        error,
      });
    } catch (_) { /* abaikan */ }
  }

  return json({ ok: allSent, sent: items.length, error: firstError }, allSent ? 200 : 502);
});
