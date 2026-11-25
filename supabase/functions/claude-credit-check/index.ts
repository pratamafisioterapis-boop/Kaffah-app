// Peringatan Telegram bila sisa kredit Claude API <= ambang (default 5 USD).
//
// Anthropic tidak punya endpoint saldo. Cara kerja: owner mencatat saldo lewat Telegram (/kredit 25),
// lalu fungsi ini menghitung pemakaian sejak itu dari Admin API cost_report: sisa = saldo - pemakaian.
// Dipanggil tiap jam oleh pg_cron dan oleh telegram-webhook (/kredit). Autentikasi: header x-internal-secret.
//
// Body: {}                          -> cek dan kirim peringatan bila perlu
//       { "set_balance": 25 }       -> catat saldo baru (juga mengaktifkan lagi peringatan)
//       { "set_threshold": 5 }      -> ubah ambang
//       { "status": true }          -> hanya hitung dan kembalikan teks status (tanpa peringatan)
// Secrets: ANTHROPIC_ADMIN_KEY (sk-ant-admin..., dibuat di Console > Settings > Admin keys),
//          TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_INTERNAL_SECRET. Deploy dengan verify_jwt = false.
import { createClient } from "npm:@supabase/supabase-js@2";

const REALERT_MS = 12 * 3600e3; // selama masih di bawah ambang, ingatkan lagi tiap 12 jam
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const usd = (n: number) => `$${n.toFixed(2)}`;

function safeEqual(a: string, b: string) {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let d = 0;
  for (let i = 0; i < ea.length; i++) d |= ea[i] ^ eb[i];
  return d === 0;
}

const dayStartUtc = (t: number) => new Date(Math.floor(t / 86400e3) * 86400e3);

/** Total biaya (USD) dari awal hari UTC `from` sampai sekarang, dan biaya hari UTC `from` saja. */
async function costSince(adminKey: string, from: Date): Promise<{ total: number; firstDay: number }> {
  let total = 0, firstDay = 0, page: string | null = null;
  const end = new Date(dayStartUtc(Date.now()).getTime() + 86400e3);
  for (let i = 0; i < 20; i++) {
    const u = new URL("https://api.anthropic.com/v1/organizations/cost_report");
    u.searchParams.set("starting_at", from.toISOString());
    u.searchParams.set("ending_at", end.toISOString());
    u.searchParams.set("bucket_width", "1d");
    u.searchParams.set("limit", "31");
    if (page) u.searchParams.set("page", page);
    const res = await fetch(u, {
      signal: AbortSignal.timeout(25000),
      headers: { "x-api-key": adminKey, "anthropic-version": "2023-06-01" },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${data?.error?.message || "unknown"}`);
    for (const b of data.data || []) {
      // amount dalam sen (string desimal)
      const cost = (b.results || []).reduce((a: number, r: any) => a + Number(r.amount || 0), 0) / 100;
      total += cost;
      if (Date.parse(b.starting_at) === from.getTime()) firstDay += cost;
    }
    if (!data.has_more || !data.next_page) break;
    page = data.next_page;
  }
  return { total, firstDay };
}

async function telegram(text: string) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN"), chat = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!token || !chat) throw new Error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diset");
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", signal: AbortSignal.timeout(20000), headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}`);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  const secret = Deno.env.get("TELEGRAM_INTERNAL_SECRET");
  if (!secret || !safeEqual(req.headers.get("x-internal-secret") || "", secret)) return json({ ok: false, error: "Tidak diizinkan" }, 401);

  const body = await req.json().catch(() => ({}));
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const adminKey = Deno.env.get("ANTHROPIC_ADMIN_KEY");

  try {
    if (body.set_threshold !== undefined) {
      const t = Number(body.set_threshold);
      if (!isFinite(t) || t < 0) return json({ ok: false, text: "Ambang tidak valid." });
      await admin.from("claude_credit_monitor").update({ threshold_usd: t }).eq("id", 1);
      return json({ ok: true, text: `✅ Ambang peringatan kredit Claude: ${usd(t)}.` });
    }

    if (body.set_balance !== undefined) {
      const bal = Number(body.set_balance);
      if (!isFinite(bal) || bal < 0) return json({ ok: false, text: "Saldo tidak valid. Contoh: /kredit 25" });
      if (!adminKey) return json({ ok: false, text: "⚠️ Secret ANTHROPIC_ADMIN_KEY belum diset di Supabase, jadi pemakaian belum bisa dihitung." });
      const { firstDay } = await costSince(adminKey, dayStartUtc(Date.now()));
      await admin.from("claude_credit_monitor").update({
        balance_usd: bal, balance_as_of: new Date().toISOString(), spent_offset_usd: firstDay,
        last_alert_at: null, last_remaining: bal,
      }).eq("id", 1);
      const { data: m } = await admin.from("claude_credit_monitor").select("threshold_usd").eq("id", 1).single();
      return json({ ok: true, text: `✅ Saldo kredit Claude dicatat ${usd(bal)}. Peringatan dikirim saat sisa ≤ ${usd(Number(m?.threshold_usd ?? 5))}.` });
    }

    const { data: m } = await admin.from("claude_credit_monitor").select("*").eq("id", 1).single();
    if (!m || m.balance_usd === null || !m.balance_as_of) {
      return json({ ok: true, text: "Saldo kredit Claude belum dicatat. Cek saldo di console.anthropic.com > Billing, lalu kirim /kredit <saldo>, mis. /kredit 25." });
    }
    if (!adminKey) return json({ ok: false, text: "⚠️ Secret ANTHROPIC_ADMIN_KEY belum diset di Supabase." });

    const { total } = await costSince(adminKey, dayStartUtc(Date.parse(m.balance_as_of)));
    const spent = Math.max(0, total - Number(m.spent_offset_usd || 0));
    const remaining = Number(m.balance_usd) - spent;
    const threshold = Number(m.threshold_usd);
    const line = `Sisa kredit Claude ≈ ${usd(remaining)} (saldo ${usd(Number(m.balance_usd))} − pemakaian ${usd(spent)}). Ambang ${usd(threshold)}.`;
    await admin.from("claude_credit_monitor").update({ last_checked_at: new Date().toISOString(), last_remaining: remaining }).eq("id", 1);

    if (body.status) return json({ ok: true, text: line, remaining });

    const due = remaining <= threshold &&
      (!m.last_alert_at || Date.now() - Date.parse(m.last_alert_at) >= REALERT_MS);
    if (due) {
      await telegram(`⚠️ Kredit Claude API hampir habis\nSisa ≈ ${usd(remaining)} (ambang ${usd(threshold)}).\nAI WhatsApp dan SOAP akan berhenti bila kredit habis. Top up di console.anthropic.com > Billing, lalu kirim /kredit <saldo baru> ke bot ini.`);
      await admin.from("claude_credit_monitor").update({ last_alert_at: new Date().toISOString() }).eq("id", 1);
    }
    return json({ ok: true, remaining, alerted: due });
  } catch (e) {
    console.error("[claude-credit-check]", e);
    return json({ ok: false, text: `⚠️ Cek kredit Claude gagal: ${String(e instanceof Error ? e.message : e).slice(0, 200)}` }, 500);
  }
});
