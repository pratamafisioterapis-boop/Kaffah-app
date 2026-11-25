// Customer Service Clinara untuk klinik Praxis.
//
// Dipanggil dengan tiga cara (deploy verify_jwt = true bagi pengguna; fungsi ini memeriksa sendiri):
//  1) Staf Praxis (JWT pengguna): { action: "create", subject, body } | { action: "message", ticket_id, body }
//  2) Pekerja/CS (Bearer service role): { action: "notify", ticket_id, text } mengirim pesan ke Telegram owner
//     dan mengaitkannya dengan tiket supaya bisa di-reply "ok"/"ga".
//  3) telegram-webhook (Bearer service role): { telegram_update } -> { handled: boolean }.
//     Perintah: /cs (daftar), /cs ok N, /cs tolak N, /cs batal N (kembalikan pengaturan), /cs selesai N.
//     Reply "ok"/"ga" pada notifikasi tiket juga dikenali.
//
// Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (sudah ada).
import { createClient } from "npm:@supabase/supabase-js@2";

const PRAXIS_CLINIC_ID = "b25e8c29-6977-4e1b-b500-7629ec3aeb8a";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const OK_RE = /^(ok|oke|okay|sip|setuju|acc|lanjut|👍|✅)[.! ]*$/i;
const NO_RE = /^(ga|gak|nggak|tidak|jangan|tolak|batal|👎|❌)[.! ]*$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(URL_, SERVICE);

async function tgSend(text: string, replyTo?: number): Promise<number | null> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chat = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!token || !chat) throw new Error("Secret Telegram belum lengkap");
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chat,
      text: text.slice(0, 4000),
      disable_web_page_preview: true,
      ...(replyTo ? { reply_to_message_id: replyTo, allow_sending_without_reply: true } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}`);
  const out = await res.json().catch(() => ({}));
  return out?.result?.message_id ?? null;
}

async function addMessage(ticketId: number, sender: "staff" | "cs", body: string) {
  await admin.from("clinara_cs_messages").insert({ ticket_id: ticketId, sender, body: body.slice(0, 4000) });
  await admin.from("clinara_cs_tickets").update({ updated_at: new Date().toISOString() }).eq("id", ticketId);
}

// ---------------------------------------------------------------- pengguna
async function handleUser(req: Request, body: any) {
  const auth = req.headers.get("Authorization") ?? "";
  const { data: u } = await admin.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (!u?.user) return json({ error: "Sesi tidak valid" }, 401);
  const { data: profile } = await admin.from("users").select("role, clinic_id, full_name").eq("id", u.user.id).single();
  const role = profile?.role === "clinic_admin" ? "admin" : profile?.role;
  const clinicId = profile?.clinic_id;
  if (!profile || clinicId !== PRAXIS_CLINIC_ID || !["owner", "admin"].includes(role)) {
    return json({ error: "Fitur ini khusus klinik Praxis." }, 403);
  }
  const { data: cfg } = await admin.from("clinara_cs_config").select("enabled, max_per_day").eq("clinic_id", clinicId).maybeSingle();
  if (!cfg?.enabled) return json({ error: "Layanan CS sedang dinonaktifkan." }, 403);

  const text = String(body.body ?? "").trim();
  if (text.length < 3) return json({ error: "Isi pesan terlalu pendek." }, 400);
  const name = profile.full_name || "Staf Praxis";

  if (body.action === "create") {
    const subject = String(body.subject ?? "").trim() || text.slice(0, 80);
    const since = new Date(Date.now() - 86400000).toISOString();
    const { count } = await admin.from("clinara_cs_tickets").select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId).gte("created_at", since);
    if ((count ?? 0) >= (cfg.max_per_day ?? 10)) return json({ error: "Batas tiket harian tercapai. Coba lagi besok." }, 429);

    const { data: t, error } = await admin.from("clinara_cs_tickets")
      .insert({ clinic_id: clinicId, requester_id: u.user.id, requester_name: name, subject: subject.slice(0, 200) })
      .select("id").single();
    if (error || !t) return json({ error: "Tiket gagal dibuat." }, 500);
    await admin.from("clinara_cs_messages").insert({ ticket_id: t.id, sender: "staff", body: text });
    try {
      const mid = await tgSend(`🆕 Tiket CS Praxis #${t.id}\nDari: ${name}\n${subject}\n\n${text}`);
      if (mid) await admin.from("clinara_cs_tickets").update({ tg_message_id: mid }).eq("id", t.id);
    } catch (e) { console.error("tg gagal:", (e as Error).message); }
    return json({ ok: true, ticket_id: t.id });
  }

  if (body.action === "message") {
    const { data: t } = await admin.from("clinara_cs_tickets").select("id, status, clinic_id").eq("id", body.ticket_id).single();
    if (!t || t.clinic_id !== clinicId) return json({ error: "Tiket tidak ditemukan." }, 404);
    await addMessage(t.id, "staff", text);
    try { await tgSend(`💬 Pesan baru di tiket #${t.id} (${name}):\n${text}`); } catch (_) { /* abaikan */ }
    return json({ ok: true });
  }
  return json({ error: "action tidak dikenal" }, 400);
}

// ---------------------------------------------------------------- service
async function handleNotify(body: any) {
  const { data: t } = await admin.from("clinara_cs_tickets").select("id").eq("id", body.ticket_id).single();
  if (!t) return json({ error: "Tiket tidak ditemukan" }, 404);
  const mid = await tgSend(String(body.text ?? ""), undefined);
  if (mid && body.anchor !== false) await admin.from("clinara_cs_tickets").update({ tg_message_id: mid }).eq("id", t.id);
  return json({ ok: true, message_id: mid });
}

// ---------------------------------------------------------------- Telegram
async function setStatus(id: number, status: string, note: string) {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (["selesai", "ditolak", "dibatalkan"].includes(status)) patch.resolved_at = new Date().toISOString();
  await admin.from("clinara_cs_tickets").update(patch).eq("id", id);
  await addMessage(id, "cs", note);
}

async function decide(id: number, verb: string): Promise<string> {
  const { data: t } = await admin.from("clinara_cs_tickets").select("*").eq("id", id).single();
  if (!t) return `Tiket #${id} tidak ditemukan.`;
  const open = !["selesai", "ditolak", "dibatalkan"].includes(t.status);

  if (verb === "ok") {
    if (t.status !== "menunggu_persetujuan") return `Tiket #${id} berstatus ${t.status}, tidak sedang menunggu persetujuan.`;
    if (t.category === "A") {
      const { data, error } = await admin.rpc("clinara_cs_apply_settings", { p_ticket_id: id });
      if (error) return `Gagal menerapkan #${id}: ${error.message}`;
      return `✅ #${id} diterapkan (${data} pengaturan). Batalkan dengan: /cs batal ${id}`;
    }
    await setStatus(id, "disetujui", "Rencana disetujui. Perubahan sedang disiapkan.");
    return `✅ #${id} disetujui. Perubahan kode akan dikerjakan, PR menyusul untuk Anda periksa.`;
  }
  if (verb === "tolak") {
    if (!open) return `Tiket #${id} sudah ${t.status}.`;
    await setStatus(id, "ditolak", "Permintaan ini belum bisa kami lakukan. Silakan hubungi CS bila perlu penjelasan.");
    return `❌ #${id} ditolak.`;
  }
  if (verb === "batal") {
    if (t.category === "A") {
      const { data, error } = await admin.rpc("clinara_cs_revert_settings", { p_ticket_id: id });
      if (error) return `Gagal membatalkan #${id}: ${error.message}`;
      return `↩️ #${id} dibatalkan, ${data} pengaturan dikembalikan.`;
    }
    if (!open) return `Tiket #${id} sudah ${t.status}.`;
    await setStatus(id, "dibatalkan", "Tiket dibatalkan.");
    return `↩️ #${id} dibatalkan.`;
  }
  if (verb === "selesai") {
    if (!open) return `Tiket #${id} sudah ${t.status}.`;
    await setStatus(id, "selesai", "Perubahan sudah live. Muat ulang aplikasi untuk melihatnya.");
    return `🎉 #${id} ditandai selesai, staf Praxis melihat statusnya di aplikasi.`;
  }
  return "Perintah tidak dikenal.";
}

async function handleTelegram(update: any) {
  const msg = update?.message;
  if (!msg?.text || String(msg.chat?.id) !== String(Deno.env.get("TELEGRAM_CHAT_ID"))) return { handled: false };
  const text = String(msg.text).trim();
  const reply = (s: string) => tgSend(s, msg.message_id);

  const cmd = text.match(/^\/cs(?:@\w+)?(?:\s+(ok|tolak|batal|selesai)\s+#?(\d+))?\s*$/i);
  if (cmd) {
    if (cmd[1]) { await reply(await decide(Number(cmd[2]), cmd[1].toLowerCase())); return { handled: true }; }
    const { data } = await admin.from("clinara_cs_tickets").select("id, status, category, subject")
      .not("status", "in", "(selesai,ditolak,dibatalkan)").order("id").limit(20);
    await reply(data?.length
      ? "Tiket CS terbuka:\n" + data.map((t) => `#${t.id} [${t.status}${t.category ? "/" + t.category : ""}] ${t.subject}`).join("\n")
        + "\n\n/cs ok N · /cs tolak N · /cs batal N · /cs selesai N"
      : "Tidak ada tiket CS terbuka.");
    return { handled: true };
  }

  const replyTo = msg.reply_to_message?.message_id;
  if (replyTo && (OK_RE.test(text) || NO_RE.test(text))) {
    const { data: t } = await admin.from("clinara_cs_tickets").select("id").eq("tg_message_id", replyTo).maybeSingle();
    if (t) { await reply(await decide(t.id, OK_RE.test(text) ? "ok" : "tolak")); return { handled: true }; }
  }
  return { handled: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const isService = bearer === SERVICE;
    if (body.telegram_update) {
      if (!isService) return json({ error: "Tidak diizinkan" }, 401);
      return json(await handleTelegram(body.telegram_update));
    }
    if (body.action === "notify") {
      if (!isService) return json({ error: "Tidak diizinkan" }, 401);
      return await handleNotify(body);
    }
    return await handleUser(req, body);
  } catch (e) {
    console.error("clinara-cs gagal:", (e as Error)?.message || e);
    return json({ error: "Terjadi kesalahan. Coba lagi." }, 500);
  }
});
