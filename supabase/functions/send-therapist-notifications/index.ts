import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_SERVICE_ACCOUNT = Deno.env.get("FCM_SERVICE_ACCOUNT")!;
const FCM_PROJECT_ID = "kaffah-physiotherapy";

async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payload = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: expiry,
  })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signingInput = `${header}.${payload}`;
  const pemContents = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyData = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", cryptoKey,
    new TextEncoder().encode(signingInput)
  );
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = `${signingInput}.${signature}`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error(`Gagal dapat access token: ${JSON.stringify(tokenData)}`);
  return tokenData.access_token;
}

// Data-only payload (no top-level "notification" field): when a message
// carries a "notification" block, browsers auto-render a native toast with
// a generic/no icon BEFORE our service worker's onBackgroundMessage runs,
// which then renders a *second* notification with the proper app icon —
// that's the duplicate (one with no logo) the user reported. Sending
// data-only makes onBackgroundMessage the single source of truth for how
// the notification looks.
async function sendFCMv1(accessToken: string, fcmToken: string, title: string, body: string, url: string) {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          data: { title, body, url },
        },
      }),
    }
  );
  return await res.json();
}

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Optional: { "therapist_id": "...", "event": "locked" | "unlocked" } for a
  // real-time single-therapist notification (a DB trigger firing when their
  // SOAP lock state changes), instead of the full nightly batch over
  // everyone.
  let onlyTherapistId: string | null = null;
  let lockEvent: string | null = null;
  try {
    const body = await req.json();
    onlyTherapistId = body?.therapist_id || null;
    lockEvent = body?.event || null;
  } catch (_e) {
    // no body / not JSON — proceed with the full nightly batch
  }

  const nowWIB = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
  const todayStr = nowWIB.toISOString().split("T")[0];
  const day = nowWIB.getUTCDate();

  let startPeriod: string, endPeriod: string;
  if (day >= 28) {
    startPeriod = new Date(Date.UTC(nowWIB.getUTCFullYear(), nowWIB.getUTCMonth(), 28)).toISOString().split("T")[0];
    endPeriod   = new Date(Date.UTC(nowWIB.getUTCFullYear(), nowWIB.getUTCMonth() + 1, 27)).toISOString().split("T")[0];
  } else {
    startPeriod = new Date(Date.UTC(nowWIB.getUTCFullYear(), nowWIB.getUTCMonth() - 1, 28)).toISOString().split("T")[0];
    endPeriod   = new Date(Date.UTC(nowWIB.getUTCFullYear(), nowWIB.getUTCMonth(), 27)).toISOString().split("T")[0];
  }

  console.log(`[Notif] Today WIB: ${todayStr}, Periode: ${startPeriod} s/d ${endPeriod}, onlyTherapistId: ${onlyTherapistId}, event: ${lockEvent}`);

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken(FCM_SERVICE_ACCOUNT);
  } catch (err) {
    return new Response(JSON.stringify({ error: "Gagal auth Google", detail: String(err) }), { status: 500 });
  }

  // Ambil FCM tokens beserta preferensi notifikasi
  const { data: fcmData } = await supabase
    .from("fcm_tokens")
    .select("token, user_id, notif_soap_enabled, notif_guest_enabled");

  const { data: therapistUsers } = await supabase
    .from("users")
    .select("id, full_name, role")
    .in("role", ["therapist", "physiotherapist"]);

  if (!therapistUsers?.length) {
    return new Response(JSON.stringify({ message: "Tidak ada terapis" }), { status: 200 });
  }

  const therapistUserIds = new Set(therapistUsers.map((u: any) => u.id));
  const therapistFCMTokens = (fcmData || []).filter((f: any) => therapistUserIds.has(f.user_id));

  const results: any[] = [];

  for (const ft of therapistFCMTokens) {
    const { user_id: userId, token: fcmToken, notif_soap_enabled, notif_guest_enabled } = ft as any;

    const { data: physioData } = await supabase
      .from("physiotherapists")
      .select("id, name")
      .eq("user_id", userId)
      .maybeSingle();

    if (!physioData) continue;
    const therapistId = physioData.id;

    if (onlyTherapistId && therapistId !== onlyTherapistId) continue;

    // ── Real-time "unlocked" event: therapist just cleared their SOAP backlog ──
    if (lockEvent === "unlocked") {
      const r = await sendFCMv1(accessToken, fcmToken,
        "✅ Jadwal Anda Terbuka Kembali",
        "Terima kasih! SOAP Anda sudah lengkap dan jadwal booking Anda kini terbuka kembali.",
        "/therapist/booking"
      );
      results.push({ therapist: physioData.name, notif: "soap_unlocked", fcmResult: r });
      continue;
    }

    // ── NOTIF 1: SOAP belum terisi (hanya jika notif_soap_enabled = true) ──
    let unfilledCount = 0;
    if (notif_soap_enabled !== false) {
      const { data: recaps } = await supabase
        .from("daily_recaps")
        .select("id")
        .eq("therapist_id", therapistId)
        .gte("recap_date", startPeriod)
        .lte("recap_date", endPeriod);

      if (recaps?.length) {
        const recapIds = recaps.map((r: any) => r.id);
        const filledSet = new Set<string>();
        for (let i = 0; i < recapIds.length; i += 200) {
          const chunk = recapIds.slice(i, i + 200);
          const { data: filled } = await supabase
            .from("medical_records")
            .select("daily_recap_id")
            .in("daily_recap_id", chunk);
          (filled || []).forEach((r: any) => { if (r.daily_recap_id) filledSet.add(r.daily_recap_id); });
        }
        unfilledCount = recaps.filter((r: any) => !filledSet.has(r.id)).length;
      }
    }

    // ── NOTIF 2: Pasien guest hari ini (hanya jika notif_guest_enabled = true, dan hanya untuk batch harian, bukan trigger real-time single-therapist) ──
    // Sumber kebenaran status guest = daily_recaps.patient_id (yang diisi saat
    // pasien didaftarkan lewat Daily Recap). Jangan cek appointments.patient_id
    // / guest_name: pendaftaran di Daily Recap tidak mengisi appointments, jadi
    // pasien yang sudah terdaftar tetap terhitung guest dan notif muncul terus.
    let guestCount = 0;
    if (!onlyTherapistId && notif_guest_enabled !== false) {
      const { count } = await supabase
        .from("daily_recaps")
        .select("id", { count: "exact", head: true })
        .eq("therapist_id", therapistId)
        .eq("recap_date", todayStr)
        .is("patient_id", null);
      guestCount = count || 0;
    }

    // ── NOTIF 3: Jadwal terkunci karena SOAP menumpuk (selalu dicek, terlepas
    // dari preferensi notif_soap_enabled — ini status penting yang memblokir
    // booking baru untuk terapis, bukan sekadar pengingat) ──
    let isLocked = false;
    let lockedUnfilledCount = 0;
    const { data: lockStatusRows } = await supabase
      .rpc("get_therapist_soap_lock_status", { p_therapist_id: therapistId });
    const lockStatus = Array.isArray(lockStatusRows) ? lockStatusRows[0] : lockStatusRows;
    if (lockStatus?.locked) {
      isLocked = true;
      lockedUnfilledCount = lockStatus.unfilled_count || 0;
    }

    console.log(`[Notif] ${physioData.name} — soap_enabled:${notif_soap_enabled}, guest_enabled:${notif_guest_enabled}, unfilled:${unfilledCount}, guest:${guestCount}, locked:${isLocked}`);

    if (isLocked) {
      const r = await sendFCMv1(accessToken, fcmToken,
        "🔒 Jadwal Anda Terkunci",
        `Jadwal booking Anda terkunci karena ${lockedUnfilledCount} SOAP belum diisi. Lengkapi SOAP sekarang untuk membuka kembali jadwal Anda.`,
        "/therapist/records"
      );
      results.push({ therapist: physioData.name, notif: "soap_locked", lockedUnfilledCount, fcmResult: r });
    } else if (unfilledCount > 0) {
      const r = await sendFCMv1(accessToken, fcmToken,
        "📋 SOAP Belum Terisi",
        `Ada ${unfilledCount} kunjungan periode ini belum diisi SOAP-nya. Yuk segera lengkapi!`,
        "/therapist/records"
      );
      results.push({ therapist: physioData.name, notif: "soap", unfilledCount, fcmResult: r });
    }

    if (guestCount > 0) {
      const r = await sendFCMv1(accessToken, fcmToken,
        "👤 Pasien Belum Terdaftar",
        `Ada ${guestCount} pasien hari ini masih berstatus guest di Daily Recap. Segera daftarkan!`,
        "/therapist/daily-recap"
      );
      results.push({ therapist: physioData.name, notif: "guest", guestCount, fcmResult: r });
    }

    if (!isLocked && unfilledCount === 0 && guestCount === 0) {
      results.push({ therapist: physioData.name, notif: "none" });
    }
  }

  return new Response(
    JSON.stringify({ success: true, processedAt: todayStr, results }),
    { headers: { "Content-Type": "application/json" } }
  );
});
