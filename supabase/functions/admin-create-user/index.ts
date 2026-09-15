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

    if (profileErr || !callerProfile) {
      return new Response(JSON.stringify({ error: "Profil pemanggil tidak ditemukan" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, password, full_name, phone, role, clinic_id } = body;

    if (!email || !password || !full_name || !role) {
      return new Response(JSON.stringify({ error: "email, password, full_name, role wajib diisi" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSuperAdmin = callerProfile.role === "super_admin";
    const isOwnerCreatingStaff =
      callerProfile.role === "owner" &&
      clinic_id === callerProfile.clinic_id &&
      ["admin", "clinic_admin", "therapist", "physiotherapist", "owner"].includes(role);

    if (!isSuperAdmin && !isOwnerCreatingStaff) {
      return new Response(JSON.stringify({ error: "Forbidden: tidak punya izin membuat akun ini" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, full_name },
    });

    if (createErr || !created?.user) {
      return new Response(JSON.stringify({ error: createErr?.message || "Gagal membuat akun auth" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: upsertErr } = await adminClient.from("users").upsert({
      id: created.user.id,
      email,
      full_name,
      phone: phone || null,
      role,
      clinic_id: clinic_id || null,
      is_active: true,
    }, { onConflict: "id" });

    if (upsertErr) {
      return new Response(JSON.stringify({ error: upsertErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, user_id: created.user.id }), {
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
