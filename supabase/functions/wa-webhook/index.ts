// Webhook WhatsApp Cloud API (Meta).
//
//  GET  → verifikasi webhook (hub.challenge) saat didaftarkan di Meta.
//  POST → pesan masuk + status pesan keluar. Tanda tangan X-Hub-Signature-256
//         WAJIB valid (HMAC-SHA256 isi request dengan META_APP_SECRET), kalau
//         tidak, request ditolak — tanpa ini siapa pun bisa menyuntik "pesan
//         pasien" palsu ke inbox.
//
// Deploy dengan --no-verify-jwt (Meta tidak mengirim JWT Supabase):
//   supabase functions deploy wa-webhook --no-verify-jwt

import {
  adminClient,
  ensureConversation,
  graph,
  loadAccount,
  normalizePhone,
} from "../_shared/wa.ts";
import { describe, handleMessage, handleStatus } from "../_shared/inbox.ts";

async function validSignature(raw: string, header: string | null) {
  const secret = Deno.env.get("META_APP_SECRET");
  if (!secret || !header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)),
  );
  const expected = Array.from(sig).map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const given = header.slice(7);
  if (given.length !== expected.length) return false;
  let diff = 0; // perbandingan waktu-konstan
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  }
  return diff === 0;
}

async function handleTemplateUpdate(
  admin: ReturnType<typeof adminClient>,
  wabaId: string,
  v: any,
) {
  const { data: acc } = await admin
    .from("wa_meta_accounts")
    .select("clinic_id")
    .eq("waba_id", wabaId)
    .maybeSingle();
  if (!acc) return;
  await admin.from("wa_meta_templates").update({
    status: String(v.event || "").toUpperCase(),
    rejected_reason: v.reason && v.reason !== "NONE" ? v.reason : null,
    synced_at: new Date().toISOString(),
  }).eq("clinic_id", acc.clinic_id)
    .eq("name", v.message_template_name)
    .eq("language", v.message_template_language);
}


// ───────────── Coexistence (aplikasi WhatsApp Business + Cloud API) ─────────────

const HISTORY_STATUS: Record<string, string> = {
  sent: "sent",
  delivered: "delivered",
  read: "read",
  failed: "failed",
};

/** Pesan yang dibalas dari aplikasi WhatsApp Business di HP (smb_message_echoes). */
async function handleEcho(
  admin: ReturnType<typeof adminClient>,
  clinicId: string,
  msg: any,
) {
  // Edit/hapus dari aplikasi tidak punya isi pesan baru yang bisa disimpan.
  if (msg.type === "edit" || msg.type === "revoke") return;
  const waId = String(msg.to || "");
  if (!waId) return;
  const conv = await ensureConversation(admin, clinicId, waId);
  if (!conv) return;

  const { body, mediaId, mime } = describe(msg);
  const ts = msg.timestamp
    ? new Date(Number(msg.timestamp) * 1000).toISOString()
    : new Date().toISOString();

  const { error } = await admin.from("wa_messages").insert({
    clinic_id: clinicId,
    conversation_id: conv.id,
    direction: "out",
    wa_message_id: msg.id,
    msg_type: msg.type,
    body,
    media_id: mediaId ?? null,
    media_mime: mime ?? null,
    status: "sent",
    created_at: ts,
    status_at: ts,
  });
  if (error) {
    if (error.code === "23505") return; // sudah ada (mis. dikirim lewat API)
    throw error;
  }
  await admin.from("wa_conversations").update({
    last_message_at: ts,
    last_preview: body.slice(0, 120),
  }).eq("id", conv.id);
}

/** Riwayat chat (sinkronisasi sekali jalan saat onboarding, hingga 180 hari). */
async function handleHistory(
  admin: ReturnType<typeof adminClient>,
  clinicId: string,
  chunk: any,
) {
  for (const thread of chunk.threads || []) {
    const waId = String(thread.id || "");
    if (!waId) continue;
    const msgs = (thread.messages || []).filter((m: any) => m.id && m.type !== "edit" && m.type !== "revoke");
    if (!msgs.length) continue;
    const conv = await ensureConversation(admin, clinicId, waId);
    if (!conv) continue;

    const rows = msgs.map((m: any) => {
      const inbound = String(m.from) === waId;
      const { body, mediaId, mime } = describe(m);
      const ts = m.timestamp
        ? new Date(Number(m.timestamp) * 1000).toISOString()
        : new Date().toISOString();
      return {
        row: {
          clinic_id: clinicId,
          conversation_id: conv.id,
          direction: inbound ? "in" : "out",
          wa_message_id: m.id,
          msg_type: m.type,
          body,
          media_id: mediaId ?? null,
          media_mime: mime ?? null,
          status: inbound ? "received" : (HISTORY_STATUS[m.history_context?.status] ?? "sent"),
          created_at: ts,
        },
        inbound,
        ts,
        body,
      };
    });

    // ignoreDuplicates: webhook history yang dikirim ulang tidak menggandakan pesan.
    const { error } = await admin.from("wa_messages").upsert(
      rows.map((r: any) => r.row),
      { onConflict: "wa_message_id", ignoreDuplicates: true },
    );
    if (error) throw error;

    // Perbarui ringkasan percakapan hanya bila riwayat ini lebih baru dari yang tersimpan.
    const latest = rows.reduce((a: any, b: any) => (a.ts > b.ts ? a : b));
    const lastIn = rows.filter((r: any) => r.inbound).reduce(
      (a: any, b: any) => (!a || b.ts > a.ts ? b : a),
      null,
    );
    const patch: Record<string, unknown> = {};
    if (!conv.last_message_at || latest.ts > conv.last_message_at) {
      patch.last_message_at = latest.ts;
      patch.last_preview = latest.body.slice(0, 120);
    }
    if (lastIn && (!conv.last_inbound_at || lastIn.ts > conv.last_inbound_at)) {
      patch.last_inbound_at = lastIn.ts;
    }
    if (Object.keys(patch).length) {
      await admin.from("wa_conversations").update(patch).eq("id", conv.id);
    }
  }
}

/** Nama kontak dari buku kontak aplikasi; hanya mengisi percakapan yang sudah ada. */
async function handleContactSync(
  admin: ReturnType<typeof adminClient>,
  clinicId: string,
  item: any,
) {
  if (item.type !== "contact" || item.action === "remove") return;
  const waId = normalizePhone(item.contact?.phone_number || "");
  const name = item.contact?.full_name || item.contact?.first_name;
  if (!waId || !name) return;
  await admin.from("wa_conversations").update({ contact_name: name })
    .eq("clinic_id", clinicId).eq("wa_id", waId).is("contact_name", null);
}

Deno.serve(async (req) => {
  if (req.method === "GET") {
    const url = new URL(req.url);
    const ok = url.searchParams.get("hub.mode") === "subscribe" &&
      url.searchParams.get("hub.verify_token") ===
        Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") &&
      !!Deno.env.get("META_WEBHOOK_VERIFY_TOKEN");
    return ok
      ? new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 })
      : new Response("Forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get("x-hub-signature-256")))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const admin = adminClient();
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  try {
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const v = change.value || {};
        if (change.field === "message_template_status_update") {
          await handleTemplateUpdate(admin, entry.id, v);
          continue;
        }
        const COEX = ["smb_message_echoes", "history", "smb_app_state_sync"];
        if (change.field !== "messages" && !COEX.includes(change.field)) continue;

        // Event coexistence tidak selalu membawa phone_number_id; cadangannya
        // WABA ID dari entry.id.
        const phoneNumberId = v.metadata?.phone_number_id;
        const q = admin.from("wa_meta_accounts").select("clinic_id");
        const { data: acc } = await (phoneNumberId
          ? q.eq("phone_number_id", phoneNumberId)
          : q.eq("waba_id", entry.id)).maybeSingle();
        if (!acc) {
          console.warn("[wa-webhook] akun tidak dikenal", phoneNumberId ?? entry.id);
          continue;
        }

        if (change.field === "smb_message_echoes") {
          for (const m of v.message_echoes || []) await handleEcho(admin, acc.clinic_id, m);
          continue;
        }
        if (change.field === "history") {
          for (const chunk of v.history || []) {
            if (chunk.errors?.length) {
              console.warn("[wa-webhook] riwayat tidak dibagikan", JSON.stringify(chunk.errors));
              continue;
            }
            await handleHistory(admin, acc.clinic_id, chunk);
          }
          continue;
        }
        if (change.field === "smb_app_state_sync") {
          for (const item of v.state_sync || []) await handleContactSync(admin, acc.clinic_id, item);
          continue;
        }

        for (const msg of v.messages || []) {
          await handleMessage(admin, acc.clinic_id, v.contacts || [], msg);
        }
        for (const st of v.statuses || []) {
          await handleStatus(admin, st);
        }
      }
    }
  } catch (e) {
    // 500 → Meta mengulang pengiriman; insert idempoten jadi aman diulang.
    console.error("[wa-webhook] gagal memproses", e);
    return new Response("Error", { status: 500 });
  }
  return new Response("OK", { status: 200 });
});
