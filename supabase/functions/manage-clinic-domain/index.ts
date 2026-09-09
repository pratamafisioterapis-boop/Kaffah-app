import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Edge Function: manage-clinic-domain
//
// Dipanggil dari halaman "Domain Klinik" (Owner Settings) untuk
// menghubungkan/memutus custom domain milik klinik (mis. kliniksehat.com)
// ke deployment Vercel yang sama. Butuh service role key (untuk baca/tulis
// tabel clinics tanpa terikat RLS setelah otorisasi manual) plus token
// Vercel supaya domain benar-benar terdaftar di project Vercel-nya.
//
// Secrets yang wajib diset di Supabase:
//   VERCEL_API_TOKEN   - personal/team access token dari vercel.com/account/tokens
//   VERCEL_PROJECT_ID  - project id (atau nama project) dari project ini di Vercel
//   VERCEL_TEAM_ID     - opsional, hanya kalau project ada di bawah sebuah Team
//
// Subdomain gratis (klinik.clinara.id) TIDAK lewat sini - itu cukup kolom
// `subdomain` di tabel clinics yang diupdate langsung dari frontend (RLS
// sudah izinkan owner update baris klinik miliknya sendiri), karena wildcard
// DNS *.clinara.id sudah diarahkan ke deployment yang sama.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const VERCEL_API_TOKEN = Deno.env.get("VERCEL_API_TOKEN");
const VERCEL_PROJECT_ID = Deno.env.get("VERCEL_PROJECT_ID");
const VERCEL_TEAM_ID = Deno.env.get("VERCEL_TEAM_ID") || "";

const vercelUrl = (path: string) => {
  const url = new URL(`https://api.vercel.com${path}`);
  if (VERCEL_TEAM_ID) url.searchParams.set("teamId", VERCEL_TEAM_ID);
  return url.toString();
};

const vercelFetch = (path: string, init: RequestInit = {}) =>
  fetch(vercelUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${VERCEL_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!VERCEL_API_TOKEN || !VERCEL_PROJECT_ID) {
    return json({ success: false, error: "Integrasi Vercel belum dikonfigurasi (VERCEL_API_TOKEN/VERCEL_PROJECT_ID)." }, 500);
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ success: false, error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ success: false, error: "Unauthorized" }, 401);

    const { data: profile, error: profileErr } = await admin
      .from("users")
      .select("role, clinic_id")
      .eq("id", userData.user.id)
      .single();
    if (profileErr || !profile) return json({ success: false, error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { action, clinic_id, domain } = body || {};

    if (!clinic_id) return json({ success: false, error: "clinic_id wajib diisi." }, 400);

    const isSuperAdmin = profile.role === "super_admin";
    const isClinicOwner = ["owner", "admin", "clinic_admin"].includes(profile.role) && profile.clinic_id === clinic_id;
    if (!isSuperAdmin && !isClinicOwner) {
      return json({ success: false, error: "Anda tidak punya akses ke klinik ini." }, 403);
    }

    if (action === "request") {
      const cleanDomain = String(domain || "").trim().toLowerCase();
      if (!DOMAIN_RE.test(cleanDomain)) {
        return json({ success: false, error: "Format domain tidak valid." }, 400);
      }

      const resp = await vercelFetch(`/v10/projects/${VERCEL_PROJECT_ID}/domains`, {
        method: "POST",
        body: JSON.stringify({ name: cleanDomain }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        return json({ success: false, error: data?.error?.message || "Gagal menambahkan domain ke Vercel." }, resp.status);
      }

      const { error: dbErr } = await admin
        .from("clinics")
        .update({ custom_domain: cleanDomain, custom_domain_status: "pending", custom_domain_verified_at: null })
        .eq("id", clinic_id);
      if (dbErr) return json({ success: false, error: dbErr.message }, 500);

      return json({
        success: true,
        status: "pending",
        verification: data.verification || [],
        apex: !cleanDomain.includes("www.") && cleanDomain.split(".").length === 2,
      });
    }

    if (action === "check_status") {
      const { data: clinic } = await admin.from("clinics").select("custom_domain").eq("id", clinic_id).single();
      const targetDomain = clinic?.custom_domain;
      if (!targetDomain) return json({ success: false, error: "Klinik ini belum punya custom domain." }, 400);

      const resp = await vercelFetch(`/v9/projects/${VERCEL_PROJECT_ID}/domains/${targetDomain}/config`);
      const data = await resp.json();
      if (!resp.ok) {
        return json({ success: false, error: data?.error?.message || "Gagal mengecek status domain." }, resp.status);
      }

      const verified = data.misconfigured === false;
      const newStatus = verified ? "verified" : "pending";
      await admin
        .from("clinics")
        .update({
          custom_domain_status: newStatus,
          custom_domain_verified_at: verified ? new Date().toISOString() : null,
        })
        .eq("id", clinic_id);

      return json({ success: true, status: newStatus, misconfigured: data.misconfigured });
    }

    if (action === "remove") {
      const { data: clinic } = await admin.from("clinics").select("custom_domain").eq("id", clinic_id).single();
      const targetDomain = clinic?.custom_domain;
      if (targetDomain) {
        await vercelFetch(`/v9/projects/${VERCEL_PROJECT_ID}/domains/${targetDomain}`, { method: "DELETE" });
      }
      const { error: dbErr } = await admin
        .from("clinics")
        .update({ custom_domain: null, custom_domain_status: "none", custom_domain_verified_at: null })
        .eq("id", clinic_id);
      if (dbErr) return json({ success: false, error: dbErr.message }, 500);
      return json({ success: true });
    }

    return json({ success: false, error: "Action tidak dikenal." }, 400);
  } catch (err) {
    return json({ success: false, error: String(err) }, 500);
  }
});
