// Penangkap webhook Watzap (tahap 1): hanya menyimpan payload mentah ke
// wa_watzap_raw. Parser pesan masuk ditulis setelah bentuk data aslinya terlihat.
//
// Autentikasi: Watzap tidak menandatangani request, jadi URL membawa ?token=
// acak per klinik (tabel wa_watzap_config, hanya terbaca service role).
// Deploy dengan verify_jwt = false.

import { createClient } from "npm:@supabase/supabase-js@2";

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
  if (error) {
    console.error("[wa-watzap-webhook]", error.message);
    return new Response("Error", { status: 500 });
  }

  // Bersihkan data lama supaya tabel tidak menumpuk.
  await admin.from("wa_watzap_raw").delete()
    .lt("received_at", new Date(Date.now() - KEEP_DAYS * 864e5).toISOString());

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
