import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
// Default ke domain sandbox Resend supaya function tetap bisa dites tanpa
// domain sendiri. Begitu klinik punya domain sendiri yang sudah diverifikasi
// (SPF/DKIM/DMARC) di Resend, set RESEND_FROM_EMAIL ke alamat di domain itu
// supaya email tidak masuk folder spam penerima.
const FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "Kaffah App <onboarding@resend.dev>";
const APP_URL = Deno.env.get("APP_URL") || "https://app.kaffah.tech";

function escapeHtml(str: string) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveUrl(url?: string | null) {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `${APP_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

// Email dibuat sesederhana mungkin (tanpa gambar/tracking pixel, rasio
// teks:markup wajar, subjek jelas tanpa kapital/tanda seru berlebihan) dan
// selalu menyertakan versi plain-text, supaya spam filter (Gmail dsb) tidak
// menandainya sebagai promosi/spam. Konten dinamis di-escape supaya tidak
// bisa menyuntikkan HTML ke email.
function buildHtml({ title, body, actionUrl, recipientName }: { title: string; body: string; actionUrl: string | null; recipientName?: string | null }) {
  const greeting = recipientName ? `Halo ${escapeHtml(recipientName)},` : "Halo,";
  const button = actionUrl
    ? `<p style="margin:24px 0;">
         <a href="${escapeHtml(actionUrl)}" style="background:#0f766e;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;display:inline-block;">Buka Detail</a>
       </p>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;">
                <p style="margin:0 0 16px;font-size:14px;color:#52525b;">${greeting}</p>
                <h1 style="margin:0 0 12px;font-size:18px;color:#18181b;">${escapeHtml(title)}</h1>
                <p style="margin:0;font-size:14px;line-height:1.6;color:#3f3f46;">${escapeHtml(body)}</p>
                ${button}
                <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0 16px;" />
                <p style="margin:0;font-size:12px;color:#a1a1aa;">Ini email notifikasi otomatis dari Kaffah App terkait aktivitas akun Anda. Jika Anda merasa tidak seharusnya menerima email ini, silakan hubungi admin klinik Anda.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let toEmail: string | null = body.to || null;
    let recipientName: string | null = body.recipient_name || null;

    if (!toEmail && body.user_id) {
      const { data: userRow } = await supabase
        .from("users")
        .select("email, full_name")
        .eq("id", body.user_id)
        .single();

      toEmail = userRow?.email || null;
      recipientName = recipientName || userRow?.full_name || null;
    }

    if (!toEmail) {
      throw new Error("Email tujuan tidak ditemukan");
    }

    const title = body.title || "Notifikasi";
    const text = body.body || "";
    const actionUrl = resolveUrl(body.url);

    const html = buildHtml({ title, body: text, actionUrl, recipientName });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [toEmail],
        subject: title,
        html,
        text: `${recipientName ? `Halo ${recipientName},\n\n` : ""}${title}\n\n${text}${actionUrl ? `\n\nDetail: ${actionUrl}` : ""}`,
      }),
    });

    const responseBody = await res.json();

    if (!res.ok) {
      throw new Error(`Resend error: ${JSON.stringify(responseBody)}`);
    }

    return Response.json({
      success: true,
      id: responseBody?.id || null,
    });
  } catch (err) {
    return Response.json(
      {
        success: false,
        error: String(err),
      },
      { status: 500 }
    );
  }
});
