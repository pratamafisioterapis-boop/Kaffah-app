import { createClient } from "npm:@supabase/supabase-js@2";
import { GoogleAuth } from "npm:google-auth-library";

const PROJECT_ID = Deno.env.get("GOOGLE_PROJECT_ID")!;

async function getAccessToken() {
  const auth = new GoogleAuth({
    credentials: {
      client_email: Deno.env.get("GOOGLE_CLIENT_EMAIL"),
      private_key: Deno.env
        .get("GOOGLE_PRIVATE_KEY")
        ?.replace(/\\n/g, "\n"),
    },
    scopes: [
      "https://www.googleapis.com/auth/firebase.messaging",
    ],
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();

  return token.token;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
console.log("BODY RECEIVED:", body);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
const { data: userData } = await supabase
  .from("users")
  .select("role, clinic_id")
  .eq("id", body.user_id)
  .single();

// Logo klinik dipakai sebagai icon notifikasi supaya tiap klinik lihat
// logonya sendiri, bukan logo Kaffah Tech generik.
let clinicLogoUrl = null;
if (userData?.clinic_id) {
  const { data: clinicData } = await supabase
    .from("clinics")
    .select("logo_url")
    .eq("id", userData.clinic_id)
    .single();
  clinicLogoUrl = clinicData?.logo_url || null;
}

// Kalau caller sudah kirim url tujuan sendiri (mis. notifikasi accounting),
// pakai itu. Kalau tidak, fallback ke default lama berbasis appointment.
let targetUrl = body.url || "/";

if (!body.url) {
  if (userData?.role === "owner") {
    targetUrl = `/owner/appointments?date=${body.appointment_date}`;
  }
  else if (userData?.role === "admin") {
    targetUrl = `/admin/appointments?date=${body.appointment_date}`;
  }
  else if (userData?.role === "therapist") {
    targetUrl = `/therapist/booking?date=${body.appointment_date}`;
  }
}

console.log("TARGET URL:", targetUrl);
    const { data: tokens, error } = await supabase
      .from("fcm_tokens")
      .select("token")
      .eq("user_id", body.user_id);

    if (error) throw error;

    if (!tokens || tokens.length === 0) {
      throw new Error("FCM token tidak ditemukan");
    }
console.log("PUSH PAYLOAD:", {
  title: body.title,
  body: body.body,
  raw: body,
});

    const accessToken = await getAccessToken();

    const results = [];

    for (const row of tokens) {
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: row.token,
              data: {
                title: body.title,
                body: body.body,
                appointment_date: body.appointment_date,
                appointment_id: body.appointment_id,
                url: targetUrl,
                icon_url: clinicLogoUrl || ""
              },
              // Tanpa ini, FCM mengirim pesan dengan prioritas normal.
              // Saat browser/PWA benar-benar ditutup (bukan cuma minimize),
              // Android menahan pesan prioritas normal karena Doze/App Standby,
              // sehingga notifikasi baru muncul kalau app dibuka lagi (atau tidak
              // muncul sama sekali). Urgency "high" membuat FCM/Android
              // memperlakukan pesan ini sebagai high-priority sehingga tetap
              // dikirim walau app dalam keadaan killed.
              webpush: {
                headers: {
                  Urgency: "high"
                }
              }
            },
          }),
        }
      );

      const responseText = await response.text();

      // Kalau Firebase bilang token sudah tidak terdaftar, hapus dari DB
      // supaya tidak terus-terusan gagal kirim ke token mati
      if (responseText.includes("UNREGISTERED") || responseText.includes("NotRegistered")) {
        await supabase.from("fcm_tokens").delete().eq("token", row.token);
      }

      results.push({
        status: response.status,
        response: responseText,
      });
    }

    return Response.json({
      success: true,
      sent: results.length,
      results,
    });

  } catch (err) {
    return Response.json({
      success: false,
      error: String(err),
    }, {
      status: 500,
    });
  }
});
