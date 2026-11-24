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
      .select("id, conversation_id, direction, msg_type").eq("wa_message_id", waMessageId).maybeSingle();
    if (!m || m.direction !== "in") return;
    // Gambar, dokumen, voice note, stiker, dll. dilewati: AI tidak membaca dan tidak membalasnya
    // (hanya teks dan tombol template yang diproses; admin menangani lampiran).
    if (m.msg_type !== "text" && m.msg_type !== "button") return;
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
    // Balasan teks yang menandakan akan datang ("baik", "insyaallah iya", ...) dicatat sebagai hadir.
    if (msg?.type === "text") {
      const { error: textErr } = await (admin as any).rpc("record_reminder_text_reply", {
        p_clinic_id: clinicId,
        p_phone: msg.from ?? null,
        p_text: msg.text?.body ?? "",
      });
      if (textErr) console.error("[wa-watzap-webhook] catat balasan teks gagal", textErr.message);
      return;
    }
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

// Tombol "Kirim Dokumen" pada template surat_keterangan_fisioterapi / resume_medis_fisioterapi (Kaffah).
// Klik membuka jendela 24 jam; database lalu mengirim PDF yang menunggu. Mengembalikan true bila klik
// ini cocok dengan dokumen yang menunggu (asisten AI tidak perlu membalasnya). Kegagalan di sini tidak
// boleh menggagalkan respons webhook.
async function recordDocButton(
  admin: ReturnType<typeof createClient>,
  clinicId: string,
  msg: any,
): Promise<boolean> {
  try {
    if (msg?.type !== "button") return false;
    const label = String(msg.button?.payload || msg.button?.text || "").trim().toLowerCase();
    if (label !== "kirim dokumen") return false;
    const { data, error } = await admin.rpc("clinical_doc_on_button", {
      p_clinic_id: clinicId,
      p_context_id: msg.context?.id ?? null,
      p_phone: msg.from ?? null,
    });
    if (error) {
      console.error("[wa-watzap-webhook] kirim dokumen gagal", error.message);
      return false;
    }
    return !!data;
  } catch (e) {
    console.error("[wa-watzap-webhook] kirim dokumen error", e);
    return false;
  }
}

/**
 * Bablast hanya meneruskan STATUS pesan keluar (tanpa isi), termasuk yang diketik admin dari HP/dashboard.
 * Status "sent"/"delivered" untuk pesan yang bukan kiriman AI dicatat sebagai balasan keluar supaya
 * wa-ai-reply melewati pasien itu (cek "admin_sudah_membalas"). Status "read" diabaikan: bisa menyangkut
 * pesan lama dan keliru menahan AI.
 */
async function recordAdminEcho(admin: any, clinicId: string, d: any) {
  try {
    const wamid = String(d?.wa_message_id ?? d?.message_id ?? "");
    const status = String(d?.status ?? "");
    const to = String(d?.recipient ?? "").replace(/\D/g, "");
    if (!wamid || to.length < 8 || !["sent", "delivered"].includes(status)) return;
    const at = Date.parse(String(d?.timestamp ?? ""));
    if (!Number.isFinite(at) || Math.abs(Date.now() - at) > 120_000) return;
    const known = async () =>
      (await admin.from("wa_inbox_messages").select("id").eq("wa_message_id", wamid).maybeSingle()).data;
    if (await known()) return; // kiriman AI sendiri (sudah tercatat saat dikirim)
    await new Promise((r) => setTimeout(r, 2500)); // beri waktu pencatatan kiriman AI selesai
    if (await known()) return;
    const { data: conv } = await admin.from("wa_inbox_conversations").select("id")
      .eq("clinic_id", clinicId).eq("wa_id", to).maybeSingle();
    if (!conv) return;
    const iso = new Date(at).toISOString();
    const { error } = await admin.from("wa_inbox_messages").insert({
      clinic_id: clinicId,
      conversation_id: conv.id,
      direction: "out",
      msg_type: "text",
      body: "(balasan admin dari HP/dashboard Bablast; isi tidak terbaca)",
      wa_message_id: wamid,
      status: "sent",
      status_at: iso,
      channel: "bablast",
      created_at: iso,
    });
    if (error && error.code !== "23505") console.error("[wa-watzap-webhook] catat balasan admin gagal", error.message);
  } catch (e) {
    console.error("[wa-watzap-webhook] catat balasan admin error", e);
  }
}

/**
 * Event "outgoing_message" Bablast membawa ISI pesan keluar (balasan AI Bablast, balasan manual agen
 * dari dashboard/HP, blast API). Dicatat sebagai balasan keluar dengan isi asli supaya wa-ai-reply
 * melihat riwayat utuh dan melewati pasien yang sudah dibalas admin. Kiriman AI kita sendiri sudah
 * tercatat saat dikirim (wa_message_id sama) dan dilewati. Placeholder dari recordAdminEcho (status
 * sent/delivered yang datang lebih dulu) diganti isi aslinya.
 */
async function recordOutgoing(admin: any, clinicId: string, d: any) {
  try {
    const wamid = String(d?.wa_message_id ?? d?.message_id ?? "");
    const to = String(d?.to_phone ?? d?.to ?? "").replace(/@.*$/, "").replace(/\D/g, "");
    const content = typeof d?.content === "string" ? d.content.trim() : "";
    if (!wamid || to.length < 8 || d?.message_type !== "text" || !content) return;
    if (/@g\.us|@broadcast|status@/.test(String(d?.to ?? ""))) return;
    const lookup = async () =>
      (await admin.from("wa_inbox_messages").select("id, body").eq("wa_message_id", wamid).maybeSingle()).data;
    let known = await lookup();
    if (!known) {
      await new Promise((r) => setTimeout(r, 2500)); // beri waktu pencatatan kiriman AI kita selesai
      known = await lookup();
    }
    if (known) {
      if (String(known.body || "").startsWith("(balasan admin dari HP/dashboard Bablast")) {
        await admin.from("wa_inbox_messages").update({ body: content }).eq("id", known.id);
      }
      return;
    }
    const { data: conv } = await admin.from("wa_inbox_conversations").select("id")
      .eq("clinic_id", clinicId).eq("wa_id", to).maybeSingle();
    if (!conv) return;
    const at = Date.parse(String(d?.timestamp ?? ""));
    const iso = new Date(Number.isFinite(at) ? at : Date.now()).toISOString();
    const { error } = await admin.from("wa_inbox_messages").insert({
      clinic_id: clinicId,
      conversation_id: conv.id,
      direction: "out",
      msg_type: "text",
      body: content,
      wa_message_id: wamid,
      status: "sent",
      status_at: iso,
      channel: "bablast",
      created_at: iso,
    });
    if (error && error.code !== "23505") console.error("[wa-watzap-webhook] catat pesan keluar gagal", error.message);
  } catch (e) {
    console.error("[wa-watzap-webhook] catat pesan keluar error", e);
  }
}

/**
 * Payload Bablast (nomor WA Web):
 *   { event:"incoming_message", sender_code, data:{ message_id, from:"62..@s.whatsapp.net",
 *     from_phone, from_name, message_type, content, media_url, timestamp(ISO), channel:"unofficial" } }
 * Event lain (message_delivered, dst.) diabaikan. Hanya teks; media belum didukung.
 * Mengembalikan { msg, contacts } atau null (diabaikan / tak dikenali).
 */
function fromBablast(p: any): { msg: any; contacts: any[] } | null {
  const d = p?.data;
  if (!d || typeof d !== "object") return null;
  if (d.message_type !== "text" || typeof d.content !== "string" || !d.content) return null;
  if (/@g\.us|@broadcast|status@/.test(String(d.from ?? ""))) return null;
  const from = String(d.from_phone ?? d.from ?? "").replace(/@.*$/, "").replace(/\D/g, "");
  if (from.length < 8) return null;
  const ms = Date.parse(String(d.timestamp ?? ""));
  return {
    msg: {
      id: String(d.message_id ?? `bablast-${from}-${Date.now()}`),
      from,
      type: "text",
      text: { body: d.content },
      timestamp: Number.isFinite(ms) ? String(Math.floor(ms / 1000)) : undefined,
    },
    contacts: d.from_name ? [{ wa_id: from, profile: { name: String(d.from_name) } }] : [],
  };
}

/** Normalkan payload WA Web Watzap ke bentuk pesan Meta (teks saja). Null bila tak dikenali. */
function fromUnofficial(p: any): any | null {
  const d = (p?.data && typeof p.data === "object") ? p.data : p;
  if (!d || typeof d !== "object") return null;
  if (d.fromMe === true || d.from_me === true || d.is_from_me === true) return null;
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const val = d[k] ?? p?.[k];
      if (val !== undefined && val !== null && val !== "") return val;
    }
    return undefined;
  };
  const rawFrom = String(pick("from", "phone", "phone_no", "sender", "chat_id", "remote_jid") ?? "");
  if (/@g\.us|@broadcast|status@/.test(rawFrom)) return null; // grup/status: abaikan
  const from = rawFrom.replace(/@.*$/, "").replace(/\D/g, "");
  const text = pick("message_text", "message", "text", "body", "content");
  if (from.length < 8 || typeof text !== "string" || !text) return null;
  const ts = Number(pick("timestamp", "time"));
  return {
    id: String(pick("message_id", "id", "wamid") ?? `wa-web-${from}-${Date.now()}`),
    from,
    type: "text",
    text: { body: text },
    timestamp: Number.isFinite(ts) && ts > 1e9 ? String(ts > 1e12 ? Math.floor(ts / 1000) : ts) : undefined,
  };
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
    if (!v) {
      // Nomor WA Web: bukan bungkus Meta. Bablast (sender_code) dikenali pasti; bentuk lain
      // hanya tebakan dan sengaja tanpa notifyAi / catat balasan tombol. Payload mentah
      // selalu tersimpan di wa_watzap_raw.
      if (payload?.sender_code !== undefined) {
        // Bablast: incoming_message diproses; outgoing_message dicatat dengan isinya; status pesan keluar menandai balasan admin; sisanya dilewati.
        if (payload.event === "outgoing_message") {
          await recordOutgoing(admin, cfg.clinic_id, payload.data);
        } else if (payload.event !== "incoming_message") {
          await recordAdminEcho(admin, cfg.clinic_id, payload.data);
        } else {
          const b = fromBablast(payload);
          if (b) {
            await handleMessage(admin, cfg.clinic_id, b.contacts, b.msg, undefined, "bablast");
            // Asisten AI membalas lewat Bablast untuk jalur ini (lihat wa-ai-reply).
            const pa = notifyAi(admin, b.msg.id);
            if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(pa);
            else await pa;
          }
        }
      } else {
        const msg = fromUnofficial(payload);
        if (msg) await handleMessage(admin, cfg.clinic_id, [], msg);
        else console.warn("[wa-watzap-webhook] bentuk payload tidak dikenal, lihat wa_watzap_raw");
      }
    }
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
        const docHandled = await recordDocButton(admin, cfg.clinic_id, msg);
        if (msg?.id && !docHandled) {
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
