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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (!body?.user_id) {
      return Response.json({ success: false, error: "user_id wajib diisi." }, { status: 400 });
    }

const { data: userData } = await supabase
  .from("users")
  .select("role, clinic_id")
  .eq("id", body.user_id)
  .single();

// Endpoint ini juga dipanggil langsung dari browser (lihat sendPushNotification
// di src/lib/api.js). Tanpa cek ini, pengguna yang login bisa memalsukan
// notifikasi push (judul/isi bebas) ke user_id siapa pun di sistem, bukan
// cuma dirinya sendiri — celah spoofing/phishing lintas klinik. Panggilan
// dari trigger Postgres (net.http_post) tidak membawa header Authorization
// sama sekali, jadi baris ini hanya menjaga jalur pemanggilan langsung dari
// klien; jalur trigger DB tetap seperti semula.
const authHeader = req.headers.get("Authorization") || "";
if (authHeader) {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const callerClient = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerAuth, error: callerAuthErr } = await callerClient.auth.getUser();
  if (callerAuthErr || !callerAuth?.user) {
    return Response.json({ success: false, error: "Tidak terautentikasi" }, { status: 401 });
  }

  const isSelf = callerAuth.user.id === body.user_id;
  let isSameClinicManager = false;
  if (!isSelf) {
    const { data: callerRow } = await supabase
      .from("users")
      .select("role, clinic_id")
      .eq("id", callerAuth.user.id)
      .single();
    isSameClinicManager = !!callerRow &&
      ["owner", "admin", "clinic_admin", "super_admin"].includes(callerRow.role) &&
      (callerRow.role === "super_admin" || (userData?.clinic_id && callerRow.clinic_id === userData.clinic_id));
  }

  if (!isSelf && !isSameClinicManager) {
    return Response.json({ success: false, error: "Anda tidak punya akses untuk mengirim notifikasi ke pengguna ini." }, { status: 403 });
  }
}

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

    const { data: tokens, error } = await supabase
      .from("fcm_tokens")
      .select("token")
      .eq("user_id", body.user_id);

    if (error) throw error;

    if (!tokens || tokens.length === 0) {
      throw new Error("FCM token tidak ditemukan");
    }
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
