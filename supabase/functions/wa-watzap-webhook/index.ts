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

const MAX_BODY = 64 * 1024; // 64 KB
const KEEP_DAYS = 7;

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
