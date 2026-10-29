// Balas pesan pasien dari inbox aplikasi lewat Watzap (waba_send_message).
//
// POST { to, body } dengan JWT staf klinik. api_key/number_key Watzap dibaca di
// sini (service role) dan tidak pernah dikirim ke browser.
// Teks bebas hanya boleh dalam 24 jam sejak pesan terakhir pasien (aturan Meta).

import {
  adminClient,
  CORS,
  ensureConversation,
  getCaller,
  json,
  normalizePhone,
  windowOpen,
} from "../_shared/wa.ts";

const STAFF = ["owner", "admin", "super_admin"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = adminClient();
  try {
    const caller = await getCaller(req, admin);
    if (!caller) return json({ success: false, error: "Tidak terautentikasi" }, 401);
    if (!STAFF.includes(caller.role) || !caller.clinicId) {
      return json({ success: false, error: "Tidak punya akses" }, 403);
    }

    const p = await req.json().catch(() => ({}));
    const body = String(p.body || "").trim();
    const to = normalizePhone(String(p.to || ""));
    if (!body) return json({ success: false, error: "Isi pesan kosong" }, 400);
    if (body.length > 4096) return json({ success: false, error: "Pesan terlalu panjang (maks 4096 karakter)" }, 400);
    if (to.length < 8) return json({ success: false, error: "Nomor tujuan tidak valid" }, 400);

    const { data: wa } = await admin.from("wa_settings")
      .select("api_key, number_key, enabled, inbox_enabled")
      .eq("clinic_id", caller.clinicId).maybeSingle();
    if (!wa?.inbox_enabled || !wa.enabled || !wa.api_key || !wa.number_key || wa.number_key === "ALL") {
      return json({ success: false, error: "Inbox WhatsApp belum diaktifkan untuk klinik ini." }, 412);
    }

    const conv = await ensureConversation(admin, caller.clinicId, to);
    if (!windowOpen(conv.last_inbound_at)) {
      return json({
        success: false,
        error: "Di luar jendela 24 jam sejak pesan terakhir pasien. WhatsApp hanya mengizinkan template yang disetujui Meta.",
      }, 409);
    }

    const res = await fetch("https://api.watzap.id/v1/waba_send_message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: wa.api_key,
        number_key: wa.number_key,
        phone_no: to,
        message: body,
      }),
    });
    const text = await res.text();
    let out: any = {};
    try { out = JSON.parse(text); } catch { /* biarkan kosong */ }

    // Watzap membalas HTTP 200 juga untuk penolakan; yang menentukan adalah ack.
    const ok = res.ok && out?.ack === "successfully";
    const now = new Date().toISOString();
    const row = {
      clinic_id: caller.clinicId,
      conversation_id: conv.id,
      direction: "out",
      msg_type: "text",
      body,
      sent_by: caller.userId,
    };

    if (!ok) {
      const reason = out?.message || `HTTP ${res.status}`;
      await admin.from("wa_messages").insert({
        ...row,
        status: "failed",
        error_code: String(out?.status ?? res.status),
        error_message: String(reason).slice(0, 500),
        status_at: now,
      });
      return json({ success: false, error: `Watzap menolak: ${reason}` }, 502);
    }

    await admin.from("wa_messages").insert({
      ...row,
      wa_message_id: out?.wamid ?? null,
      status: "sent",
      status_at: now,
    });
    await admin.from("wa_conversations").update({
      last_message_at: now,
      last_preview: body.slice(0, 120),
    }).eq("id", conv.id);

    return json({ success: true, data: { wa_message_id: out?.wamid ?? null, conversation_id: conv.id } });
  } catch (e) {
    console.error("[wa-watzap-send]", e);
    return json({ success: false, error: "Terjadi kesalahan di server" }, 500);
  }
});
