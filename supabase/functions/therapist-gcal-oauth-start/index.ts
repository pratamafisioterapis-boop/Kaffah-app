import { createClient } from "jsr:@supabase/supabase-js@2";

// Terapis Kaffah menghubungkan Google Calendar pribadinya. Mengembalikan URL consent Google;
// hasilnya diproses di therapist-gcal-oauth-callback.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KAFFAH_CLINIC_ID = "bfdc3fd8-a052-4753-a5b7-229930b3237a";
const CLIENT_ID = (Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") || Deno.env.get("GOOGLE_OAUTH_CLIENT_ID"));
const REDIRECT_URI = `${Deno.env.get("SUPABASE_URL")}/functions/v1/therapist-gcal-oauth-callback`;
const SCOPES = ["https://www.googleapis.com/auth/calendar.events", "email"];
const DEFAULT_RETURN_ORIGIN = "https://kaffahphysio.id";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Hanya kembali ke domain aplikasi sendiri (hindari open redirect).
function safeReturnOrigin(origin: string | null): string {
  if (!origin) return DEFAULT_RETURN_ORIGIN;
  try {
    const url = new URL(origin);
    const host = url.hostname;
    const allowed =
      (url.protocol === "https:" &&
        (host === "kaffahphysio.id" || host.endsWith(".kaffahphysio.id") ||
          host === "clinara.id" || host.endsWith(".clinara.id"))) ||
      host === "localhost";
    return allowed ? url.origin : DEFAULT_RETURN_ORIGIN;
  } catch (_e) {
    return DEFAULT_RETURN_ORIGIN;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!CLIENT_ID) return json({ error: "GOOGLE_CALENDAR_CLIENT_ID belum diset di secrets Supabase" }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const jwt = authHeader.replace("Bearer ", "");
    const { data: callerData, error: callerErr } = await adminClient.auth.getUser(jwt);
    if (callerErr || !callerData?.user) return json({ error: "Invalid session" }, 401);

    const { data: therapist, error: therapistErr } = await adminClient
      .from("physiotherapists")
      .select("id, clinic_id")
      .eq("user_id", callerData.user.id)
      .maybeSingle();

    if (therapistErr || !therapist) return json({ error: "Akun ini bukan terapis" }, 403);
    if (therapist.clinic_id !== KAFFAH_CLINIC_ID) {
      return json({ error: "Fitur Google Calendar hanya tersedia untuk Kaffah Physiotherapy" }, 403);
    }

    const state = crypto.randomUUID();
    const returnUrl = `${safeReturnOrigin(req.headers.get("Origin"))}/therapist`;
    const { error: stateErr } = await adminClient.from("therapist_gcal_oauth_states").insert({
      state,
      physiotherapist_id: therapist.id,
      user_id: callerData.user.id,
      return_url: returnUrl,
    });
    if (stateErr) return json({ error: stateErr.message }, 500);

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("state", state);

    return json({ url: authUrl.toString() });
  } catch (error) {
    console.error("therapist-gcal-oauth-start error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
