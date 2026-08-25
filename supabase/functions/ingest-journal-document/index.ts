import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

// Edge Function: ingest-journal-document
// Dipanggil owner setelah upload PDF jurnal/ebook ke bucket
// `journal-documents`. Mengekstrak teks, memecahnya jadi potongan
// (chunks), membuat embedding multilingual (Voyage AI), lalu menyimpan
// ke tabel journal_chunks untuk dipakai fitur "Saran Klinis AI".
//
// Secrets yang wajib diset di Supabase (Project Settings > Edge Functions):
//   VOYAGE_API_KEY        - untuk embedding (model voyage-multilingual-2)
//   SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL - sudah tersedia otomatis
//
// Catatan batasan: edge function punya batas wall-clock ~150 detik, jadi
// dokumen yang sangat tebal (ratusan halaman) bisa gagal di tengah proses.
// Untuk v1, itu ditandai status 'failed' dengan pesan jelas — owner bisa
// coba lagi dengan dokumen yang dipecah lebih kecil.

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
const EMBEDDING_BATCH_SIZE = 10;
const CHUNK_TARGET_CHARS = 2800; // ~700 token
const CHUNK_OVERLAP_CHARS = 250;
const MAX_CHUNKS_PER_DOCUMENT = 500; // pengaman supaya tidak melebihi wall-clock limit

type PageChunk = { pageNumber: number; content: string };

function chunkPageText(pageNumber: number, text: string): PageChunk[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_TARGET_CHARS) {
    return [{ pageNumber, content: clean }];
  }
  const chunks: PageChunk[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + CHUNK_TARGET_CHARS, clean.length);
    chunks.push({ pageNumber, content: clean.slice(start, end) });
    if (end >= clean.length) break;
    start = end - CHUNK_OVERLAP_CHARS;
  }
  return chunks;
}

// Embedding adalah bagian terlama dari proses (bisa puluhan detik untuk
// dokumen tebal), jadi progress dilaporkan per batch lewat onBatchDone
// supaya owner bisa lihat persentase berjalan, bukan cuma "Memproses"
// diam tanpa indikasi seberapa jauh.
async function embedTexts(
  texts: string[],
  apiKey: string,
  onBatchDone: (completed: number, total: number) => Promise<void>
): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: batch,
        model: EMBEDDING_MODEL,
        input_type: "document",
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Voyage API error: ${data?.detail || data?.error?.message || response.statusText}`);
    }
    const embeddings = (data.data || []).map((d: any) => d.embedding as number[]);
    results.push(...embeddings);
    await onBatchDone(results.length, texts.length);
  }
  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { document_id } = await req.json();
    if (!document_id) {
      return json({ error: "document_id wajib diisi" }, 400);
    }

    const voyageApiKey = Deno.env.get("VOYAGE_API_KEY");
    if (!voyageApiKey) {
      return json({ error: "VOYAGE_API_KEY belum diset di secrets Supabase" }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    // Verifikasi identitas pemanggil pakai token asli mereka (bukan
    // service role) supaya kita tahu clinic_id & role sebenarnya.
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

    if (!callerRow || !["owner", "admin", "super_admin"].includes(callerRow.role)) {
      return json({ error: "Hanya owner/admin klinik yang boleh memproses dokumen jurnal" }, 403);
    }

    const { data: doc, error: docError } = await admin
      .from("journal_documents")
      .select("*")
      .eq("id", document_id)
      .single();

    if (docError || !doc) {
      return json({ error: "Dokumen tidak ditemukan" }, 404);
    }
    if (doc.clinic_id !== callerRow.clinic_id) {
      return json({ error: "Dokumen bukan milik klinik Anda" }, 403);
    }

    try {
      const { data: fileBlob, error: downloadError } = await admin.storage
        .from("journal-documents")
        .download(doc.file_path);
      if (downloadError || !fileBlob) {
        throw new Error(downloadError?.message || "Gagal mengunduh file dari storage");
      }

      const arrayBuffer = await fileBlob.arrayBuffer();
      const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
      const { totalPages, text } = await extractText(pdf, { mergePages: false });

      const pageTexts: string[] = Array.isArray(text) ? text : [String(text)];
      let allChunks: PageChunk[] = [];
      for (let i = 0; i < pageTexts.length; i++) {
        allChunks.push(...chunkPageText(i + 1, pageTexts[i]));
      }

      if (allChunks.length === 0) {
        throw new Error("Tidak ada teks yang bisa diekstrak dari PDF ini (kemungkinan hasil scan tanpa OCR).");
      }

      let truncated = false;
      if (allChunks.length > MAX_CHUNKS_PER_DOCUMENT) {
        allChunks = allChunks.slice(0, MAX_CHUNKS_PER_DOCUMENT);
        truncated = true;
      }

      // Ekstraksi teks dianggap 5%, embedding (bagian terlama) 5-90%,
      // sisanya (insert ke DB + finalisasi) 90-100%.
      await admin.from("journal_documents").update({ progress_percent: 5 }).eq("id", doc.id);

      const embeddings = await embedTexts(
        allChunks.map((c) => c.content),
        voyageApiKey,
        async (completed, total) => {
          const pct = 5 + Math.round((completed / total) * 85);
          await admin.from("journal_documents").update({ progress_percent: pct }).eq("id", doc.id);
        }
      );

      const rows = allChunks.map((chunk, idx) => ({
        document_id: doc.id,
        clinic_id: doc.clinic_id,
        chunk_index: idx,
        page_number: chunk.pageNumber,
        content: chunk.content,
        embedding: embeddings[idx],
      }));

      // Insert per-batch supaya payload tidak terlalu besar sekali kirim.
      const INSERT_BATCH = 100;
      for (let i = 0; i < rows.length; i += INSERT_BATCH) {
        const { error: insertError } = await admin.from("journal_chunks").insert(rows.slice(i, i + INSERT_BATCH));
        if (insertError) throw new Error(insertError.message);
        const pct = 90 + Math.round(((i + INSERT_BATCH) / rows.length) * 10);
        await admin.from("journal_documents").update({ progress_percent: Math.min(pct, 99) }).eq("id", doc.id);
      }

      await admin
        .from("journal_documents")
        .update({
          status: "ready",
          progress_percent: 100,
          page_count: totalPages,
          error_message: truncated
            ? `Dokumen dipotong ke ${MAX_CHUNKS_PER_DOCUMENT} potongan pertama karena terlalu tebal untuk diproses sekaligus.`
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", doc.id);

      return json({ success: true, chunks_created: rows.length, page_count: totalPages, truncated });
    } catch (processErr) {
      await admin
        .from("journal_documents")
        .update({
          status: "failed",
          error_message: String((processErr as Error)?.message || processErr),
          updated_at: new Date().toISOString(),
        })
        .eq("id", doc.id);
      throw processErr;
    }
  } catch (err) {
    console.error("ingest-journal-document error:", err);
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});
