// Webhook Watzap (nomor WABA resmi) → inbox aplikasi.
//
// Watzap membungkus payload Meta apa adanya di data.root_value:
//   { source:"official", event:"incoming_chat", data:{ root_value:{
//       metadata, contacts:[{profile:{name},wa_id}], messages:[...], statuses:[...] } } }
// sehingga pengolahannya memakai kode yang sama dengan webhook Meta langsung.
//
// Autentikasi: Watzap tidak menandatangani request, jadi URL membawa ?token=
// acak per klinik (tabel wa_watzap_config, hanya terbaca service role).
// Deploy dengan verify_jwt = false.
//
// Payload mentah tetap disimpan 7 hari di wa_watzap_raw untuk diagnosa.

import { createClient } from "npm:@supabase/supabase-js@2";
import { handleMessage, handleStatus } from "../_shared/inbox.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

// Beri tahu asisten AI ada pesan pasien baru. Aman bila AI mati: fungsi tujuan langsung
// berhenti. Kegagalan di sini tidak boleh mengganggu penerimaan webhook.
async function notifyAi(admin: any, waMessageId: string) {
  try {
    const { data: m } = await admin.from("wa_inbox_messages")
      .select("id, conversation_id, direction").eq("wa_message_id", waMessageId).maybeSingle();
    if (!m || m.direction !== "in") return;
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/wa-ai-reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ conversation_id: m.conversation_id, message_id: m.id }),
      signal: AbortSignal.timeout(5000),
    });
    await res.text();
  } catch (e) {
    console.error("[wa-watzap-webhook] notifyAi gagal", e);
  }
}

const MAX_BODY = 64 * 1024; // 64 KB
const KEEP_DAYS = 7;

// Tombol Quick Reply pada template reminder terapi (reminder_terapi_konfirmasi).
// Watzap meneruskan klik sebagai message.type = "button" dengan button.payload
// sama dengan teks tombol.
const REPLY_BUTTONS: Record<string, string> = {
  hadir: "hadir",
  reschedule: "reschedule",
  cancel: "cancel",
};

// Mencatat balasan tombol ke follow_up_queue (hanya mencatat; tidak mengubah
// jadwal). Kegagalan di sini tidak boleh menggagalkan respons webhook.
async function recordReminderReply(
  admin: ReturnType<typeof createClient>,
  clinicId: string,
  msg: any,
) {
  try {
    if (msg?.type !== "button") return;
    const label = String(msg.button?.payload || msg.button?.text || "").trim().toLowerCase();
    const reply = REPLY_BUTTONS[label];
    if (!reply) return;
    const { error } = await admin.rpc("record_reminder_reply", {
      p_clinic_id: clinicId,
      p_context_id: msg.context?.id ?? null,
      p_phone: msg.from ?? null,
      p_reply: reply,
    });
    if (error) console.error("[wa-watzap-webhook] catat balasan tombol gagal", error.message);
  } catch (e) {
    console.error("[wa-watzap-webhook] catat balasan tombol error", e);
  }
}

// Balasan teks singkat yang menandakan pasien akan hadir ("insyaallah", "iya",
// "baik", "siap", "oke", ...). Ditolak bila ada kata penolakan / ubah jadwal,
// atau pesan terlalu panjang (kemungkinan pertanyaan lain).
const NEGATIVE = /\b(tidak|nggak|ngga|gak|ga|enggak|engga|belum|batal|cancel|reschedule|ubah|ganti|mundur|maju|geser|izin|nanti|telat|terlambat|berhalangan|sakit|ada acara)\b/;
const AFFIRMATIVE = /\b(insya\s?allah|insyaallah|insha\s?allah|inshaallah|in\s?syaa?\s?allah|iya|iyaa+|iy|ya|yaa|yup|baik|baiklah|oke|ok|okey|okay|siap|sip|sippp?|noted|note|hadir|datang|terima\s?kasih|makasih|terimakasih|thanks|thank\s?you|boleh|sudah|udah|ditunggu|aamiin|amin)\b/;

function isAttendanceText(msg: any): boolean {
  if (msg?.type !== "text") return false;
  const t = String(msg.text?.body || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (!t || t.length > 60) return false;
  if (NEGATIVE.test(t)) return false;
  return AFFIRMATIVE.test(t);
}

async function recordTextAttendance(
  admin: ReturnType<typeof createClient>,
  clinicId: string,
  msg: any,
) {
  try {
    if (!isAttendanceText(msg)) return;
    const { error } = await admin.rpc("record_reminder_text_reply", {
      p_clinic_id: clinicId,
      p_phone: msg.from ?? null,
    });
    if (error) console.error("[wa-watzap-webhook] catat balasan teks gagal", error.message);
  } catch (e) {
    console.error("[wa-watzap-webhook] catat balasan teks error", e);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const token = new URL(req.url).searchParams.get("token") || "";
  if (token.length < 16) return new Response("Forbidden", { status: 403 });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: cfg } = await admin.from("wa_watzap_config").select("clinic_id")
    .eq("token", token).maybeSingle();
  if (!cfg) return new Response("Forbidden", { status: 403 });

  const raw = (await req.text()).slice(0, MAX_BODY);

  const { error } = await admin.from("wa_watzap_raw").insert({
    clinic_id: cfg.clinic_id,
    content_type: req.headers.get("content-type"),
    body: raw,
  });
  if (error) console.error("[wa-watzap-webhook] simpan raw gagal", error.message);

  // Parsing tidak boleh menggagalkan respons: Watzap cukup tahu kita menerima.
  // Bentuk yang tidak dikenal tetap aman tersimpan di wa_watzap_raw.
  try {
    const payload = JSON.parse(raw);
    const v = payload?.data?.root_value;
    if (v && typeof v === "object") {
      // Watzap sudah mengunduh media dan menaruhnya di CDN-nya (media_info.cdn_url);
      // tautan Meta di message_raw butuh token yang hanya dipegang Watzap.
      const mi = payload.data?.media_info;
      const media = mi?.cdn_url
        ? { url: String(mi.cdn_url), mime: mi.mime_type, filename: mi.filename }
        : undefined;
      for (const msg of v.messages || []) {
        await handleMessage(admin, cfg.clinic_id, v.contacts || [], msg, media);
        await recordReminderReply(admin, cfg.clinic_id, msg);
        await recordTextAttendance(admin, cfg.clinic_id, msg);
        if (msg?.id) {
          const p = notifyAi(admin, String(msg.id));
          if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(p);
          else await p;
        }
      }
      for (const st of v.statuses || []) {
        await handleStatus(admin, st);
      }
    }
  } catch (e) {
    console.error("[wa-watzap-webhook] parse gagal", e);
  }

  await admin.from("wa_watzap_raw").delete()
    .lt("received_at", new Date(Date.now() - KEEP_DAYS * 864e5).toISOString());

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
