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
// Subdomain gratis (klinik.clinara.id) juga lewat sini (action "set_subdomain"),
// supaya selain nulis kolom `subdomain` di tabel clinics, hostname-nya juga
// langsung didaftarkan ke Vercel sebagai domain individual (bukan wildcard -
// wildcard "*.clinara.id" butuh plan Pro/Enterprise, tapi mendaftarkan tiap
// <subdomain>.clinara.id satu-satu tidak dibatasi plan, jadi tetap jalan di
// Vercel Hobby/gratis). DNS registrar cukup satu wildcard CNAME/A record ke
// Vercel; Vercel lalu mencocokkan ke hostname-hostname yang didaftarkan di sini.

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

const CLINARA_APEX = "clinara.id";
const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;
const RESERVED_SUBDOMAINS = new Set([
  "www", "app", "api", "admin", "super-admin", "mail", "ftp", "clinara",
  "kaffahphysio", "staging", "preview", "dev", "localhost", "assets", "cdn",
]);

const vercelConfigured = () => Boolean(VERCEL_API_TOKEN && VERCEL_PROJECT_ID);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    if (action === "set_subdomain") {
      const { subdomain } = body || {};
      const clean = String(subdomain || "").trim().toLowerCase();

      if (clean) {
        if (!SUBDOMAIN_RE.test(clean)) {
          return json({ success: false, error: "Format subdomain tidak valid. Gunakan huruf kecil, angka, dan strip saja (3-63 karakter)." }, 400);
        }
        if (RESERVED_SUBDOMAINS.has(clean)) {
          return json({ success: false, error: "Subdomain ini dipakai sistem, coba nama lain." }, 400);
        }
      }

      const { error: dbErr } = await admin.from("clinics").update({ subdomain: clean || null }).eq("id", clinic_id);
      if (dbErr) {
        return json({ success: false, error: dbErr.message.includes("duplicate") ? "Subdomain ini sudah dipakai klinik lain." : dbErr.message }, 400);
      }

      // Registering the subdomain with Vercel is best-effort: the DB write
      // above is what actually controls the tenant site, so a Vercel hiccup
      // (token not configured yet, rate limit, ...) shouldn't block saving.
      let vercelRegistered = false;
      let vercelWarning = null;
      if (clean) {
        if (!vercelConfigured()) {
          vercelWarning = "Subdomain tersimpan, tapi integrasi Vercel belum dikonfigurasi (VERCEL_API_TOKEN/VERCEL_PROJECT_ID) sehingga domainnya belum otomatis aktif di Vercel.";
        } else {
          const resp = await vercelFetch(`/v10/projects/${VERCEL_PROJECT_ID}/domains`, {
            method: "POST",
            body: JSON.stringify({ name: `${clean}.${CLINARA_APEX}` }),
          });
          if (resp.ok) {
            vercelRegistered = true;
          } else {
            const data = await resp.json().catch(() => ({}));
            vercelWarning = data?.error?.message || "Subdomain tersimpan, tapi gagal didaftarkan ke Vercel.";
          }
        }
      }

      return json({ success: true, subdomain: clean || null, vercel_registered: vercelRegistered, warning: vercelWarning });
    }

    if (action === "request") {
      if (!vercelConfigured()) {
        return json({ success: false, error: "Integrasi Vercel belum dikonfigurasi (VERCEL_API_TOKEN/VERCEL_PROJECT_ID)." }, 500);
      }
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
      if (!vercelConfigured()) {
        return json({ success: false, error: "Integrasi Vercel belum dikonfigurasi (VERCEL_API_TOKEN/VERCEL_PROJECT_ID)." }, 500);
      }
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
      if (targetDomain && vercelConfigured()) {
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
