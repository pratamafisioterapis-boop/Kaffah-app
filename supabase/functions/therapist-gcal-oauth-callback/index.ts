import { createClient } from "jsr:@supabase/supabase-js@2";

// Callback OAuth Google Calendar terapis: tukar code -> refresh token, simpan, lalu
// sinkronkan jadwal mendatang terapis tsb di background (therapist-gcal-sync op=backfill).

const CLIENT_ID = (Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") || Deno.env.get("GOOGLE_OAUTH_CLIENT_ID"));
const CLIENT_SECRET = (Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET") || Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET"));
const REDIRECT_URI = `${Deno.env.get("SUPABASE_URL")}/functions/v1/therapist-gcal-oauth-callback`;
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const DEFAULT_RETURN_URL = "https://kaffahphysio.id/therapist";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

function redirectWithStatus(returnUrl: string, status: string, message?: string) {
  const url = new URL(returnUrl);
  url.searchParams.set("settings", "kalender");
  url.searchParams.set("gcal_status", status);
  if (message) url.searchParams.set("gcal_message", message);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

Deno.serve(async (req: Request) => {
  let returnUrl = DEFAULT_RETURN_URL;
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (!state) return redirectWithStatus(returnUrl, "error", "Missing state");

    const { data: stateRow } = await adminClient
      .from("therapist_gcal_oauth_states")
      .select("physiotherapist_id, user_id, return_url, created_at")
      .eq("state", state)
      .maybeSingle();

    if (!stateRow) return redirectWithStatus(returnUrl, "error", "State tidak valid atau kedaluwarsa");
    returnUrl = stateRow.return_url || DEFAULT_RETURN_URL;

    await adminClient.from("therapist_gcal_oauth_states").delete().eq("state", state);

    if (oauthError) {
      return redirectWithStatus(returnUrl, "error", oauthError === "access_denied" ? "Izin ditolak" : oauthError);
    }
    if (!code) return redirectWithStatus(returnUrl, "error", "Missing code");

    if (Date.now() - new Date(stateRow.created_at).getTime() > 10 * 60 * 1000) {
      return redirectWithStatus(returnUrl, "error", "State kedaluwarsa, silakan coba lagi");
    }
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return redirectWithStatus(returnUrl, "error", "OAuth client belum dikonfigurasi");
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return redirectWithStatus(returnUrl, "error", tokenData.error_description || tokenData.error);
    }
    if (!String(tokenData.scope || "").split(" ").includes(CALENDAR_SCOPE)) {
      return redirectWithStatus(
        returnUrl,
        "error",
        "Izin Google Calendar tidak dicentang. Ulangi dan centang akses kalender."
      );
    }
    if (!tokenData.refresh_token) {
      return redirectWithStatus(
        returnUrl,
        "error",
        "Google tidak mengirim refresh token. Cabut akses lama di myaccount.google.com/permissions lalu coba lagi."
      );
    }

    let googleEmail: string | null = null;
    try {
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userInfo = await userInfoRes.json();
      googleEmail = userInfo.email || null;
    } catch (_e) {
      // non-fatal
    }

    const { data: therapist } = await adminClient
      .from("physiotherapists")
      .select("clinic_id")
      .eq("id", stateRow.physiotherapist_id)
      .maybeSingle();
    if (!therapist) return redirectWithStatus(returnUrl, "error", "Data terapis tidak ditemukan");

    const now = new Date().toISOString();
    const { error: upsertErr } = await adminClient.from("therapist_google_calendars").upsert(
      {
        physiotherapist_id: stateRow.physiotherapist_id,
        user_id: stateRow.user_id,
        clinic_id: therapist.clinic_id,
        refresh_token: tokenData.refresh_token,
        google_email: googleEmail,
        calendar_id: "primary",
        connected_at: now,
        last_error: null,
        updated_at: now,
      },
      { onConflict: "physiotherapist_id" }
    );
    if (upsertErr) return redirectWithStatus(returnUrl, "error", upsertErr.message);

    const { data: syncSecret } = await adminClient.rpc("kaffah_gcal_sync_secret");
    if (syncSecret) {
      EdgeRuntime.waitUntil(
        fetch(`${supabaseUrl}/functions/v1/therapist-gcal-sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-gcal-sync-secret": syncSecret },
          body: JSON.stringify({ op: "backfill", therapist_id: stateRow.physiotherapist_id }),
        }).catch((e) => console.error("backfill trigger failed:", e))
      );
    }

    return redirectWithStatus(returnUrl, "success");
  } catch (error) {
    console.error("therapist-gcal-oauth-callback error:", error);
    return redirectWithStatus(returnUrl, "error", error instanceof Error ? error.message : "Unknown error");
  }
});
