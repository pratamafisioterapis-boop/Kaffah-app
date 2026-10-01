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
      .select("role, clinic_id")
      .eq("id", callerData.user.id)
      .single();

    const callerRole = callerProfile?.role;
    if (profileErr || !callerProfile || (callerRole !== "super_admin" && callerRole !== "owner")) {
      return new Response(JSON.stringify({ error: "Forbidden: hanya Super Admin atau Owner yang bisa mengganti password user lain" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { user_id, new_password } = body;

    if (!user_id || !new_password) {
      return new Response(JSON.stringify({ error: "user_id dan new_password wajib diisi" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof new_password !== "string" || new_password.length < 6) {
      return new Response(JSON.stringify({ error: "Password minimal 6 karakter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Owner hanya boleh mengganti password Clinic Admin di klinik yang sama.
    if (callerRole === "owner") {
      const { data: target, error: targetErr } = await adminClient
        .from("users")
        .select("role, clinic_id")
        .eq("id", user_id)
        .single();

      if (
        targetErr || !target ||
        target.role !== "clinic_admin" ||
        !callerProfile.clinic_id ||
        target.clinic_id !== callerProfile.clinic_id
      ) {
        return new Response(JSON.stringify({ error: "Forbidden: Owner hanya bisa mengganti password Admin Klinik di kliniknya sendiri" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { error: updateErr } = await adminClient.auth.admin.updateUserById(user_id, {
      password: new_password,
    });

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
