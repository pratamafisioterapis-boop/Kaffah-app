import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Edge Function: soap-assessment-advice
// Kebalikan dari soap-clinical-advice: dipanggil terapis SEBELUM field
// Assessment diisi (cukup modal Subjective + Objective) untuk bantu
// merumuskan kemungkinan diagnosa fisioterapi, pemeriksaan spesifik yang
// perlu dilakukan, dan hal yang perlu dievaluasi lebih lanjut — berbasis
// jurnal yang owner tandai document_scope 'assessment' atau 'both' (RAG
// via PostgreSQL full-text search, sama seperti soap-clinical-advice).
// Kalau tidak ada potongan jurnal yang cukup relevan, fungsi ini SENGAJA
// tidak menjawab (menghindari halusinasi klinis).
//
// Secrets yang wajib diset di Supabase:
//   ANTHROPIC_API_KEY (sudah dipakai fungsi lain di project ini)

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

const MATCH_COUNT = 6;

const parseModelJson = (text: string) => {
  const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch (_e) { /* coba cara kedua */ }
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(clean.slice(start, end + 1));
  } catch (_e) {
    return null;
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { diagnosis, subjective, objective } = body || {};

    const clinicalContext = [
      diagnosis ? `Diagnosis rujukan/awal: ${diagnosis}` : null,
      subjective ? `Subjective: ${subjective}` : null,
      objective ? `Objective: ${objective}` : null,
    ].filter(Boolean).join("\n");

    if (!subjective?.trim() && !objective?.trim()) {
      return json({ error: "Isi minimal Subjective atau Objective sebelum meminta saran assessment." }, 400);
    }

    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) return json({ error: "ANTHROPIC_API_KEY belum diset di secrets Supabase" }, 500);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData?.user) {
      return json({ error: "Tidak terautentikasi" }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerRow } = await admin
      .from("users")
      .select("role, clinic_id")
      .eq("id", userData.user.id)
      .single();

    if (!callerRow?.clinic_id) {
      return json({ error: "Akun tidak terhubung ke klinik manapun" }, 403);
    }

    // Cari potongan jurnal paling relevan yang ditandai untuk assessment
    // (atau 'both'), dibatasi ke klinik pemanggil.
    const { data: matches, error: matchError } = await admin.rpc("match_journal_chunks_fts", {
      query_text: clinicalContext,
      p_clinic_id: callerRow.clinic_id,
      match_count: MATCH_COUNT,
      p_scope: "assessment",
    });

    if (matchError) {
      console.error("match_journal_chunks error:", matchError);
      return json({ error: "Gagal mencari referensi jurnal" }, 500);
    }

    if (!matches || matches.length === 0) {
      return json({
        advice: null,
        no_reference_found: true,
        message: "Belum ada referensi jurnal/ebook assessment yang cukup relevan di basis data klinik untuk kondisi ini. Minta owner mengunggah jurnal/guideline assessment terkait (tandai peruntukan 'Assessment' saat menambahkan), atau lanjutkan sesuai clinical judgement Anda.",
      });
    }

    const referenceBlock = matches.map((m: any, idx: number) =>
      `[Ref ${idx + 1}] "${m.title}"${m.author ? ` — ${m.author}` : ''}${m.publication_year ? ` (${m.publication_year})` : ''}${m.page_number ? `, hal. ${m.page_number}` : ''}\n${m.content}`
    ).join("\n\n");

    const systemPrompt = `Kamu adalah asisten clinical decision support untuk fisioterapis di Indonesia, khusus membantu tahap ASSESSMENT (sebelum diagnosis fisioterapi difinalisasi). Kamu HANYA boleh memberi saran berdasarkan potongan referensi jurnal/guideline yang diberikan di bawah — JANGAN gunakan pengetahuan umum di luar itu, dan JANGAN mengarang sitasi atau studi yang tidak ada di daftar referensi. Kamu TIDAK menetapkan diagnosis final — kamu hanya membantu terapis mempersempit kemungkinan dan menentukan pemeriksaan lanjutan; keputusan akhir tetap di tangan terapis.

Jika referensi yang diberikan tidak cukup untuk menjawab bagian tertentu, katakan itu secara eksplisit di bagian tersebut daripada mengarang.

Jawab SELALU dalam Bahasa Indonesia, walaupun referensi sumbernya berbahasa Inggris.

Jawab HANYA dengan JSON valid (tanpa markdown), dengan struktur:
{
  "kemungkinan_diagnosa": "string, daftar kemungkinan diagnosis banding fisioterapi berdasarkan referensi dan data S/O yang diberikan, sertakan tanda [Ref N] di kalimat yang bersangkutan",
  "pemeriksaan_spesifik_disarankan": "string, tes/pemeriksaan khusus (special test, pengukuran, skala) yang disarankan untuk memperkuat/menyingkirkan kemungkinan diagnosis di atas, sertakan tanda [Ref N]",
  "yang_perlu_dievaluasi": "string, red flags atau hal lain yang perlu dievaluasi/diwaspadai sebelum menentukan assessment final, sertakan tanda [Ref N]",
  "catatan": "string atau null, catatan tambahan/batasan referensi yang tersedia"
}`;

    const userPrompt = `DATA PASIEN SAAT INI (sebelum Assessment ditentukan):\n${clinicalContext}\n\nREFERENSI JURNAL/GUIDELINE ASSESSMENT YANG TERSEDIA DI BASIS DATA KLINIK:\n${referenceBlock}\n\nBerikan saran sesuai format JSON yang ditentukan, hanya berdasarkan referensi di atas.`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    let response: Response;
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
    } finally {
      clearTimeout(timer);
    }

    const data = await response.json();
    if (!response.ok) {
      console.error("Anthropic API error:", JSON.stringify(data));
      return json({ error: `Anthropic API error: ${data?.error?.message || "unknown"}` }, 502);
    }

    const textBlock = (data.content || []).find((b: any) => b.type === "text");
    const parsed = parseModelJson(textBlock?.text || "");
    if (!parsed) {
      return json({ error: "Gagal memproses jawaban AI" }, 502);
    }

    return json({
      advice: parsed,
      references: matches.map((m: any, idx: number) => ({
        ref_number: idx + 1,
        document_id: m.document_id,
        title: m.title,
        author: m.author,
        publication_year: m.publication_year,
        page_number: m.page_number,
        similarity: m.similarity,
      })),
    });
  } catch (err) {
    console.error("soap-assessment-advice error:", err);
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
