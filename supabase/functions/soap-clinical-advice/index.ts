import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Edge Function: soap-clinical-advice
// Dipanggil terapis dari form SOAP untuk minta saran klinis berbasis
// jurnal/ebook yang sudah diunggah owner (RAG, bukan pengetahuan bebas
// model) — supaya sitasi yang muncul selalu bisa ditelusuri ke dokumen
// asli di klinik. Kalau tidak ada potongan jurnal yang cukup relevan,
// fungsi ini SENGAJA tidak menjawab (menghindari halusinasi klinis).
//
// Secrets yang wajib diset di Supabase:
//   VOYAGE_API_KEY, ANTHROPIC_API_KEY (sudah dipakai fungsi lain di project ini)

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

const EMBEDDING_MODEL = "voyage-multilingual-2";
const MATCH_COUNT = 6;
const MIN_SIMILARITY = 0.5;

async function embedQuery(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: [text],
      model: EMBEDDING_MODEL,
      input_type: "query",
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Voyage API error: ${data?.detail || data?.error?.message || response.statusText}`);
  }
  return data.data[0].embedding as number[];
}

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
    const { diagnosis, subjective, objective, assessment, plan, is_progress_stalled } = body || {};

    const clinicalContext = [
      diagnosis ? `Diagnosis: ${diagnosis}` : null,
      subjective ? `Subjective: ${subjective}` : null,
      objective ? `Objective: ${objective}` : null,
      assessment ? `Assessment: ${assessment}` : null,
      plan ? `Plan saat ini: ${plan}` : null,
    ].filter(Boolean).join("\n");

    if (!clinicalContext.trim()) {
      return json({ error: "Isi minimal Assessment sebelum meminta saran klinis." }, 400);
    }

    const voyageApiKey = Deno.env.get("VOYAGE_API_KEY");
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!voyageApiKey) return json({ error: "VOYAGE_API_KEY belum diset di secrets Supabase" }, 500);
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

    // 1) Embed konteks klinis sebagai query pencarian.
    const queryEmbedding = await embedQuery(clinicalContext, voyageApiKey);

    // 2) Cari potongan jurnal paling relevan, dibatasi ke klinik pemanggil.
    const { data: matches, error: matchError } = await admin.rpc("match_journal_chunks", {
      query_embedding: queryEmbedding,
      p_clinic_id: callerRow.clinic_id,
      match_count: MATCH_COUNT,
      min_similarity: MIN_SIMILARITY,
    });

    if (matchError) {
      console.error("match_journal_chunks error:", matchError);
      return json({ error: "Gagal mencari referensi jurnal" }, 500);
    }

    if (!matches || matches.length === 0) {
      return json({
        advice: null,
        no_reference_found: true,
        message: "Belum ada referensi jurnal yang cukup relevan di basis data klinik untuk kondisi ini. Minta owner mengunggah jurnal/guideline terkait, atau lanjutkan sesuai clinical judgement Anda.",
      });
    }

    // 3) Susun konteks jurnal untuk prompt, beri nomor referensi eksplisit
    //    supaya model harus mengaitkan tiap poin saran ke sumbernya.
    const referenceBlock = matches.map((m: any, idx: number) =>
      `[Ref ${idx + 1}] "${m.title}"${m.author ? ` — ${m.author}` : ''}${m.publication_year ? ` (${m.publication_year})` : ''}${m.page_number ? `, hal. ${m.page_number}` : ''}\n${m.content}`
    ).join("\n\n");

    const systemPrompt = `Kamu adalah asisten clinical decision support untuk fisioterapis di Indonesia. Kamu HANYA boleh memberi saran berdasarkan potongan referensi jurnal/guideline yang diberikan di bawah — JANGAN gunakan pengetahuan umum di luar itu, dan JANGAN mengarang sitasi atau studi yang tidak ada di daftar referensi.

Jika referensi yang diberikan tidak cukup untuk menjawab bagian tertentu, katakan itu secara eksplisit di bagian tersebut daripada mengarang.

Jawab SELALU dalam Bahasa Indonesia, walaupun referensi sumbernya berbahasa Inggris.

Jawab HANYA dengan JSON valid (tanpa markdown), dengan struktur:
{
  "intervensi_disarankan": "string, saran tindakan/intervensi fisioterapi berdasarkan referensi, sertakan tanda [Ref N] di kalimat yang bersangkutan",
  "latihan_disarankan": "string, saran program latihan berdasarkan referensi, sertakan tanda [Ref N]",
  "evaluasi_jika_stagnan": "string, langkah evaluasi/re-assessment yang disarankan jika perubahan pasien tidak signifikan, sertakan tanda [Ref N]",
  "catatan": "string atau null, catatan tambahan/batasan referensi yang tersedia"
}`;

    const userPrompt = `KONTEKS PASIEN SAAT INI:\n${clinicalContext}\n${is_progress_stalled ? "\nCatatan: terapis melaporkan progres pasien TIDAK signifikan pada sesi-sesi terakhir.\n" : ""}\nREFERENSI JURNAL/GUIDELINE YANG TERSEDIA DI BASIS DATA KLINIK:\n${referenceBlock}\n\nBerikan saran sesuai format JSON yang ditentukan, hanya berdasarkan referensi di atas.`;

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
    console.error("soap-clinical-advice error:", err);
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
