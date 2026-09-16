import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const jwt = authHeader.replace("Bearer ", "");
    const { data: callerData, error: callerErr } = await callerClient.auth.getUser(jwt);

    if (callerErr || !callerData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerProfile, error: profileErr } = await adminClient
      .from("users")
      .select("id, email, role, is_active")
      .eq("id", callerData.user.id)
      .single();

    if (profileErr || !callerProfile) {
      return new Response(JSON.stringify({ error: "Profil pemanggil tidak ditemukan" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (callerProfile.role !== "super_admin" || callerProfile.is_active === false) {
      return new Response(JSON.stringify({ error: "Forbidden: hanya super admin yang bisa remote ke akun lain" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { target_user_id } = body;

    if (!target_user_id) {
      return new Response(JSON.stringify({ error: "target_user_id wajib diisi" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (target_user_id === callerProfile.id) {
      return new Response(JSON.stringify({ error: "Tidak bisa remote ke akun sendiri" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: targetProfile, error: targetErr } = await adminClient
      .from("users")
      .select("id, email, full_name, role, clinic_id, is_active")
      .eq("id", target_user_id)
      .single();

    if (targetErr || !targetProfile) {
      return new Response(JSON.stringify({ error: "Akun tujuan tidak ditemukan" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (targetProfile.role === "super_admin") {
      return new Response(JSON.stringify({ error: "Tidak bisa remote ke sesama super admin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!targetProfile.email) {
      return new Response(JSON.stringify({ error: "Akun tujuan tidak memiliki email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: targetProfile.email,
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      return new Response(JSON.stringify({ error: linkErr?.message || "Gagal membuat sesi remote" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Best-effort audit log; a logging failure must not block a legitimate
    // support session, so it never overrides the response below.
    await adminClient.from("impersonation_logs").insert({
      admin_id: callerProfile.id,
      admin_email: callerProfile.email,
      target_user_id: targetProfile.id,
      target_email: targetProfile.email,
    });

    return new Response(
      JSON.stringify({
        token_hash: linkData.properties.hashed_token,
        email: targetProfile.email,
        target: {
          id: targetProfile.id,
          full_name: targetProfile.full_name,
          role: targetProfile.role,
          clinic_id: targetProfile.clinic_id,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
