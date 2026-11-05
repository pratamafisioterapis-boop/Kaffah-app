// ZIP reader for exercise step images. Uses the browser's native deflate decoder.
// No remote ZIP parsing service or credentials are required.
const read16 = (view, p) => view.getUint16(p, true);
const read32 = (view, p) => view.getUint32(p, true);
const MAX_ZIP_BYTES = 200 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_ENTRIES = 1500;

export async function readExerciseIllustrationZip(file, validExerciseIds) {
  if (!file || !/\.zip$/i.test(file.name)) throw new Error('Pilih file .zip.');
  if (file.size > MAX_ZIP_BYTES) throw new Error('ZIP maksimal 200 MB. Bagi menjadi beberapa batch.');
  const bytes = await file.arrayBuffer();
  const view = new DataView(bytes);
  let end = -1;
  for (let p = bytes.byteLength - 22; p >= Math.max(0, bytes.byteLength - 65557); p--) {
    if (read32(view, p) === 0x06054b50) { end = p; break; }
  }
  if (end < 0) throw new Error('ZIP tidak valid atau tidak didukung.');
  const count = read16(view, end + 10);
  const cdOffset = read32(view, end + 16);
  if (count > MAX_ENTRIES) throw new Error('Terlalu banyak berkas di ZIP (maksimal 1500).');
  if (read16(view, end + 8) !== count || read32(view, end + 12) === 0xffffffff) {
    throw new Error('ZIP multi-volume atau ZIP64 tidak didukung.');
  }
  const decoder = new TextDecoder();
  const entries = [];
  const rejected = [];
  const seen = new Set();
  let pos = cdOffset;
  for (let i = 0; i < count; i++) {
    if (pos + 46 > bytes.byteLength || read32(view, pos) !== 0x02014b50) throw new Error('Direktori ZIP rusak.');
    const flags = read16(view, pos + 8);
    const method = read16(view, pos + 10);
    const compressedSize = read32(view, pos + 20);
    const size = read32(view, pos + 24);
    const nameLen = read16(view, pos + 28);
    const extraLen = read16(view, pos + 30);
    const commentLen = read16(view, pos + 32);
    const localOffset = read32(view, pos + 42);
    const rawName = decoder.decode(new Uint8Array(bytes, pos + 46, nameLen));
    pos += 46 + nameLen + extraLen + commentLen;
    if (rawName.endsWith('/') || rawName.startsWith('__MACOSX/') || rawName.split('/').some(v => v.startsWith('.'))) continue;
    const normalized = rawName.replaceAll('\\', '/');
    const match = normalized.match(/(?:^|\/)([A-Za-z0-9_-]+)\/step-(\d{1,2})\.(jpe?g|png|webp)$/i);
    if (!match) { rejected.push(rawName + ': format nama harus ID/step-01.jpg'); continue; }
    const id = match[1].toUpperCase();
    const step = Number(match[2]);
    const ext = match[3].toLowerCase() === 'jpeg' ? 'jpg' : match[3].toLowerCase();
    const key = id + '/' + step;
    if (!validExerciseIds.has(id)) { rejected.push(rawName + ': ID tidak ditemukan/latihan sudah memiliki video'); continue; }
    if (step < 1 || step > 12 || seen.has(key)) { rejected.push(rawName + ': nomor tahap tidak valid/duplikat'); continue; }
    if (flags & 1 || ![0, 8].includes(method)) { rejected.push(rawName + ': ZIP terenkripsi/metode tidak didukung'); continue; }
    if (size > MAX_IMAGE_BYTES || compressedSize > MAX_IMAGE_BYTES) { rejected.push(rawName + ': gambar maksimal 5 MB'); continue; }
    if (localOffset + 30 > bytes.byteLength || read32(view, localOffset) !== 0x04034b50) {
      rejected.push(rawName + ': entri ZIP rusak'); continue;
    }
    const dataOffset = localOffset + 30 + read16(view, localOffset + 26) + read16(view, localOffset + 28);
    if (dataOffset + compressedSize > bytes.byteLength) { rejected.push(rawName + ': data ZIP tidak lengkap'); continue; }
    seen.add(key);
    entries.push({ id, step, ext, size, compressedSize, method, dataOffset, rawName });
  }
  entries.sort((a, b) => a.id.localeCompare(b.id) || a.step - b.step);
  return {
    entries, rejected,
    extract: async (entry) => {
      const data = new Uint8Array(bytes.slice(entry.dataOffset, entry.dataOffset + entry.compressedSize));
      let output;
      if (entry.method === 0) output = data;
      else {
        if (typeof DecompressionStream === 'undefined') throw new Error('Browser tidak mendukung ekstraksi ZIP. Gunakan Chrome/Edge terbaru.');
        try {
          const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
          output = new Uint8Array(await new Response(stream).arrayBuffer());
        } catch {
          throw new Error('Browser gagal membuka ZIP. Coba gunakan ZIP tanpa kompresi atau Chrome/Edge terbaru.');
        }
      }
      if (output.byteLength !== entry.size || output.byteLength > MAX_IMAGE_BYTES) throw new Error('Ukuran gambar ZIP tidak sesuai.');
      const isJpeg = output[0] === 0xff && output[1] === 0xd8 && output[2] === 0xff;
      const isPng = output[0] === 0x89 && output[1] === 0x50 && output[2] === 0x4e && output[3] === 0x47;
      const isWebp = output[0] === 0x52 && output[1] === 0x49 && output[2] === 0x46 && output[3] === 0x46
        && output[8] === 0x57 && output[9] === 0x45 && output[10] === 0x42 && output[11] === 0x50;
      if (!((entry.ext === 'jpg' && isJpeg) || (entry.ext === 'png' && isPng) || (entry.ext === 'webp' && isWebp))) {
        throw new Error('Isi file bukan gambar ' + entry.ext.toUpperCase() + ' yang valid.');
      }
      return new Blob([output], { type: entry.ext === 'jpg' ? 'image/jpeg' : 'image/' + entry.ext });
    },
  };
}
