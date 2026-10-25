import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

// Sinkron appointment Kaffah -> Google Calendar pribadi terapis.
//
// Dipanggil dari dua sisi:
// - Trigger DB trg_kaffah_gcal_sync (header x-gcal-sync-secret):
//     { op: "upsert", appointment_id, prev_therapist_id? }
//     { op: "delete", appointment_id, therapist_id }
//     { op: "backfill", therapist_id }            (juga dari oauth-callback)
// - Terapis dari aplikasi (JWT), hanya untuk dirinya sendiri:
//     { op: "backfill" }   sinkron ulang jadwal mendatang
//     { op: "disconnect" } hapus event mendatang, cabut token, putuskan sambungan
//
// ID event Google = "kfh" + uuid appointment tanpa strip (karakter base32hex yang valid),
// jadi insert/update/delete bisa langsung tanpa menyimpan event id.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-gcal-sync-secret",
};

const KAFFAH_CLINIC_ID = "bfdc3fd8-a052-4753-a5b7-229930b3237a";
const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
const APP_URL = "https://kaffahphysio.id/therapist";
const BACKFILL_LIMIT = 300;

type CalendarLink = {
  physiotherapist_id: string;
  refresh_token: string;
  calendar_id: string;
};

class RevokedError extends Error {}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const eventIdFor = (appointmentId: string) => `kfh${appointmentId.replace(/-/g, "")}`;

const tokenCache = new Map<string, string>();

async function getAccessToken(admin: SupabaseClient, link: CalendarLink): Promise<string> {
  const cached = tokenCache.get(link.physiotherapist_id);
  if (cached) return cached;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: link.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.error) {
    if (data.error === "invalid_grant") {
      await admin
        .from("therapist_google_calendars")
        .update({
          last_error: "Akses Google dicabut atau kedaluwarsa. Silakan hubungkan ulang.",
          updated_at: new Date().toISOString(),
        })
        .eq("physiotherapist_id", link.physiotherapist_id);
      throw new RevokedError("invalid_grant");
    }
    throw new Error(data.error_description || data.error);
  }
  tokenCache.set(link.physiotherapist_id, data.access_token);
  return data.access_token;
}

async function getLink(admin: SupabaseClient, therapistId: string | null | undefined) {
  if (!therapistId) return null;
  const { data } = await admin
    .from("therapist_google_calendars")
    .select("physiotherapist_id, refresh_token, calendar_id")
    .eq("physiotherapist_id", therapistId)
    .maybeSingle();
  return (data as CalendarLink | null) || null;
}

function eventsUrl(link: CalendarLink, eventId?: string) {
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(link.calendar_id)}/events`;
  return eventId ? `${base}/${eventId}` : base;
}

async function googleError(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text)?.error?.message || text;
  } catch (_e) {
    return text;
  }
}

async function putEvent(admin: SupabaseClient, link: CalendarLink, eventId: string, event: Record<string, unknown>) {
  const token = await getAccessToken(admin, link);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const body = JSON.stringify({ ...event, id: eventId, status: "confirmed" });

  // Update dulu (juga menghidupkan lagi event yang pernah dibatalkan); kalau belum ada, insert.
  let res = await fetch(eventsUrl(link, eventId), { method: "PUT", headers, body });
  if (res.status === 404) {
    res = await fetch(eventsUrl(link), { method: "POST", headers, body });
    if (res.status === 409) {
      res = await fetch(eventsUrl(link, eventId), { method: "PUT", headers, body });
    }
  }
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${await googleError(res)}`);
}

async function deleteEvent(admin: SupabaseClient, link: CalendarLink, eventId: string) {
  const token = await getAccessToken(admin, link);
  const res = await fetch(eventsUrl(link, eventId), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google Calendar ${res.status}: ${await googleError(res)}`);
  }
}

const APPOINTMENT_SELECT =
  "id, clinic_id, therapist_id, appointment_date, duration_minutes, status, is_homecare, guest_name, guest_phone, guest_address, " +
  "patients(full_name, medical_record_number, phone, address), services(name), clinics(name, address)";

// deno-lint-ignore no-explicit-any
function buildEvent(appt: any) {
  const patientName = appt.patients?.full_name || appt.guest_name || "Pasien";
  const serviceName = appt.services?.name || null;
  const start = new Date(appt.appointment_date);
  const end = new Date(start.getTime() + (appt.duration_minutes || 60) * 60 * 1000);
  const homecareAddress = appt.guest_address || appt.patients?.address || null;
  const location = appt.is_homecare
    ? homecareAddress
    : [appt.clinics?.name, appt.clinics?.address].filter(Boolean).join(", ") || null;

  const lines = [
    `Pasien: ${patientName}`,
    appt.patients?.medical_record_number ? `No. RM: ${appt.patients.medical_record_number}` : null,
    serviceName ? `Layanan: ${serviceName}` : null,
    appt.is_homecare ? "Jenis: Homecare" : "Jenis: Di klinik",
    appt.is_homecare && homecareAddress ? `Alamat: ${homecareAddress}` : null,
    appt.is_homecare && (appt.patients?.phone || appt.guest_phone)
      ? `HP: ${appt.patients?.phone || appt.guest_phone}`
      : null,
    "",
    `Detail di aplikasi: ${APP_URL}`,
    "Event ini dibuat otomatis oleh Kaffah Physiotherapy — perubahan di sini tidak mengubah jadwal di aplikasi.",
  ].filter((l) => l !== null);

  return {
    summary: `${appt.is_homecare ? "Homecare" : "Fisioterapi"}: ${patientName}`,
    location,
    description: lines.join("\n"),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    reminders: { useDefault: true },
    extendedProperties: { private: { kaffah_appointment_id: appt.id } },
  };
}

async function markSynced(admin: SupabaseClient, therapistId: string, error: string | null) {
  await admin
    .from("therapist_google_calendars")
    .update({ last_synced_at: new Date().toISOString(), last_error: error, updated_at: new Date().toISOString() })
    .eq("physiotherapist_id", therapistId);
}

async function syncAppointment(admin: SupabaseClient, appointmentId: string, prevTherapistId?: string | null) {
  const { data: appt, error } = await admin
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("id", appointmentId)
    .maybeSingle();
  if (error) throw error;
  if (!appt) return { skipped: "appointment not found" };

  const eventId = eventIdFor(appt.id);

  if (prevTherapistId && prevTherapistId !== appt.therapist_id) {
    const prevLink = await getLink(admin, prevTherapistId);
    if (prevLink) {
      try {
        await deleteEvent(admin, prevLink, eventId);
      } catch (e) {
        if (!(e instanceof RevokedError)) throw e;
      }
    }
  }

  if (appt.clinic_id !== KAFFAH_CLINIC_ID) return { skipped: "not kaffah" };
  const link = await getLink(admin, appt.therapist_id);
  if (!link) return { skipped: "therapist not connected" };

  if (appt.status === "cancelled") {
    await deleteEvent(admin, link, eventId);
  } else {
    await putEvent(admin, link, eventId, buildEvent(appt));
  }
  await markSynced(admin, link.physiotherapist_id, null);
  return { synced: true };
}

async function upcomingAppointments(admin: SupabaseClient, therapistId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("therapist_id", therapistId)
    .eq("clinic_id", KAFFAH_CLINIC_ID)
    .gte("appointment_date", since)
    .order("appointment_date", { ascending: true })
    .limit(BACKFILL_LIMIT);
  if (error) throw error;
  return data || [];
}

async function backfill(admin: SupabaseClient, therapistId: string) {
  const link = await getLink(admin, therapistId);
  if (!link) return { skipped: "therapist not connected" };

  const appts = await upcomingAppointments(admin, therapistId);
  let synced = 0;
  let failed = 0;
  let lastError: string | null = null;
  for (const appt of appts) {
    try {
      if (appt.status === "cancelled") {
        await deleteEvent(admin, link, eventIdFor(appt.id));
      } else {
        await putEvent(admin, link, eventIdFor(appt.id), buildEvent(appt));
      }
      synced++;
    } catch (e) {
      if (e instanceof RevokedError) throw e;
      failed++;
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  await markSynced(admin, therapistId, failed ? `${failed} jadwal gagal disinkronkan: ${lastError}` : null);
  return { synced, failed };
}

async function disconnect(admin: SupabaseClient, therapistId: string) {
  const link = await getLink(admin, therapistId);
  if (!link) return { disconnected: true };

  try {
    const appts = await upcomingAppointments(admin, therapistId);
    const now = Date.now();
    for (const appt of appts) {
      if (new Date(appt.appointment_date).getTime() < now) continue;
      try {
        await deleteEvent(admin, link, eventIdFor(appt.id));
      } catch (e) {
        if (e instanceof RevokedError) throw e;
      }
    }
  } catch (e) {
    if (!(e instanceof RevokedError)) console.error("disconnect cleanup failed:", e);
  }

  try {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: link.refresh_token }),
    });
  } catch (_e) {
    // token tetap dihapus dari DB walau revoke gagal
  }

  const { error } = await admin.from("therapist_google_calendars").delete().eq("physiotherapist_id", therapistId);
  if (error) throw error;
  return { disconnected: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try {
    body = await req.json();
  } catch (_e) {
    return json({ error: "Invalid JSON" }, 400);
  }

  try {
    const secret = req.headers.get("x-gcal-sync-secret");
    const { data: syncSecret } = secret ? await admin.rpc("kaffah_gcal_sync_secret") : { data: null };
    if (syncSecret && secret === syncSecret) {
      if (body.op === "upsert" && body.appointment_id) {
        return json(await syncAppointment(admin, body.appointment_id, body.prev_therapist_id));
      }
      if (body.op === "delete" && body.appointment_id && body.therapist_id) {
        const link = await getLink(admin, body.therapist_id);
        if (link) await deleteEvent(admin, link, eventIdFor(body.appointment_id));
        return json({ deleted: true });
      }
      if (body.op === "backfill" && body.therapist_id) {
        return json(await backfill(admin, body.therapist_id));
      }
      return json({ error: "Unknown op" }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const { data: callerData, error: callerErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (callerErr || !callerData?.user) return json({ error: "Invalid session" }, 401);

    const { data: therapist } = await admin
      .from("physiotherapists")
      .select("id, clinic_id")
      .eq("user_id", callerData.user.id)
      .maybeSingle();
    if (!therapist) return json({ error: "Akun ini bukan terapis" }, 403);

    if (body.op === "backfill") {
      if (therapist.clinic_id !== KAFFAH_CLINIC_ID) return json({ error: "Fitur khusus Kaffah Physiotherapy" }, 403);
      return json(await backfill(admin, therapist.id));
    }
    if (body.op === "disconnect") {
      return json(await disconnect(admin, therapist.id));
    }
    return json({ error: "Unknown op" }, 400);
  } catch (error) {
    if (error instanceof RevokedError) {
      return json({ error: "Akses Google dicabut atau kedaluwarsa. Silakan hubungkan ulang." }, 409);
    }
    console.error("therapist-gcal-sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    if (body?.appointment_id) {
      const { data: appt } = await admin
        .from("appointments")
        .select("therapist_id")
        .eq("id", body.appointment_id)
        .maybeSingle();
      const therapistId = appt?.therapist_id || body.therapist_id;
      if (therapistId) await markSynced(admin, therapistId, message).catch(() => {});
    }
    return json({ error: message }, 500);
  }
});
