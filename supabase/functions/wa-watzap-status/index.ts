// Menyegarkan status pesan keluar (sent → delivered → read / failed) dari Watzap.
//
// Watzap menyimpan riwayat status tiap pesan (API /messages, action "status",
// dicari lewat WAMID). Callback status ke webhook tidak dilanggani untuk inbox ini,
// jadi aplikasi menarik status pesan yang belum final milik satu percakapan.
//
// POST { conversation_id } dengan JWT staf klinik. Hanya menyentuh pesan keluar
// klinik pemanggil; api_key Watzap dibaca di server dan tidak pernah ke browser.

import { adminClient, CORS, getCaller, json } from "../_shared/wa.ts";
import { parseStatus, shouldAdvance } from "./parse.ts";

const STAFF = ["owner", "admin", "super_admin"];
const MAX_MESSAGES = 30;
const CONCURRENCY = 5;
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;

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
    if (!p.conversation_id) return json({ success: false, error: "conversation_id wajib" }, 400);

    const { data: wa } = await admin.from("wa_settings")
      .select("api_key, enabled, inbox_enabled")
      .eq("clinic_id", caller.clinicId).maybeSingle();
    if (!wa?.inbox_enabled || !wa.enabled || !wa.api_key) {
      return json({ success: false, error: "Inbox WhatsApp belum diaktifkan untuk klinik ini." }, 412);
    }

    // Filter clinic_id memastikan percakapan milik klinik pemanggil.
    const { data: msgs } = await admin.from("wa_inbox_messages")
      .select("id, wa_message_id, status")
      .eq("clinic_id", caller.clinicId)
      .eq("conversation_id", p.conversation_id)
      .eq("direction", "out")
      .in("status", ["sent", "delivered"])
      .not("wa_message_id", "is", null)
      .gte("created_at", new Date(Date.now() - LOOKBACK_MS).toISOString())
      .order("created_at", { ascending: false })
      .limit(MAX_MESSAGES);

    const todo = msgs || [];
    let updated = 0;
    for (let i = 0; i < todo.length; i += CONCURRENCY) {
      await Promise.all(todo.slice(i, i + CONCURRENCY).map(async (m: any) => {
        try {
          const res = await fetch("https://api.watzap.id/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ api_key: wa.api_key, action: "status", message_id: m.wa_message_id }),
          });
          const parsed = parseStatus(await res.json().catch(() => ({})));
          if (!parsed || !shouldAdvance(m.status, parsed.status)) return;
          const { error } = await admin.from("wa_inbox_messages").update({
            status: parsed.status,
            status_at: parsed.at,
            ...(parsed.error ? { error_message: parsed.error } : {}),
          }).eq("id", m.id).eq("status", m.status); // jangan menimpa bila sudah berubah
          if (!error) updated++;
        } catch (e) {
          console.error("[wa-watzap-status]", m.id, e);
        }
      }));
    }
    return json({ success: true, data: { checked: todo.length, updated } });
  } catch (e) {
    console.error("[wa-watzap-status]", e);
    return json({ success: false, error: "Terjadi kesalahan di server" }, 500);
  }
});
