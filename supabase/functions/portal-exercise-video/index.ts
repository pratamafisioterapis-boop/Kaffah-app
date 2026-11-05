// Tautan putar video latihan untuk pasien (portal Clinara), tanpa login.
// Pasien mengirim token sesi + kode latihan. Fungsi portal_video_path (hanya service role)
// memastikan sesi valid, klinik mengaktifkan fitur, latihan ada di program pasien, dan videonya
// ada. Baru setelah itu dibuat tautan bertanda tangan 1 jam ke bucket privat exercise-videos.
// Mode daftar (exercise_ids) mengembalikan tautan video + gambar sampul semua latihan dalam satu
// panggilan, supaya halaman Latihan tidak memanggil fungsi ini sekali per kartu.
// Foto ilustrasi (latihan tanpa video) dikembalikan sebagai items[kode].image dari bucket exercise-illustrations.
// Sampul disimpan di posters/<kode>.jpg (dibuat saat Super Admin mengunggah video).
// Skema: supabase/manual/9_portal_pasien_clinara.sql
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "exercise-videos";
const ILLUSTRATION_BUCKET = "exercise-illustrations";
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

      // Tiap latihan bisa punya video (+ sampul) dan/atau foto ilustrasi. Keduanya dicek terhadap program pasien.
      const rpcPath = async (fn: string, id: string) => {
        const { data, error } = await admin.rpc(fn, { p_session: session, p_exercise_id: id });
        return error || !data ? null : (data as string);
      };
      const [vPaths, iPaths] = await Promise.all([
        Promise.all(ids.map((id) => rpcPath("portal_video_path", id))),
        Promise.all(ids.map((id) => rpcPath("portal_illustration_path", id))),
      ]);
      type Item = { url: string | null; poster: string | null; image: string | null; images: { step_number: number; url: string }[] };
      const items: Record<string, Item> = {};
      const withVideo = ids.filter((_, i) => vPaths[i]);
      const withImage = ids.filter((_, i) => iPaths[i]);
      ids.forEach((id, i) => { if (vPaths[i] || iPaths[i]) items[id] = { url: null, poster: null, image: null, images: [] }; });
      if (Object.keys(items).length === 0) return json({ items });

      const illusStorage = admin.storage.from(ILLUSTRATION_BUCKET);
      const [videos, posters, images] = await Promise.all([
        withVideo.length ? storage.createSignedUrls(withVideo.map((id) => vPaths[ids.indexOf(id)] as string), TTL) : null,
        withVideo.length ? storage.createSignedUrls(withVideo.map(posterPath), TTL) : null,
        withImage.length ? illusStorage.createSignedUrls(withImage.map((id) => iPaths[ids.indexOf(id)] as string), TTL) : null,
      ]);
      withVideo.forEach((id, i) => {
        const v = videos?.data?.[i];
        const p = posters?.data?.[i];
        items[id].url = v && !v.error && v.signedUrl ? v.signedUrl : null;
        items[id].poster = p && !p.error && p.signedUrl ? p.signedUrl : null;
      });
      withImage.forEach((id, i) => {
        const m = images?.data?.[i];
        items[id].image = m && !m.error && m.signedUrl ? m.signedUrl : null;
      });
      // Only query steps for IDs already authorized by portal_illustration_path.
      // Never sign arbitrary paths supplied by a caller.
      if (withImage.length) {
        const { data: steps, error: stepError } = await admin
          .from("exercise_illustration_steps")
          .select("exercise_id, step_number, storage_path")
          .in("exercise_id", withImage).order("step_number");
        if (stepError) throw stepError;
        if (steps?.length) {
          const { data: signed, error: signingError } = await illusStorage
            .createSignedUrls(steps.map((step) => step.storage_path), TTL);
          if (signingError) throw signingError;
          steps.forEach((step, index) => {
            const result = signed?.[index];
            if (result?.signedUrl && !result.error) {
              items[step.exercise_id].images.push({ step_number: step.step_number, url: result.signedUrl });
            }
          });
        }
      }
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
