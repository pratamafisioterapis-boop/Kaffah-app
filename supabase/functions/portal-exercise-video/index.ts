// Tautan putar video latihan untuk pasien (portal Clinara), tanpa login.
// Pasien mengirim token sesi + kode latihan. Fungsi portal_video_path (hanya service role)
// memastikan sesi valid, klinik mengaktifkan fitur, latihan ada di program pasien, dan videonya
// ada. Baru setelah itu dibuat tautan bertanda tangan 1 jam ke bucket privat exercise-videos.
// Mode daftar (exercise_ids) mengembalikan tautan video + gambar sampul semua latihan dalam satu
// panggilan, supaya halaman Latihan tidak memanggil fungsi ini sekali per kartu.
// Sampul disimpan di posters/<kode>.jpg (dibuat saat Super Admin mengunggah video).
// Skema: supabase/manual/9_portal_pasien_clinara.sql
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "exercise-videos";
const TTL = 3600;
const MAX_IDS = 50;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const validId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 32;
const posterPath = (exerciseId: string) => `posters/${exerciseId}.jpg`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { session, exercise_id, exercise_ids } = await req.json();
    // Token sesi sekitar 32 karakter dan kode latihan pendek (mis. AK01); tolak masukan yang tidak wajar.
    if (typeof session !== "string" || !session || session.length > 128) {
      return json({ error: "Permintaan tidak valid" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const storage = admin.storage.from(BUCKET);

    if (Array.isArray(exercise_ids)) {
      const ids = [...new Set(exercise_ids)].slice(0, MAX_IDS);
      if (!ids.every(validId)) return json({ error: "Permintaan tidak valid" }, 400);

      const paths = await Promise.all(ids.map(async (id) => {
        const { data, error } = await admin.rpc("portal_video_path", { p_session: session, p_exercise_id: id });
        return error || !data ? null : (data as string);
      }));
      const allowed = ids.filter((_, i) => paths[i]);
      const items: Record<string, { url: string | null; poster: string | null }> = {};
      if (allowed.length === 0) return json({ items });

      const videoPaths = paths.filter(Boolean) as string[];
      const [videos, posters] = await Promise.all([
        storage.createSignedUrls(videoPaths, TTL),
        storage.createSignedUrls(allowed.map(posterPath), TTL),
      ]);
      allowed.forEach((id, i) => {
        const v = videos.data?.[i];
        const p = posters.data?.[i];
        items[id] = {
          url: v && !v.error && v.signedUrl ? v.signedUrl : null,
          poster: p && !p.error && p.signedUrl ? p.signedUrl : null,
        };
      });
      return json({ items });
    }

    if (!validId(exercise_id)) return json({ error: "Permintaan tidak lengkap" }, 400);

    const { data: path, error } = await admin.rpc("portal_video_path", {
      p_session: session,
      p_exercise_id: exercise_id,
    });
    if (error || !path) return json({ error: "Video tidak tersedia" }, 404);

    const { data, error: signError } = await storage.createSignedUrl(path, TTL);
    if (signError || !data?.signedUrl) return json({ error: "Video tidak tersedia" }, 404);

    return json({ url: data.signedUrl });
  } catch (_e) {
    return json({ error: "Terjadi kesalahan" }, 500);
  }
});
