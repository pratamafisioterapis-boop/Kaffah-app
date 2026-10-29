// Pengolah pesan masuk + status yang dipakai bersama oleh wa-webhook (Meta langsung)
// dan wa-watzap-webhook (Watzap). Keduanya menerima bentuk data Meta yang sama:
// { contacts: [...], messages: [...], statuses: [...] }.

import {
  adminClient,
  ensureConversation,
  graph,
  loadAccount,
} from "./wa.ts";

export const RANK: Record<string, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

export function describe(msg: any): { body: string; mediaId?: string; mime?: string } {
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
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

/** Media yang sudah diunduh pihak ketiga (mis. CDN Watzap), tanpa token Meta. */
export type ExternalMedia = { url: string; mime?: string; filename?: string };

// Hanya CDN Watzap yang boleh diunduh dari payload webhook: tanpa batas ini,
// pemegang token webhook bisa menyuruh server mengambil URL internal (SSRF).
const MEDIA_HOSTS = [".b-cdn.net", ".watzap.id"];
const MAX_MEDIA_BYTES = 16 * 1024 * 1024;

async function storeExternalMedia(
  admin: ReturnType<typeof adminClient>,
  clinicId: string,
  mediaId: string,
  media: ExternalMedia,
): Promise<{ path: string; mime: string } | null> {
  try {
    const u = new URL(media.url);
    if (u.protocol !== "https:" || !MEDIA_HOSTS.some((h) => u.hostname.endsWith(h))) {
      console.warn("[inbox] host media tidak diizinkan", u.hostname);
      return null;
    }
    const res = await fetch(u, { redirect: "error" });
    if (!res.ok) return null;
    if (Number(res.headers.get("content-length") || 0) > MAX_MEDIA_BYTES) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > MAX_MEDIA_BYTES) return null;

    // Content-Type dari CDN bisa generik (voice note = octet-stream); pakai mime dari payload.
    const mime = media.mime || res.headers.get("content-type") || "application/octet-stream";
    const fileExt = media.filename?.match(/\.([A-Za-z0-9]{1,8})$/)?.[1]?.toLowerCase();
    const ext = EXT[String(mime).split(";")[0].trim()] || fileExt || "bin";
    const path = `${clinicId}/${mediaId}.${ext}`;
    const { error } = await admin.storage.from("wa-media").upload(path, bytes, {
      contentType: String(mime).split(";")[0].trim(),
      upsert: true,
    });
    return error ? null : { path, mime };
  } catch (e) {
    console.error("[inbox] media eksternal gagal diunduh", e);
    return null;
  }
}

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

export async function handleMessage(
  admin: ReturnType<typeof adminClient>,
  clinicId: string,
  contacts: any[],
  msg: any,
  externalMedia?: ExternalMedia,
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
  if (mediaId && externalMedia?.url) {
    const stored = await storeExternalMedia(admin, clinicId, mediaId, externalMedia);
    if (stored) {
      mediaPath = stored.path;
      mediaMime = stored.mime;
    }
  } else if (mediaId) {
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

export async function handleStatus(
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

