// Kirim notifikasi Telegram ke pemilik klinik (chat pribadi).
//
// Dipanggil dari trigger/cron Postgres lewat net.http_post, jadi fungsi ini
// harus di-deploy dengan --no-verify-jwt dan dijaga sendiri oleh header
// x-internal-secret (sama dengan secret TELEGRAM_INTERNAL_SECRET).
//
// Body: { "event": "booking_baru", "text": "isi pesan", "clinic_id": "<uuid>" }
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

  let payload: { event?: string; text?: string; clinic_id?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "Body bukan JSON" }, 400);
  }

  const event = String(payload.event || "umum").slice(0, 60);
  const text = String(payload.text || "").trim();
  if (!text) return json({ ok: false, error: "text wajib diisi" }, 400);
  if (payload.clinic_id && payload.clinic_id !== ALLOWED_CLINIC_ID) {
    return json({ ok: false, error: "Klinik tidak diizinkan" }, 403);
  }

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

  // Catat hasil; kegagalan mencatat tidak boleh mengubah respons ke pemanggil.
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await supabase.from("telegram_logs").insert({
      clinic_id: ALLOWED_CLINIC_ID,
      event,
      message,
      status,
      error,
    });
  } catch (_) { /* abaikan */ }

  return json({ ok: status === "sent", error }, status === "sent" ? 200 : 502);
});
