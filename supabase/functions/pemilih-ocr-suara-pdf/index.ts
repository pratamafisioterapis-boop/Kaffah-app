import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Edge Function: pemilih-ocr-suara-pdf
// Menerima satu halaman gambar (base64) dari dokumen Sertifikat Rekapitulasi
// (Model DAA1-DPRD/DPRK atau sejenis) lalu mentranskripsi tabel "DATA PEROLEHAN
// SUARA PARTAI POLITIK DAN CALON" pada halaman tersebut menjadi JSON terstruktur.
// Wajib set secret ANTHROPIC_API_KEY di Supabase (Project Settings > Edge Functions > Secrets).
//
// Catatan penting soal ukuran output (penyebab kegagalan sebelumnya):
// satu halaman DAA1 bisa memuat ~18 partai x belasan calon x belasan kolom TPS.
// Ditulis sebagai JSON "gemuk" (satu objek per baris dengan nama field lengkap),
// hasilnya menembus 4096 token -> jawaban model kepotong di tengah -> JSON.parse
// gagal -> semua halaman balik 502. Karena itu di sini:
//   1. model diminta menjawab dengan format TUPLE ringkas (hemat ~60% token),
//      lalu di-expand lagi di server ke bentuk objek yang dipakai frontend;
//   2. `party_filter` bikin model cuma menyalin baris partai yang diminta;
//   3. max_tokens dinaikkan, dan kondisi terpotong (stop_reason max_tokens)
//      dideteksi eksplisit supaya pesan errornya jelas, bukan "gagal parsing".
//
// Catatan: model ini TIDAK mendukung assistant message prefill (percakapan
// wajib diakhiri pesan role "user"), jadi kalimat pembuka di luar JSON diatasi
// lewat parseModelJson (ambil objek JSON pertama), bukan lewat prefill "{".

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

const DEFAULT_MAX_TOKENS = 16000;
// Batas waktu panggilan ke Anthropic. Halaman dengan tabel padat (banyak
// kolom TPS) butuh waktu jauh lebih lama untuk dibaca teliti daripada halaman
// "sisa" yang kolomnya sedikit — dari log produksi, halaman padat rutin lewat
// 120 detik sementara halaman ringan selesai dalam ~15 detik. Edge function
// punya batas wall-clock sendiri (~150 detik di Supabase), jadi kita ambil
// margin di bawahnya dan menyerah duluan dengan pesan yang jelas daripada
// koneksinya diputus runtime tanpa keterangan.
const ANTHROPIC_TIMEOUT_MS = 140000;

const buildSystemPrompt = (partyFilter: string | null, isPartial: boolean) => {
  const scope = partyFilter
    ? `RUANG LINGKUP: pada halaman ini kamu HANYA menyalin baris milik partai "${partyFilter}" (cocokkan secara longgar, abaikan beda huruf besar/kecil dan singkatan). Baris partai lain JANGAN disertakan sama sekali. Kolom "h" tetap diisi seluruh kolom angka pada tabel, karena posisi kolom dipakai untuk memetakan suara per TPS.`
    : `RUANG LINGKUP: salin SEMUA baris partai dan calon yang ada di tabel halaman ini.`;

  // Frontend memecah halaman yang tabelnya panjang jadi 2 potongan (atas &
  // bawah) supaya tiap permintaan lebih ringan/cepat — potongan bawah biasanya
  // TIDAK memuat judul dokumen atau baris header kolom TPS (karena sudah
  // terpotong di atasnya). Tanpa catatan ini model bisa salah menyimpulkan
  // "bukan tabel suara" hanya karena tidak melihat judulnya.
  const partialNote = isPartial
    ? `\n\nCATATAN: gambar ini kemungkinan hanya POTONGAN (bagian atas atau bagian bawah) dari satu halaman, BUKAN halaman utuh — judul dokumen atau baris header kolom TPS bisa saja tidak terlihat karena sudah terpotong. Kalau kamu melihat baris-baris berpola tabel suara (nomor + nama partai/calon + angka-angka), tetap perlakukan sebagai bagian dari tabel tersebut meskipun judulnya tidak terlihat di gambar ini. Kalau baris header kolom TPS ("TPS 01", dst) tidak terlihat di gambar ini, isi "h" dengan array kosong — jangan menebak nama kolom.`
    : '';

  return `Kamu adalah OCR khusus dokumen resmi rekapitulasi hasil pemilu Indonesia (formulir Model DAA1/DA1/DB1 dan sejenisnya dari KPU). Gambar yang diberikan adalah SATU HALAMAN dari dokumen tersebut, sudah diputar ke orientasi baca normal.

Tugasmu: cari tabel berjudul "DATA PEROLEHAN SUARA PARTAI POLITIK DAN CALON" (atau judul sangat mirip) di halaman ini. Tabel ini berisi baris "NOMOR, NAMA PARTAI DAN CALON" — setiap partai punya baris header (nomor + nama partai, biasanya di baris hitam/gelap), diikuti baris-baris calon (nomor urut + nama calon) di bawahnya, dengan kolom-kolom angka suara per TPS ke kanan, dan biasanya kolom terakhir "JUMLAH PINDAHAN" atau "JUMLAH AKHIR" (total baris tersebut).${partialNote}

${scope}

Jawab HANYA dengan JSON valid, tanpa markdown, tanpa penjelasan apa pun.

Jika halaman ini TIDAK memuat tabel tersebut (misalnya berisi tabel data pemilih, data disabilitas, data surat suara, atau halaman tanda tangan saja), jawab persis:
{"t":0,"h":[],"r":[]}

Jika halaman ini MEMUAT tabel tersebut, jawab dengan struktur RINGKAS berikut (nama field sengaja dipendekkan supaya jawaban tidak kepanjangan):
{
  "t": 1,
  "info": {"d": desa/kelurahan atau null, "k": kecamatan atau null, "kk": kabupaten/kota atau null, "l": keterangan lembar/halaman atau null},
  "h": [nama kolom angka dari kiri ke kanan persis seperti tertulis, contoh "TPS 01","TPS 02","JUMLAH PINDAHAN"],
  "r": [
    [nomor_partai, nama_partai, nomor_calon, nama_calon, baris_partai, [angka per kolom], total]
  ]
}

Penjelasan tiap elemen di dalam "r" (WAJIB tepat 7 elemen, urutannya persis seperti di atas):
1. nomor_partai: string atau null
2. nama_partai: string atau null
3. nomor_calon: string atau null (null untuk baris partai)
4. nama_calon: string atau null (null untuk baris partai)
5. baris_partai: 1 jika ini baris nama partai (baris rekap/header partai), 0 jika ini baris calon individu
6. angka per kolom: array integer, urutan dan panjangnya HARUS sama persis dengan "h". Sel kosong pada dokumen ditulis 0.
7. total: integer atau null — nilai kolom paling kanan ("JUMLAH PINDAHAN"/"JUMLAH AKHIR") untuk baris tersebut

ATURAN PENTING (data ini dipakai untuk keputusan nyata, akurasi mutlak):
- Baca SETIAP digit angka dengan sangat teliti. Jangan menebak angka yang tidak terbaca jelas — isi null pada elemen array tersebut, JANGAN mengarang angka.
- Salin nama calon PERSIS seperti tertulis (termasuk gelar seperti "SH", "S.Pi", dst), jangan diubah kapitalisasi atau ejaannya.
- Setiap baris calon tetap wajib mencantumkan nama_partai partai induknya (elemen ke-2), bukan null.
- Baris subtotal "JUMLAH SUARA SAH PARTAI POLITIK DAN CALON" boleh dilewati.
- Jangan menambahkan komentar, satuan, atau teks lain di luar JSON.`;
};

type CompactRow = [
  string | null, // party_number
  string | null, // party_name
  string | null, // candidate_number
  string | null, // candidate_name
  number | boolean | null, // is_party_row
  Array<number | null> | null, // values
  number | null, // total
];

// Model bisa saja menjawab dengan bentuk lama (objek per baris). Terima keduanya
// supaya perubahan format ini tidak bikin hasil yang sebenarnya valid ikut ditolak.
const expandRow = (row: CompactRow | Record<string, unknown>) => {
  if (Array.isArray(row)) {
    const [partyNumber, partyName, candidateNumber, candidateName, isPartyRow, values, total] = row;
    return {
      party_number: partyNumber ?? null,
      party_name: partyName ?? null,
      candidate_number: candidateNumber ?? null,
      candidate_name: candidateName ?? null,
      is_party_row: isPartyRow === 1 || isPartyRow === true,
      values: Array.isArray(values) ? values : [],
      total: typeof total === "number" ? total : null,
    };
  }
  return {
    party_number: row.party_number ?? null,
    party_name: row.party_name ?? null,
    candidate_number: row.candidate_number ?? null,
    candidate_name: row.candidate_name ?? null,
    is_party_row: row.is_party_row === true || row.is_party_row === 1,
    values: Array.isArray(row.values) ? row.values : [],
    total: typeof row.total === "number" ? row.total : null,
  };
};

const expandPayload = (compact: Record<string, any>) => {
  const isVoteTable = compact.t === 1 || compact.t === true || compact.is_vote_table === true;
  if (!isVoteTable) {
    return { is_vote_table: false, column_headers: [], rows: [], sheet_info: null };
  }
  const info = compact.info || {};
  const rawRows: any[] = Array.isArray(compact.r) ? compact.r : (Array.isArray(compact.rows) ? compact.rows : []);
  return {
    is_vote_table: true,
    sheet_info: {
      desa_kelurahan: info.d ?? info.desa_kelurahan ?? null,
      kecamatan: info.k ?? info.kecamatan ?? null,
      kabupaten_kota: info.kk ?? info.kabupaten_kota ?? null,
      lembar_hal: info.l ?? info.lembar_hal ?? null,
    },
    column_headers: Array.isArray(compact.h) ? compact.h : (Array.isArray(compact.column_headers) ? compact.column_headers : []),
    rows: rawRows.map(expandRow),
  };
};

// Model kadang membungkus JSON dengan ```json ... ``` atau menambah kalimat
// pembuka. Ambil objek JSON pertama sampai kurung tutup terakhir.
const parseModelJson = (text: string) => {
  const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch (_e) { /* coba cara kedua di bawah */ }
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
    const { image_base64, media_type, party_filter, is_partial } = body || {};
    const maxTokens = Number(body?.max_tokens) > 0 ? Math.min(Number(body.max_tokens), 32000) : DEFAULT_MAX_TOKENS;

    if (!image_base64) {
      return json({ error: "image_base64 wajib diisi" }, 400);
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json({ error: "ANTHROPIC_API_KEY belum diset di secrets Supabase" }, 500);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: maxTokens,
          system: buildSystemPrompt(typeof party_filter === "string" && party_filter.trim() ? party_filter.trim() : null, is_partial === true),
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: media_type || "image/png",
                    data: image_base64,
                  },
                },
                { type: "text", text: "Transkripsikan tabel perolehan suara pada halaman ini menjadi JSON ringkas sesuai format yang ditentukan." },
              ],
            },
          ],
        }),
      });
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error)?.name === "AbortError") {
        return json({ error: `Server OCR tidak merespons dalam ${ANTHROPIC_TIMEOUT_MS / 1000} detik. Coba proses lebih sedikit halaman sekaligus.` }, 504);
      }
      throw err;
    }
    clearTimeout(timer);

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic API error:", JSON.stringify(data));
      const message = data?.error?.message || "Anthropic API menolak permintaan";
      return json({ error: `Anthropic API error: ${message}`, detail: data }, 502);
    }

    if (data?.stop_reason === "max_tokens") {
      console.error("Anthropic response truncated at max_tokens", JSON.stringify(data?.usage || {}));
      return json({
        error: `Hasil OCR terpotong karena tabel di halaman ini terlalu panjang (batas ${maxTokens} token). Coba kirim ulang dengan filter partai, atau proses halaman ini sendirian.`,
      }, 502);
    }

    const textBlock = (data.content || []).find((b: any) => b.type === "text");
    const rawText = textBlock?.text || "";
    const parsed = parseModelJson(rawText);

    if (!parsed || typeof parsed !== "object") {
      console.error("Gagal parsing hasil OCR:", rawText.slice(0, 800));
      return json({ error: "Gagal parsing hasil OCR", raw: rawText.slice(0, 2000) }, 502);
    }

    return json({ data: expandPayload(parsed), usage: data?.usage ?? null });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
