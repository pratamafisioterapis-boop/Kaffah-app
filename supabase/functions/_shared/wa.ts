import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export const GRAPH_VERSION = "v21.0";
export const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/** 0812… / +62812… / 812… → 62812… (format wa_id Meta). */
export function normalizePhone(raw: string): string {
  let p = (raw || "").replace(/\D/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  else if (p.startsWith("8")) p = "62" + p;
  return p;
}

export type Caller = { userId: string; role: string; clinicId: string | null };

/** Validasi JWT pemanggil lalu ambil role + klinik dari tabel users. */
export async function getCaller(
  req: Request,
  admin: SupabaseClient,
): Promise<Caller | null> {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) return null;
  const callerClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await callerClient.auth.getUser();
  if (error || !data?.user) return null;
  const { data: row } = await admin
    .from("users")
    .select("role, clinic_id")
    .eq("id", data.user.id)
    .single();
  if (!row) return null;
  return { userId: data.user.id, role: row.role, clinicId: row.clinic_id };
}

export type MetaAccount = {
  clinic_id: string;
  waba_id: string;
  phone_number_id: string;
  enabled: boolean;
  token: string;
};

export async function loadAccount(
  admin: SupabaseClient,
  clinicId: string,
): Promise<MetaAccount | null> {
  const { data: acc } = await admin
    .from("wa_meta_accounts")
    .select("clinic_id, waba_id, phone_number_id, enabled")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (!acc) return null;
  const { data: cred } = await admin
    .from("wa_meta_credentials")
    .select("access_token")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (!cred?.access_token) return null;
  return { ...acc, token: cred.access_token };
}

export class MetaError extends Error {
  code: string;
  constructor(message: string, code = "") {
    super(message);
    this.code = code;
  }
}

/** Panggil Graph API; lempar MetaError dengan pesan asli dari Meta bila gagal. */
export async function graph(
  path: string,
  token: string,
  init: { method?: string; body?: unknown } = {},
): Promise<any> {
  const res = await fetch(`${GRAPH}${path}`, {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    const e = data?.error || {};
    const detail = e.error_user_msg || e.message || `HTTP ${res.status}`;
    throw new MetaError(detail, String(e.code ?? res.status));
  }
  return data;
}

export const WINDOW_MS = 24 * 60 * 60 * 1000;

export function windowOpen(lastInboundAt: string | null | undefined): boolean {
  if (!lastInboundAt) return false;
  return Date.now() - new Date(lastInboundAt).getTime() < WINDOW_MS;
}

/** Ambil atau buat percakapan untuk (klinik, nomor), tautkan ke pasien bila cocok. */
export async function ensureConversation(
  admin: SupabaseClient,
  clinicId: string,
  waId: string,
  contactName?: string | null,
) {
  const { data: existing } = await admin
    .from("wa_inbox_conversations")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("wa_id", waId)
    .maybeSingle();
  if (existing) {
    const patch: Record<string, unknown> = {};
    if (contactName && contactName !== existing.contact_name) {
      patch.contact_name = contactName;
    }
    if (!existing.patient_id) {
      const pid = await findPatientId(admin, clinicId, waId);
      if (pid) patch.patient_id = pid;
    }
    if (Object.keys(patch).length) {
      await admin.from("wa_inbox_conversations").update(patch).eq("id", existing.id);
      return { ...existing, ...patch };
    }
    return existing;
  }
  const patientId = await findPatientId(admin, clinicId, waId);
  const { data: created, error } = await admin
    .from("wa_inbox_conversations")
    .insert({
      clinic_id: clinicId,
      wa_id: waId,
      contact_name: contactName || null,
      patient_id: patientId,
    })
    .select("*")
    .single();
  if (error) {
    // Balapan dua webhook bersamaan: ambil yang sudah dibuat pihak lain.
    const { data: again } = await admin
      .from("wa_inbox_conversations")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("wa_id", waId)
      .single();
    return again;
  }
  return created;
}

async function findPatientId(
  admin: SupabaseClient,
  clinicId: string,
  waId: string,
): Promise<string | null> {
  const { data } = await admin.rpc("wa_find_patient", {
    p_clinic_id: clinicId,
    p_wa_id: waId,
  });
  return (data as string | null) ?? null;
}
