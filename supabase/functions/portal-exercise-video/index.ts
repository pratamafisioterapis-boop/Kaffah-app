// Tautan putar video latihan untuk pasien (portal Clinara), tanpa login.
// Pasien mengirim token sesi + kode latihan. Fungsi portal_video_path (hanya service role)
// memastikan sesi valid, klinik mengaktifkan fitur, latihan ada di program pasien, dan videonya
// ada. Baru setelah itu dibuat tautan bertanda tangan 1 jam ke bucket privat exercise-videos.
// Skema: supabase/manual/9_portal_pasien_clinara.sql
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { session, exercise_id } = await req.json();
    if (typeof session !== "string" || typeof exercise_id !== "string" || !session || !exercise_id) {
      return json({ error: "Permintaan tidak lengkap" }, 400);
    }
    // Token sesi sekitar 32 karakter dan kode latihan pendek (mis. AK01); tolak masukan yang tidak wajar.
    if (session.length > 128 || exercise_id.length > 32) {
      return json({ error: "Permintaan tidak valid" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: path, error } = await admin.rpc("portal_video_path", {
      p_session: session,
      p_exercise_id: exercise_id,
    });
    if (error || !path) return json({ error: "Video tidak tersedia" }, 404);

    const { data, error: signError } = await admin.storage.from("exercise-videos").createSignedUrl(path, 3600);
    if (signError || !data?.signedUrl) return json({ error: "Video tidak tersedia" }, 404);

    return json({ url: data.signedUrl });
  } catch (_e) {
    return json({ error: "Terjadi kesalahan" }, 500);
  }
});
