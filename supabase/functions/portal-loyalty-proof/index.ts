// Unggah bukti Misi Kaffah dari portal pasien (tanpa login).
// Pasien mengirim token sesi + jenis misi + gambar (base64). Fungsi portal_loyalty_proof_target
// (hanya service role) memastikan sesi valid, program aktif, dan misi boleh dikirim. Gambar lalu
// disimpan ke bucket privat loyalty-proofs di <clinic>/<patient>/..., dan dicatat lewat
// portal_loyalty_submit. Staf melihatnya lewat tautan bertanda tangan dari aplikasi staf.
// Skema: supabase/migrations/20261102100000_kaffah_misi_loyalty.sql
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "loyalty-proofs";
const MAX_BYTES = 3 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const decode = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { session, mission_type, content_type, image_base64 } = await req.json();
    if (typeof session !== "string" || !session || session.length > 128) return json({ error: "Permintaan tidak valid" }, 400);
    if (typeof mission_type !== "string") return json({ error: "Permintaan tidak valid" }, 400);
    const ext = EXT[content_type as string];
    if (!ext || typeof image_base64 !== "string" || image_base64.length > MAX_BYTES * 1.4) {
      return json({ error: "Gambar harus JPG, PNG, atau WebP dan maksimal 3 MB" }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: target, error: targetError } = await admin.rpc("portal_loyalty_proof_target", {
      p_session: session,
      p_type: mission_type,
    });
    if (targetError || !target) {
      const sessionInvalid = targetError?.code === "28000";
      return json({ error: targetError?.message || "Tidak bisa mengirim bukti", session_invalid: sessionInvalid }, sessionInvalid ? 401 : 400);
    }

    let bytes: Uint8Array;
    try { bytes = decode(image_base64); } catch { return json({ error: "Gambar rusak" }, 400); }
    if (bytes.length === 0 || bytes.length > MAX_BYTES) return json({ error: "Ukuran gambar tidak valid" }, 400);

    const path = `${target.clinic_id}/${target.patient_id}/${mission_type}-${Date.now()}.${ext}`;
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: content_type, upsert: false });
    if (uploadError) return json({ error: "Gagal menyimpan gambar" }, 500);

    const { error: submitError } = await admin.rpc("portal_loyalty_submit", {
      p_session: session,
      p_type: mission_type,
      p_path: path,
    });
    if (submitError) {
      await admin.storage.from(BUCKET).remove([path]);
      return json({ error: submitError.message }, 400);
    }
    return json({ ok: true });
  } catch (_e) {
    return json({ error: "Terjadi kesalahan" }, 500);
  }
});
