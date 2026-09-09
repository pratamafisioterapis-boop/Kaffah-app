import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REFERENCE_CLINIC_ID = "bfdc3fd8-a052-4753-a5b7-229930b3237a";
const TRIAL_DAYS = 7;
const MAX_ATTEMPTS_PER_IP_PER_HOUR = 5;

// Subdomains reserved for the platform itself - kept in sync with the
// clinics_subdomain_not_reserved_check constraint and DomainSettingsManager.
const RESERVED_SUBDOMAINS = new Set([
  "www", "app", "api", "admin", "super-admin", "mail", "ftp", "clinara",
  "kaffahphysio", "staging", "preview", "dev", "localhost", "assets", "cdn",
]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Turns a clinic name into a DNS-label-safe slug, e.g. "Grand Physiocare"
// -> "grand-physiocare". Matches the clinics_subdomain_format_check
// constraint (lowercase alnum/hyphen, 3-63 chars, no leading/trailing
// hyphen).
function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");
}

// Finds a free, non-reserved subdomain derived from the clinic's name -
// appending "-2", "-3", etc. on collision - so every newly registered clinic
// gets its free `<slug>.clinara.id` site immediately, without the owner
// having to set one up manually first.
async function generateUniqueSubdomain(adminClient, clinicName, clinicId) {
  let base = slugify(clinicName);
  if (base.length < 3) {
    base = `${base}${clinicId.replace(/-/g, "").slice(0, 6)}`.slice(0, 63);
  }
  if (RESERVED_SUBDOMAINS.has(base)) {
    base = `${base}-klinik`.slice(0, 63);
  }

  for (let attempt = 0; attempt < 30; attempt++) {
    const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
    const candidate = `${base.slice(0, 63 - suffix.length)}${suffix}`;
    if (RESERVED_SUBDOMAINS.has(candidate)) continue;

    const { data: taken } = await adminClient
      .from("clinics")
      .select("id")
      .ilike("subdomain", candidate)
      .maybeSingle();
    if (!taken) return candidate;
  }

  // Extremely unlikely fallback: guarantee uniqueness via the clinic's own id.
  return `klinik-${clinicId.replace(/-/g, "").slice(0, 20)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentAttempts } = await adminClient
      .from("clinic_registration_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", oneHourAgo);

    if ((recentAttempts || 0) >= MAX_ATTEMPTS_PER_IP_PER_HOUR) {
      await adminClient.from("clinic_registration_attempts").insert({ ip, success: false });
      return json({ error: "Terlalu banyak percobaan pendaftaran. Silakan coba lagi nanti." }, 429);
    }

    const body = await req.json().catch(() => ({}));
    const clinic_name = String(body.clinic_name || "").trim();
    const owner_full_name = String(body.owner_full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = body.phone ? String(body.phone).trim() : null;
    const password = String(body.password || "");

    if (!clinic_name || !owner_full_name || !email || !password) {
      await adminClient.from("clinic_registration_attempts").insert({ ip, email, success: false });
      return json({ error: "Nama klinik, nama pemilik, email, dan password wajib diisi." }, 400);
    }
    if (!isValidEmail(email)) {
      await adminClient.from("clinic_registration_attempts").insert({ ip, email, success: false });
      return json({ error: "Format email tidak valid." }, 400);
    }
    if (password.length < 6) {
      await adminClient.from("clinic_registration_attempts").insert({ ip, email, success: false });
      return json({ error: "Password minimal 6 karakter." }, 400);
    }

    const { data: existingUser } = await adminClient
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingUser) {
      await adminClient.from("clinic_registration_attempts").insert({ ip, email, success: false });
      return json({ error: "Email ini sudah terdaftar. Silakan masuk ke akun Anda." }, 409);
    }

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: clinic, error: clinicErr } = await adminClient
      .from("clinics")
      .insert({
        name: clinic_name,
        phone,
        email,
        subscription_plan: "trial",
        subscription_status: "trial",
        trial_ends_at: trialEndsAt,
        owner_full_name,
      })
      .select()
      .single();

    if (clinicErr || !clinic) {
      return json({ error: clinicErr?.message || "Gagal membuat klinik." }, 400);
    }

    // Every clinic gets a free <slug>.clinara.id site the moment it registers -
    // no manual domain setup needed unless it wants a custom domain later.
    let subdomain = null;
    try {
      subdomain = await generateUniqueSubdomain(adminClient, clinic_name, clinic.id);
      await adminClient.from("clinics").update({ subdomain }).eq("id", clinic.id);
    } catch (_e) {
      // Non-fatal: the clinic can still set a subdomain manually later.
      subdomain = null;
    }

    try {
      const [{ data: services }, { data: diagnoses }] = await Promise.all([
        adminClient.from("operational_options").select("*").eq("clinic_id", REFERENCE_CLINIC_ID).eq("category", "service"),
        adminClient.from("operational_options").select("*").eq("clinic_id", REFERENCE_CLINIC_ID).eq("category", "diagnosa"),
      ]);
      const idMap = {};
      const newServices = (services || []).map((s) => {
        const newId = crypto.randomUUID();
        idMap[s.id] = newId;
        return {
          id: newId,
          category: s.category,
          label: s.label,
          is_active: s.is_active,
          session_count: s.session_count,
          validity_days: s.validity_days,
          parent_id: null,
          clinic_id: clinic.id,
        };
      });
      const newDiagnoses = (diagnoses || []).map((d) => ({
        id: crypto.randomUUID(),
        category: d.category,
        label: d.label,
        is_active: d.is_active,
        session_count: d.session_count,
        validity_days: d.validity_days,
        parent_id: d.parent_id ? (idMap[d.parent_id] || null) : null,
        clinic_id: clinic.id,
      }));
      if (newServices.length) await adminClient.from("operational_options").insert(newServices);
      if (newDiagnoses.length) await adminClient.from("operational_options").insert(newDiagnoses);
    } catch (_e) {
      // Non-fatal: the clinic still works with an empty Diagnosa & Layanan list.
    }

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "owner", full_name: owner_full_name },
    });

    if (createErr || !created?.user) {
      await adminClient.from("clinics").delete().eq("id", clinic.id);
      await adminClient.from("clinic_registration_attempts").insert({ ip, email, success: false });
      return json({ error: createErr?.message || "Gagal membuat akun." }, 400);
    }

    const { error: upsertErr } = await adminClient.from("users").upsert({
      id: created.user.id,
      email,
      full_name: owner_full_name,
      phone,
      role: "owner",
      clinic_id: clinic.id,
      is_active: true,
    }, { onConflict: "id" });

    if (upsertErr) {
      await adminClient.from("clinics").delete().eq("id", clinic.id);
      await adminClient.auth.admin.deleteUser(created.user.id);
      await adminClient.from("clinic_registration_attempts").insert({ ip, email, success: false });
      return json({ error: upsertErr.message }, 400);
    }

    await adminClient.from("clinics").update({ owner_id: created.user.id }).eq("id", clinic.id);
    await adminClient.from("clinic_registration_attempts").insert({ ip, email, success: true });

    return json({ success: true, clinic_id: clinic.id, trial_ends_at: trialEndsAt, subdomain });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
