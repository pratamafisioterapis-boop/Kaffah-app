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
} from "../_shared/wa.ts";

const RANK: Record<string, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

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

function describe(msg: any): { body: string; mediaId?: string; mime?: string } {
  switch (msg.type) {
    case "text":
      return { body: msg.text?.body ?? "" };
    case "image":
    case "video":
    case "audio":
    case "document":
    case "sticker": {
      const m = msg[msg.type] || {};
      const label = msg.type === "audio"
        ? (m.voice ? "🎤 Pesan suara" : "🎵 Audio")
        : msg.type === "image"
        ? "🖼️ Gambar"
        : msg.type === "video"
        ? "🎬 Video"
        : msg.type === "sticker"
        ? "Stiker"
        : `📄 ${m.filename || "Dokumen"}`;
      return {
        body: m.caption ? `${label}\n${m.caption}` : label,
        mediaId: m.id,
        mime: m.mime_type,
      };
    }
    case "location": {
      const l = msg.location || {};
      return {
        body: `📍 ${l.name || "Lokasi"} (${l.latitude}, ${l.longitude})${
          l.address ? `\n${l.address}` : ""
        }`,
      };
    }
    case "button":
      return { body: msg.button?.text ?? "" };
    case "interactive": {
      const i = msg.interactive || {};
      return { body: i.button_reply?.title || i.list_reply?.title || "" };
    }
    case "reaction":
      return { body: `Reaksi ${msg.reaction?.emoji ?? ""}` };
    case "contacts":
      return { body: "👤 Kontak dibagikan" };
    default:
      return { body: `[pesan ${msg.type} tidak didukung]` };
  }
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "application/pdf": "pdf",
};

async function storeMedia(
  admin: ReturnType<typeof adminClient>,
  clinicId: string,
  mediaId: string,
  token: string,
): Promise<{ path: string; mime: string } | null> {
  try {
    const meta = await graph(`/${mediaId}`, token);
    const res = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const mime = meta.mime_type || res.headers.get("content-type") ||
      "application/octet-stream";
    const ext = EXT[String(mime).split(";")[0]] || "bin";
    const path = `${clinicId}/${mediaId}.${ext}`;
    const { error } = await admin.storage.from("wa-media").upload(
      path,
      new Uint8Array(await res.arrayBuffer()),
      { contentType: mime, upsert: true },
    );
    return error ? null : { path, mime };
  } catch (e) {
    console.error("[wa-webhook] media gagal diunduh", e);
    return null;
  }
}

async function handleMessage(
  admin: ReturnType<typeof adminClient>,
  clinicId: string,
  contacts: any[],
  msg: any,
) {
  const waId = msg.from as string;
  const profile = (contacts || []).find((c) => c.wa_id === waId)?.profile?.name;
  const conv = await ensureConversation(admin, clinicId, waId, profile);
  if (!conv) return;

  const { body, mediaId, mime } = describe(msg);
  const ts = msg.timestamp
    ? new Date(Number(msg.timestamp) * 1000).toISOString()
    : new Date().toISOString();

  let mediaPath: string | null = null;
  let mediaMime: string | null = mime ?? null;
  if (mediaId) {
    const acc = await loadAccount(admin, clinicId);
    if (acc) {
      const stored = await storeMedia(admin, clinicId, mediaId, acc.token);
      if (stored) {
        mediaPath = stored.path;
        mediaMime = stored.mime;
      }
    }
  }

  // wa_message_id UNIQUE → Meta yang mengirim ulang webhook tidak menggandakan pesan.
  const { error } = await admin.from("wa_messages").insert({
    clinic_id: clinicId,
    conversation_id: conv.id,
    direction: "in",
    wa_message_id: msg.id,
    msg_type: msg.type,
    body,
    media_id: mediaId ?? null,
    media_path: mediaPath,
    media_mime: mediaMime,
    status: "received",
    created_at: ts,
  });
  if (error) {
    if (error.code === "23505") return; // duplikat
    throw error;
  }

  // Reaksi bukan percakapan baru: jangan menaikkan unread / jendela 24 jam.
  if (msg.type === "reaction") return;

  await admin.from("wa_conversations").update({
    last_message_at: ts,
    last_inbound_at: ts,
    last_preview: body.slice(0, 120),
    unread_count: (conv.unread_count ?? 0) + 1,
  }).eq("id", conv.id);
}

async function handleStatus(
  admin: ReturnType<typeof adminClient>,
  st: any,
) {
  const next = st.status as string; // sent | delivered | read | failed
  const err = st.errors?.[0];
  const at = st.timestamp
    ? new Date(Number(st.timestamp) * 1000).toISOString()
    : new Date().toISOString();

  const { data: m } = await admin
    .from("wa_messages")
    .select("id, status, queue_id")
    .eq("wa_message_id", st.id)
    .maybeSingle();

  if (m) {
    const forward = next === "failed" ||
      (RANK[next] ?? -1) > (RANK[m.status] ?? -1);
    if (forward) {
      await admin.from("wa_messages").update({
        status: next,
        status_at: at,
        error_code: err ? String(err.code) : null,
        error_message: err ? (err.error_data?.details || err.title || err.message) : null,
      }).eq("id", m.id);
    }
    if (m.queue_id && next === "failed") {
      await admin.from("follow_up_queue").update({
        status: "failed",
        failed_reason: err ? `${err.code}: ${err.title || err.message}` : "failed",
        updated_at: new Date().toISOString(),
      }).eq("id", m.queue_id);
    }
  }

  const { data: r } = await admin
    .from("wa_broadcast_recipients")
    .select("id, status")
    .eq("wa_message_id", st.id)
    .maybeSingle();
  if (r) {
    const forward = next === "failed" ||
      (RANK[next] ?? -1) > (RANK[r.status] ?? -1);
    if (forward) {
      await admin.from("wa_broadcast_recipients").update({
        status: next,
        error_message: err ? (err.error_data?.details || err.title || err.message) : null,
        updated_at: new Date().toISOString(),
      }).eq("id", r.id);
    }
  }
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
        if (change.field !== "messages") continue;

        const phoneNumberId = v.metadata?.phone_number_id;
        const { data: acc } = await admin
          .from("wa_meta_accounts")
          .select("clinic_id")
          .eq("phone_number_id", phoneNumberId)
          .maybeSingle();
        if (!acc) {
          console.warn("[wa-webhook] phone_number_id tidak dikenal", phoneNumberId);
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
