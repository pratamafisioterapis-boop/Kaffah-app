// Kirim pesan pasien yang TIDAK dibalas AI (diserahkan ke admin karena belum ada di knowledge) ke grup
// "Revisi agent ai" di Telegram, lengkap dengan templat "Pasien: ... / Jawaban: ..." supaya owner tinggal
// mengisi jawaban yang benar. Jawaban itu lalu dibaca wa-ai-reply (handleGroupUpdate) sebagai revisi.
//
// Dipicu trigger database (notify_ai_handoff_revision) lewat pg_net setiap wa_ai_logs live berubah menjadi
// 'handoff'. Autentikasi: header x-cron-token = token di tabel wa_ai_cron_secret (sama seperti cron AI).
// Deploy dengan verify_jwt = false. Secrets: TELEGRAM_BOT_TOKEN (sudah ada).
//
// Kasus yang memang kebijakan (home care, komplain, kwitansi, lampiran, dll.) tidak dikirim.
import { createClient } from "npm:@supabase/supabase-js@2";

const POLICY_SKIP =
  /home ?care|komplain|kecewa|refund|kwitansi|invoice|reward|kode referral|darurat|lampiran|gambar|foto|voice|rekam medis|kerja ?sama|marketing|sponsor|noop|placeholder|nomor pribadi|barang tertinggal/i;

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = req.headers.get("x-cron-token") || "";
  const { data: sec } = await admin.from("wa_ai_cron_secret").select("token").limit(1).maybeSingle();
  if (!token || !sec?.token || token !== sec.token) return reply({ error: "Forbidden" }, 403);

  try {
    const p = await req.json().catch(() => ({}));
    const logId = String(p.log_id || "");
    if (!logId) return reply({ skipped: "log_id kosong" });

    const { data: log } = await admin.from("wa_ai_logs")
      .select("id, clinic_id, conversation_id, inbound_message_id, outcome, mode, handoff_reason, telegram_message_id")
      .eq("id", logId).maybeSingle();
    if (!log || log.mode !== "live" || log.outcome !== "handoff") return reply({ skipped: "bukan handoff live" });
    if (log.telegram_message_id) return reply({ skipped: "sudah dikirim" });

    const reason = String(log.handoff_reason || "").trim();
    if (!reason || POLICY_SKIP.test(reason)) return reply({ skipped: "kasus kebijakan" });

    const { data: inb } = await admin.from("wa_inbox_messages")
      .select("id, msg_type, created_at").eq("id", log.inbound_message_id).maybeSingle();
    if (!inb || !["text", "button"].includes(inb.msg_type)) return reply({ skipped: "bukan teks" });

    const { data: st } = await admin.from("wa_ai_settings")
      .select("revision_chat_id").eq("clinic_id", log.clinic_id).maybeSingle();
    if (!st?.revision_chat_id) return reply({ skipped: "grup revisi belum diatur" });

    const { data: conv } = await admin.from("wa_inbox_conversations")
      .select("contact_name").eq("id", log.conversation_id).maybeSingle();

    // Pesan pasien yang belum dibalas: dari pesan klinik terakhir sampai pesan ini.
    const { data: hist } = await admin.from("wa_inbox_messages")
      .select("direction, body, msg_type, created_at").eq("conversation_id", log.conversation_id)
      .lte("created_at", inb.created_at).order("created_at", { ascending: false }).limit(10);
    const patientMsgs: string[] = [];
    for (const m of hist || []) {
      if (m.direction !== "in") break;
      const t = String(m.body || "").trim();
      if (t) patientMsgs.unshift(t.slice(0, 500));
    }
    if (!patientMsgs.length) return reply({ skipped: "tanpa teks pasien" });
    const patientText = patientMsgs.join("\n");

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) return reply({ error: "TELEGRAM_BOT_TOKEN belum diset" }, 500);
    const text = [
      "❓ AI tidak membalas pesan ini (belum ada di knowledge)",
      `Dari: ${conv?.contact_name || "pasien"}`,
      `Alasan AI: ${reason.slice(0, 300)}`,
      "",
      "Salin pesan di bawah, isi jawaban yang seharusnya, lalu kirim ke grup ini:",
      "",
      `Pasien: ${patientText}`,
      "Jawaban: ",
    ].join("\n").slice(0, 4000);

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      signal: AbortSignal.timeout(30000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: st.revision_chat_id, text, disable_web_page_preview: true }),
    });
    if (!res.ok) return reply({ error: `Telegram ${res.status}` }, 502);
    const out = await res.json().catch(() => ({}));
    await admin.from("wa_ai_logs").update({ telegram_message_id: out?.result?.message_id ?? null }).eq("id", log.id);
    return reply({ sent: true });
  } catch (e) {
    console.error("[wa-ai-revision-notify]", e);
    return reply({ error: String((e as Error).message || e) }, 500);
  }
});
