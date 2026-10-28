// WhatsApp Cloud API (Meta) — aksi yang dipanggil dari aplikasi oleh staf klinik.
//
// POST { action, ...params } dengan JWT user. Token Meta hanya dibaca di sini
// (service role) dan tidak pernah dikembalikan ke browser.
//
// Aksi: account_save | account_status | account_toggle |
//       send_text | send_template | mark_read |
//       templates_sync | template_create | template_delete |
//       broadcast_create | broadcast_process | broadcast_cancel

import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  adminClient,
  Caller,
  CORS,
  ensureConversation,
  getCaller,
  graph,
  json,
  loadAccount,
  MetaAccount,
  MetaError,
  normalizePhone,
  windowOpen,
} from "../_shared/wa.ts";

const STAFF = ["owner", "admin", "super_admin"];
const OWNERS = ["owner", "super_admin"];
const TEMPLATE_NAME = /^[a-z0-9_]{1,512}$/;

class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function render(components: any[] | null, params: string[]): string {
  const body = (components || []).find((c) => c.type === "BODY")?.text || "";
  return body.replace(/\{\{(\d+)\}\}/g, (_: string, n: string) => params[Number(n) - 1] ?? "");
}

type Outbound =
  | { kind: "text"; body: string }
  | { kind: "template"; name: string; language: string; params: string[] };

async function sendOutbound(
  admin: SupabaseClient,
  acc: MetaAccount,
  caller: Caller | null,
  to: string,
  out: Outbound,
  extra: { queueId?: string; broadcastId?: string } = {},
) {
  const waId = normalizePhone(to);
  if (waId.length < 8) throw new HttpError("Nomor tujuan tidak valid");
  const conv = await ensureConversation(admin, acc.clinic_id, waId);

  let payload: Record<string, unknown>;
  let shownBody: string;
  let templateName: string | null = null;

  if (out.kind === "text") {
    if (!windowOpen(conv.last_inbound_at)) {
      throw new HttpError(
        "Di luar jendela 24 jam sejak pesan terakhir pasien. Gunakan template yang sudah disetujui Meta.",
        409,
      );
    }
    payload = {
      messaging_product: "whatsapp",
      to: waId,
      type: "text",
      text: { body: out.body, preview_url: false },
    };
    shownBody = out.body;
  } else {
    const { data: tpl } = await admin
      .from("wa_meta_templates")
      .select("status, components")
      .eq("clinic_id", acc.clinic_id)
      .eq("name", out.name)
      .eq("language", out.language)
      .maybeSingle();
    if (tpl && tpl.status !== "APPROVED") {
      throw new HttpError(`Template "${out.name}" belum disetujui Meta (status ${tpl.status}).`, 409);
    }
    payload = {
      messaging_product: "whatsapp",
      to: waId,
      type: "template",
      template: {
        name: out.name,
        language: { code: out.language },
        ...(out.params.length
          ? {
            components: [{
              type: "body",
              parameters: out.params.map((t) => ({ type: "text", text: String(t) })),
            }],
          }
          : {}),
      },
    };
    shownBody = tpl ? render(tpl.components, out.params) : `[template ${out.name}]`;
    templateName = out.name;
  }

  const base = {
    clinic_id: acc.clinic_id,
    conversation_id: conv.id,
    direction: "out",
    msg_type: out.kind === "text" ? "text" : "template",
    body: shownBody,
    template_name: templateName,
    queue_id: extra.queueId ?? null,
    broadcast_id: extra.broadcastId ?? null,
    sent_by: caller?.userId ?? null,
  };

  try {
    const res = await graph(`/${acc.phone_number_id}/messages`, acc.token, {
      method: "POST",
      body: payload,
    });
    const waMessageId = res?.messages?.[0]?.id as string;
    const now = new Date().toISOString();
    await admin.from("wa_messages").insert({
      ...base,
      wa_message_id: waMessageId,
      status: "sent",
      status_at: now,
    });
    await admin.from("wa_conversations").update({
      last_message_at: now,
      last_preview: shownBody.slice(0, 120),
    }).eq("id", conv.id);
    if (extra.queueId) {
      await admin.from("follow_up_queue").update({
        status: "sent",
        sent_at: now,
        failed_reason: null,
        updated_at: now,
      }).eq("id", extra.queueId);
    }
    return { wa_message_id: waMessageId, conversation_id: conv.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = e instanceof MetaError ? e.code : "";
    await admin.from("wa_messages").insert({
      ...base,
      status: "failed",
      error_code: code,
      error_message: msg,
      status_at: new Date().toISOString(),
    });
    if (extra.queueId) {
      await admin.from("follow_up_queue").update({
        status: "failed",
        failed_reason: `${code}: ${msg}`.slice(0, 500),
        updated_at: new Date().toISOString(),
      }).eq("id", extra.queueId);
    }
    throw new HttpError(msg, 502);
  }
}

async function requireAccount(admin: SupabaseClient, clinicId: string) {
  const acc = await loadAccount(admin, clinicId);
  if (!acc) throw new HttpError("WhatsApp Cloud API belum dihubungkan untuk klinik ini.", 412);
  if (!acc.enabled) throw new HttpError("WhatsApp Cloud API dinonaktifkan.", 412);
  return acc;
}

/** Pastikan baris antrean memang milik klinik pemanggil sebelum diubah. */
async function assertQueueInClinic(admin: SupabaseClient, queueId: string, clinicId: string) {
  const { data } = await admin.from("follow_up_queue").select("clinic_id").eq("id", queueId).maybeSingle();
  if (!data || data.clinic_id !== clinicId) throw new HttpError("Item antrean tidak ditemukan", 404);
}

async function checkAccount(phoneNumberId: string, wabaId: string, token: string) {
  const info = await graph(
    `/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,name_status`,
    token,
  );
  // Pastikan phone number memang milik WABA tersebut.
  const list = await graph(`/${wabaId}/phone_numbers?fields=id&limit=50`, token);
  if (!(list.data || []).some((p: any) => p.id === phoneNumberId)) {
    throw new HttpError("Phone Number ID bukan bagian dari WhatsApp Business Account tersebut.");
  }
  return info;
}

const handlers: Record<
  string,
  (a: { admin: SupabaseClient; caller: Caller; clinicId: string; p: any }) => Promise<unknown>
> = {
  // ───────────── Akun ─────────────
  async account_save({ admin, caller, clinicId, p }) {
    if (!OWNERS.includes(caller.role)) throw new HttpError("Hanya owner yang boleh mengubah koneksi.", 403);
    const wabaId = String(p.waba_id || "").trim();
    const phoneNumberId = String(p.phone_number_id || "").trim();
    let token = String(p.access_token || "").trim();
    if (!/^\d+$/.test(wabaId) || !/^\d+$/.test(phoneNumberId)) {
      throw new HttpError("WABA ID dan Phone Number ID harus berupa angka.");
    }
    if (!token) {
      const existing = await loadAccount(admin, clinicId);
      if (!existing) throw new HttpError("Access token wajib diisi.");
      token = existing.token;
    }
    let info;
    try {
      info = await checkAccount(phoneNumberId, wabaId, token);
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(`Meta menolak kredensial: ${(e as Error).message}`);
    }
    // Daftarkan app ke WABA agar webhook pesan masuk dikirim ke kita.
    let subscribed = true;
    try {
      await graph(`/${wabaId}/subscribed_apps`, token, { method: "POST", body: {} });
    } catch {
      subscribed = false;
    }
    const now = new Date().toISOString();
    const { error: accErr } = await admin.from("wa_meta_accounts").upsert({
      clinic_id: clinicId,
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      display_phone: info.display_phone_number,
      verified_name: info.verified_name,
      quality_rating: info.quality_rating,
      name_status: info.name_status,
      enabled: true,
      connected_at: now,
      last_checked_at: now,
      updated_at: now,
    }, { onConflict: "clinic_id" });
    if (accErr) {
      if (accErr.code === "23505") throw new HttpError("Nomor ini sudah dipakai klinik lain.", 409);
      throw accErr;
    }
    await admin.from("wa_meta_credentials").upsert({
      clinic_id: clinicId,
      access_token: token,
      updated_at: now,
    }, { onConflict: "clinic_id" });
    return { connected: true, subscribed, display_phone: info.display_phone_number, verified_name: info.verified_name };
  },

  async account_status({ admin, clinicId }) {
    const acc = await loadAccount(admin, clinicId);
    if (!acc) return { connected: false };
    try {
      const info = await checkAccount(acc.phone_number_id, acc.waba_id, acc.token);
      await admin.from("wa_meta_accounts").update({
        display_phone: info.display_phone_number,
        verified_name: info.verified_name,
        quality_rating: info.quality_rating,
        name_status: info.name_status,
        last_checked_at: new Date().toISOString(),
      }).eq("clinic_id", clinicId);
      return { connected: true, ...info };
    } catch (e) {
      return { connected: false, error: (e as Error).message };
    }
  },

  async account_toggle({ admin, caller, clinicId, p }) {
    if (!OWNERS.includes(caller.role)) throw new HttpError("Hanya owner yang boleh mengubah koneksi.", 403);
    await admin.from("wa_meta_accounts").update({ enabled: !!p.enabled, updated_at: new Date().toISOString() })
      .eq("clinic_id", clinicId);
    return { enabled: !!p.enabled };
  },

  // ───────────── Kirim ─────────────
  async send_text({ admin, caller, clinicId, p }) {
    const body = String(p.body || "").trim();
    if (!body) throw new HttpError("Isi pesan kosong");
    if (body.length > 4096) throw new HttpError("Pesan terlalu panjang (maks 4096 karakter)");
    if (p.queue_id) await assertQueueInClinic(admin, p.queue_id, clinicId);
    const acc = await requireAccount(admin, clinicId);
    return await sendOutbound(admin, acc, caller, p.to, { kind: "text", body }, { queueId: p.queue_id });
  },

  async send_template({ admin, caller, clinicId, p }) {
    if (!p.template) throw new HttpError("Nama template wajib diisi");
    if (p.queue_id) await assertQueueInClinic(admin, p.queue_id, clinicId);
    const acc = await requireAccount(admin, clinicId);
    return await sendOutbound(
      admin,
      acc,
      caller,
      p.to,
      { kind: "template", name: p.template, language: p.language || "id", params: p.params || [] },
      { queueId: p.queue_id },
    );
  },

  async mark_read({ admin, clinicId, p }) {
    const { data: conv } = await admin.from("wa_conversations").select("id, clinic_id").eq("id", p.conversation_id)
      .maybeSingle();
    if (!conv || conv.clinic_id !== clinicId) throw new HttpError("Percakapan tidak ditemukan", 404);
    await admin.from("wa_conversations").update({ unread_count: 0 }).eq("id", conv.id);
    // Centang biru di sisi pasien — best effort, tidak boleh menggagalkan aksi.
    const { data: last } = await admin.from("wa_messages").select("wa_message_id")
      .eq("conversation_id", conv.id).eq("direction", "in").not("wa_message_id", "is", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const acc = await loadAccount(admin, clinicId);
    if (acc && last?.wa_message_id) {
      try {
        await graph(`/${acc.phone_number_id}/messages`, acc.token, {
          method: "POST",
          body: { messaging_product: "whatsapp", status: "read", message_id: last.wa_message_id },
        });
      } catch (_) { /* abaikan */ }
    }
    return { ok: true };
  },

  // ───────────── Template ─────────────
  async templates_sync({ admin, clinicId }) {
    const acc = await requireAccount(admin, clinicId);
    const rows: any[] = [];
    let path: string | null =
      `/${acc.waba_id}/message_templates?fields=id,name,language,category,status,components,rejected_reason&limit=100`;
    for (let i = 0; path && i < 10; i++) {
      const res = await graph(path, acc.token);
      rows.push(...(res.data || []));
      path = res.paging?.next ? res.paging.next.replace(/^https:\/\/graph\.facebook\.com\/v[\d.]+/, "") : null;
    }
    const now = new Date().toISOString();
    if (rows.length) {
      await admin.from("wa_meta_templates").upsert(
        rows.map((t) => ({
          clinic_id: clinicId,
          name: t.name,
          language: t.language,
          category: t.category,
          status: t.status,
          meta_template_id: t.id,
          components: t.components || [],
          rejected_reason: t.rejected_reason && t.rejected_reason !== "NONE" ? t.rejected_reason : null,
          synced_at: now,
        })),
        { onConflict: "clinic_id,name,language" },
      );
    }
    return { synced: rows.length };
  },

  async template_create({ admin, clinicId, p }) {
    const acc = await requireAccount(admin, clinicId);
    const name = String(p.name || "").trim();
    if (!TEMPLATE_NAME.test(name)) {
      throw new HttpError("Nama template hanya boleh huruf kecil, angka, dan underscore.");
    }
    const body = String(p.body || "").trim();
    if (!body) throw new HttpError("Isi template wajib diisi");
    const category = ["UTILITY", "MARKETING", "AUTHENTICATION"].includes(p.category) ? p.category : "UTILITY";
    const language = p.language || "id";

    const vars = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const max = vars.length ? Math.max(...vars) : 0;
    for (let i = 1; i <= max; i++) {
      if (!vars.includes(i)) throw new HttpError(`Variabel harus berurutan: {{${i}}} tidak ada.`);
    }
    const examples: string[] = (p.examples || []).map(String);
    if (max > 0 && examples.length < max) {
      throw new HttpError(`Meta mewajibkan contoh isi untuk setiap variabel (${max} contoh).`);
    }

    const components: any[] = [];
    if (p.header_text) components.push({ type: "HEADER", format: "TEXT", text: String(p.header_text) });
    components.push({
      type: "BODY",
      text: body,
      ...(max > 0 ? { example: { body_text: [examples.slice(0, max)] } } : {}),
    });
    if (p.footer_text) components.push({ type: "FOOTER", text: String(p.footer_text) });

    const res = await graph(`/${acc.waba_id}/message_templates`, acc.token, {
      method: "POST",
      body: { name, language, category, components },
    });
    await admin.from("wa_meta_templates").upsert({
      clinic_id: clinicId,
      name,
      language,
      category: res.category || category,
      status: res.status || "PENDING",
      meta_template_id: res.id,
      components,
      rejected_reason: null,
      synced_at: new Date().toISOString(),
    }, { onConflict: "clinic_id,name,language" });
    return { id: res.id, status: res.status || "PENDING" };
  },

  async template_delete({ admin, clinicId, p }) {
    const acc = await requireAccount(admin, clinicId);
    const name = String(p.name || "");
    if (!TEMPLATE_NAME.test(name)) throw new HttpError("Nama template tidak valid");
    await graph(`/${acc.waba_id}/message_templates?name=${encodeURIComponent(name)}`, acc.token, {
      method: "DELETE",
    });
    await admin.from("wa_meta_templates").delete().eq("clinic_id", clinicId).eq("name", name);
    return { deleted: name };
  },

  // ───────────── Broadcast ─────────────
  async broadcast_create({ admin, caller, clinicId, p }) {
    await requireAccount(admin, clinicId);
    const language = p.language || "id";
    const { data: tpl } = await admin.from("wa_meta_templates").select("status")
      .eq("clinic_id", clinicId).eq("name", p.template).eq("language", language).maybeSingle();
    if (!tpl) throw new HttpError("Template tidak ditemukan. Sinkronkan template dulu.");
    if (tpl.status !== "APPROVED") throw new HttpError(`Template belum disetujui Meta (status ${tpl.status}).`);

    const seen = new Set<string>();
    const recipients = (p.recipients || [])
      .map((r: any) => ({ phone: normalizePhone(r.phone || ""), patient_id: r.patient_id || null, params: (r.params || []).map(String) }))
      .filter((r: any) => r.phone.length >= 8 && !seen.has(r.phone) && seen.add(r.phone));
    if (!recipients.length) throw new HttpError("Tidak ada penerima yang valid");
    if (recipients.length > 5000) throw new HttpError("Maksimal 5000 penerima per broadcast");

    const { data: b, error } = await admin.from("wa_broadcasts").insert({
      clinic_id: clinicId,
      name: String(p.name || "Broadcast").slice(0, 120),
      template_name: p.template,
      language,
      total: recipients.length,
      created_by: caller.userId,
    }).select("id").single();
    if (error) throw error;

    for (let i = 0; i < recipients.length; i += 500) {
      const { error: e2 } = await admin.from("wa_broadcast_recipients").insert(
        recipients.slice(i, i + 500).map((r: any) => ({ ...r, broadcast_id: b.id, clinic_id: clinicId })),
      );
      if (e2) throw e2;
    }
    return { broadcast_id: b.id, total: recipients.length };
  },

  // Diproses per batch kecil dan dipanggil berulang oleh UI sampai remaining = 0,
  // supaya tidak melewati batas waktu Edge Function.
  async broadcast_process({ admin, caller, clinicId, p }) {
    const acc = await requireAccount(admin, clinicId);
    const { data: b } = await admin.from("wa_broadcasts").select("*").eq("id", p.broadcast_id).maybeSingle();
    if (!b || b.clinic_id !== clinicId) throw new HttpError("Broadcast tidak ditemukan", 404);
    if (b.status !== "running") return { remaining: 0, status: b.status };

    const { data: batch } = await admin.from("wa_broadcast_recipients").select("*")
      .eq("broadcast_id", b.id).eq("status", "pending").limit(Math.min(Number(p.limit) || 30, 50));

    let sent = 0, failed = 0;
    const CONC = 5;
    for (let i = 0; i < (batch || []).length; i += CONC) {
      await Promise.all((batch || []).slice(i, i + CONC).map(async (r: any) => {
        try {
          const res = await sendOutbound(
            admin,
            acc,
            caller,
            r.phone,
            { kind: "template", name: b.template_name, language: b.language, params: r.params || [] },
            { broadcastId: b.id },
          );
          await admin.from("wa_broadcast_recipients").update({
            status: "sent",
            wa_message_id: res.wa_message_id,
            updated_at: new Date().toISOString(),
          }).eq("id", r.id);
          sent++;
        } catch (e) {
          await admin.from("wa_broadcast_recipients").update({
            status: "failed",
            error_message: (e as Error).message.slice(0, 500),
            updated_at: new Date().toISOString(),
          }).eq("id", r.id);
          failed++;
        }
      }));
    }

    const { count } = await admin.from("wa_broadcast_recipients").select("id", { count: "exact", head: true })
      .eq("broadcast_id", b.id).eq("status", "pending");
    const remaining = count ?? 0;
    if (remaining === 0) {
      await admin.from("wa_broadcasts").update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", b.id);
    }
    return { sent, failed, remaining };
  },

  async broadcast_cancel({ admin, clinicId, p }) {
    const { data: b } = await admin.from("wa_broadcasts").select("clinic_id").eq("id", p.broadcast_id).maybeSingle();
    if (!b || b.clinic_id !== clinicId) throw new HttpError("Broadcast tidak ditemukan", 404);
    await admin.from("wa_broadcasts").update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", p.broadcast_id).eq("status", "running");
    return { cancelled: true };
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = adminClient();
  try {
    const caller = await getCaller(req, admin);
    if (!caller) return json({ error: "Tidak terautentikasi" }, 401);
    if (!STAFF.includes(caller.role)) return json({ error: "Tidak punya akses" }, 403);

    const p = await req.json().catch(() => ({}));
    const handler = handlers[p?.action];
    if (!handler) return json({ error: "Aksi tidak dikenal" }, 400);

    // super_admin boleh menarget klinik lain lewat clinic_id; role lain terkunci ke kliniknya.
    const clinicId = caller.role === "super_admin" && p.clinic_id ? p.clinic_id : caller.clinicId;
    if (!clinicId) return json({ error: "Klinik tidak ditemukan" }, 400);

    const data = await handler({ admin, caller, clinicId, p });
    return json({ success: true, data });
  } catch (e) {
    if (e instanceof HttpError) return json({ success: false, error: e.message }, e.status);
    if (e instanceof MetaError) return json({ success: false, error: e.message }, 502);
    console.error("[wa-cloud]", e);
    return json({ success: false, error: "Terjadi kesalahan di server" }, 500);
  }
});
