// Mengisi wa_ai_logs.admin_replied_at (waktu balasan admin pertama) dari riwayat Watzap untuk pesan
// yang ditangani manusia. Dipanggil cron tiap 20 menit dengan x-cron-token. Dipisah dari wa-ai-reply
// agar tab "Performa Admin" bisa diperbarui tanpa menyentuh fungsi yang melayani pasien.
import { adminClient, json, normalizePhone } from "./wa.ts";

type Admin = ReturnType<typeof adminClient>;

const WATZAP_TZ = "+07:00"; // stempel waktu Watzap memakai WIB
const watzapTime = (ts: string) => Date.parse(`${String(ts).replace(" ", "T")}${WATZAP_TZ}`);

async function watzapHistory(
  admin: Admin,
  clinicId: string,
  waId: string,
): Promise<{ items: any[]; variant: string }> {
  const { data: wa } = await admin.from("wa_settings")
    .select("api_key, number_key").eq("clinic_id", clinicId).maybeSingle();
  if (!wa?.api_key) throw new Error("kunci Watzap tidak ada");

  // Parameter yang diterima endpoint /conversations tidak terdokumentasi lengkap: kunci nomor
  // (WA Web) bisa membuat hasil kosong untuk WABA, jadi disertakan hanya pada satu percobaan.
  const post = async (path: string, body: Record<string, unknown>, withNumberKey: boolean) => {
    const res = await fetch(`https://api.watzap.id/v1/${path}`, {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: wa.api_key,
        ...(withNumberKey && wa.number_key ? { number_key: wa.number_key } : {}),
        ...body,
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || (out?.ack && out.ack !== "success" && out.ack !== "successfully")) {
      throw new Error(`HTTP ${res.status} ${String(out?.message || "gagal").slice(0, 80)}`);
    }
    return out?.data ?? out;
  };

  const digits = normalizePhone(waId);
  const tail = digits.slice(-9);
  const itemsOf = (d: any): any[] => {
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.items)) return d.items;
    const arr = Object.values(d || {}).find((v) => Array.isArray(v));
    return (arr as any[]) || [];
  };
  const hasPhone = (c: any) =>
    Object.values(c || {}).some((v) =>
      (typeof v === "string" || typeof v === "number") &&
      String(v).replace(/\D/g, "").endsWith(tail) && String(v).replace(/\D/g, "").length >= 9
    );
  const idOf = (c: any) => c?.conversation_id ?? c?.id ?? c?._id;

  // ID pengirim WABA (bila ada) dari info akun.
  let senderIds: string[] = [];
  try {
    const info = await post("checking_key", {}, false);
    senderIds = [...new Set(JSON.stringify(info).match(/[0-9a-f]{24}/g) || [])].slice(0, 3);
  } catch { /* abaikan: percobaan tanpa sender_id tetap jalan */ }

  type Attempt = { label: string; nk: boolean; extra: Record<string, unknown> };
  const attempts: Attempt[] = [
    { label: "waba", nk: false, extra: { channel: "waba" } },
    { label: "polos", nk: false, extra: {} },
    ...senderIds.map((id, i) => ({ label: `pengirim${i + 1}`, nk: false, extra: { sender_id: id, channel: "waba" } })),
    { label: "kunci-nomor", nk: true, extra: {} },
  ];

  let win: Attempt | null = null;
  let found: any = null;
  const diag: string[] = [];
  for (const at of attempts) {
    try {
      const d = await post("conversations", { action: "list", per_page: 100, page: 1, ...at.extra }, at.nk);
      const items = itemsOf(d);
      diag.push(`${at.label}=${items.length}[${Object.keys(d || {}).slice(0, 4).join("/")}]`);
      const hit = items.find(hasPhone);
      if (hit) { win = at; found = hit; break; }
    } catch (e) {
      diag.push(`${at.label}=ERR ${String((e as Error).message).slice(0, 60)}`);
    }
  }
  const convId = idOf(found);
  if (!win || !convId) {
    throw new Error(`percakapan tidak ditemukan di Watzap: ${diag.join("; ")}`.slice(0, 400));
  }

  // Urutan data tidak dijamin: ambil halaman pertama dan terakhir, lalu cari yang terbaru.
  const perPage = 50;
  const msgs = (page: number) =>
    post("conversations", { action: "messages", conversation_id: convId, page, per_page: perPage, ...win!.extra }, win!.nk);
  const first = await msgs(1);
  let items: any[] = itemsOf(first);
  const total = Number(first?.pagination?.total || items.length);
  if (total > perPage) items = items.concat(itemsOf(await msgs(Math.ceil(total / perPage))));
  if (!items.length) throw new Error("riwayat pesan Watzap kosong");
  return { items, variant: win.label };
}

async function inboundById(admin: Admin, ids: string[]): Promise<Map<string, any>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return new Map();
  const { data } = await admin.from("wa_inbox_messages").select("id, body, created_at").in("id", uniq);
  return new Map((data || []).map((m: any) => [m.id, m]));
}

async function fillAdminReplyTimes(admin: Admin) {
  const now = Date.now();
  const { data: logs } = await admin.from("wa_ai_logs")
    .select("id, clinic_id, conversation_id, inbound_message_id, created_at, wa_inbox_conversations(wa_id)")
    .eq("mode", "live").is("admin_replied_at", null)
    .or("outcome.eq.handoff,skip_reason.in.(admin_sudah_membalas_via_watzap,admin_sudah_membalas,sudah_diserahkan_ke_admin,ai_dimatikan_untuk_chat_ini)")
    .gte("created_at", new Date(now - 48 * 3600e3).toISOString())
    .lte("created_at", new Date(now - 2 * 60e3).toISOString())
    .not("inbound_message_id", "is", null)
    .order("created_at", { ascending: true }).limit(150);
  if (!logs?.length) return;

  const inbound = await inboundById(admin, logs.map((l: any) => l.inbound_message_id));
  const convIds = [...new Set(logs.map((l: any) => l.conversation_id).filter(Boolean))];
  const { data: aiOuts } = await admin.from("wa_inbox_messages").select("conversation_id, body")
    .in("conversation_id", convIds).eq("direction", "out").is("sent_by", null)
    .gte("created_at", new Date(now - 72 * 3600e3).toISOString());
  const norm = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase();
  const aiTexts = new Set((aiOuts || []).map((o: any) => norm(String(o.body || ""))));

  const byWa = new Map<string, any[]>();
  for (const l of logs) {
    const wa = (l as any).wa_inbox_conversations?.wa_id;
    if (!wa) continue;
    byWa.set(wa, [...(byWa.get(wa) || []), l]);
  }
  let checked = 0;
  for (const [wa, ls] of byWa) {
    if (checked++ >= 30) break; // batas permintaan Watzap per jalan
    let items: any[] = [];
    try {
      items = (await watzapHistory(admin, ls[0].clinic_id, wa)).items;
    } catch (e) {
      console.error("[wa-ai-reply] waktu balasan admin: riwayat Watzap gagal", wa, e);
      continue;
    }
    const msgs = items
      .map((i: any) => ({ t: watzapTime(i.timestamp), me: i.is_from_me === true, text: String(i.message || ""), type: i.type }))
      .filter((i) => Number.isFinite(i.t))
      .sort((a, b) => a.t - b.t);
    for (const l of ls) {
      const tIn = Date.parse(inbound.get(l.inbound_message_id)?.created_at || l.created_at);
      // Waktu pesan pasien menurut Watzap (pesan masuk terdekat dengan catatan inbox), lalu balasan
      // admin pertama SETELAH itu. Pesan admin sebelum pesan pasien adalah balasan untuk pesan lain.
      const patient = msgs.filter((x) => !x.me && Math.abs(x.t - tIn) <= 180e3)
        .sort((a, b) => Math.abs(a.t - tIn) - Math.abs(b.t - tIn))[0];
      const base = patient ? patient.t : tIn;
      const nextIn = msgs.find((x) => !x.me && x.t > base + 60e3);
      const first = msgs.find((x) =>
        x.me && x.type !== "template" && x.text.trim() && !aiTexts.has(norm(x.text)) &&
        x.t >= base && x.t < base + 12 * 3600e3 && (!nextIn || x.t < nextIn.t)
      );
      if (!first) continue;
      await admin.from("wa_ai_logs").update({ admin_replied_at: new Date(first.t).toISOString() }).eq("id", l.id);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const admin = adminClient();
  const token = req.headers.get("x-cron-token") || "";
  const { data: sec } = await admin.from("wa_ai_cron_secret").select("token").limit(1).maybeSingle();
  if (!token || !sec?.token || token !== sec.token) return json({ error: "Forbidden" }, 403);
  try {
    await fillAdminReplyTimes(admin);
  } catch (e) {
    console.error("[wa-admin-reply-times] gagal", e);
    return json({ ok: false }, 500);
  }
  return json({ ok: true });
});
