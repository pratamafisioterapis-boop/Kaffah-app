// src/utils/insentifBulananCalc.js
//
// Mesin hitung "Insentif Bulanan" — replikasi alur rekap manual spreadsheet
// (Total Sebelum/Setelah PPH -> Tindakan -> Ranap Swasta/Tumbang -> Laporan
// Final) untuk aplikasi Konversi Dokter. Semua fungsi di sini murni (pure) —
// tidak menyentuh network/DB, supaya mudah diuji dan dipakai ulang di UI.

export const KATEGORI_SEBELUM_SETELAH = ['BPJS', 'PENSIUNAN', 'ASURANSI', 'KATASTROPIK', 'TUNAI', 'BPJS COB'];

export const KATEGORI_TINDAKAN_SEBELUM = ['BPJS', 'PENSIUNAN', 'PERTAMINA', 'PERTAMEDIKA', 'JAMINAN', 'PRIBADI', 'KATASTROPIK', 'TUNAI'];

export const KATEGORI_TINDAKAN_SETELAH = ['BPJS', 'PENSIUNAN', 'ASURANSI', 'KATASTROPIK', 'TUNAI'];

// Kategori tindakan yang tergabung jadi "ASURANSI" di tahap "Tindakan Setelah PPH".
const ASURANSI_SUB_KATEGORI = ['PERTAMINA', 'PERTAMEDIKA', 'JAMINAN', 'PRIBADI'];

export const RANAP_SWASTA_ESELON = ['BPJS', 'ASURANSI', 'TUNAI'];

export const TUMBANG_ESELON = ['BPJS', 'ASURANSI', 'BPJS FISIO', 'BPJS OT PERTAMA', 'TUNAI TUMBANG'];

// Baris Tumbang yang porsi non-dokternya (71%) dipecah lagi Tumbang:Fisio,
// bukan seluruhnya ke Tumbang.
const TUMBANG_FISIO_ROWS = new Set(['BPJS FISIO', 'BPJS OT PERTAMA']);

// Eselon dasar (dari tabel Total Sebelum/Setelah PPH) yang jadi acuan
// persentase PPH untuk baris Tumbang tertentu.
const TUMBANG_ESELON_BASE = {
  'BPJS': 'BPJS',
  'ASURANSI': 'ASURANSI',
  'BPJS FISIO': 'BPJS',
  'BPJS OT PERTAMA': 'BPJS',
  'TUNAI TUMBANG': 'TUNAI',
};

const PAJAK_TAHUNAN_RATE = 0.15;

const sumBy = (entries, keyFn, nominalFn = (e) => Number(e.nominal) || 0) => {
  const out = {};
  for (const entry of entries || []) {
    const key = keyFn(entry);
    if (!key) continue;
    out[key] = (out[key] || 0) + nominalFn(entry);
  }
  return out;
};

// ── Tahap 1 & 2: Total Sebelum/Setelah PPH + persentase PPH per kategori ──
export function hitungTotalPphPerKategori(kategoriSebelumPph, kategoriSetelahPph) {
  const sebelum = sumBy(kategoriSebelumPph, (e) => e.kategori);
  const setelah = sumBy(kategoriSetelahPph, (e) => e.kategori);
  const result = {};
  for (const kat of KATEGORI_SEBELUM_SETELAH) {
    const s = sebelum[kat] || 0;
    const t = setelah[kat] || 0;
    result[kat] = {
      sebelumPph: s,
      setelahPph: t,
      persenPph: s > 0 ? t / s : 0,
    };
  }
  return result;
}

// ── Tahap 3 & 4: Tindakan Sebelum/Setelah PPH + Konsul/Visite (hak dokter) ──
export function hitungTindakan(tindakanSebelumPph, tindakanSetelahPph, totalPphPerKategori) {
  const sebelumRaw = sumBy(tindakanSebelumPph, (e) => e.kategori);
  // Gabungkan sub-kategori Asuransi (Pertamina/Pertamedika/Jaminan/Pribadi) jadi satu.
  const sebelum = {};
  for (const kat of KATEGORI_TINDAKAN_SETELAH) {
    if (kat === 'ASURANSI') {
      sebelum[kat] = ASURANSI_SUB_KATEGORI.reduce((s, sub) => s + (sebelumRaw[sub] || 0), 0);
    } else {
      sebelum[kat] = sebelumRaw[kat] || 0;
    }
  }

  const setelahRaw = sumBy(tindakanSetelahPph, (e) => e.kategori);

  const perKategori = {};
  let totalSetelahPajak = 0;
  let totalPajak = 0;
  for (const kat of KATEGORI_TINDAKAN_SETELAH) {
    const setelahPph = setelahRaw[kat] || 0;
    const pajak = setelahPph * PAJAK_TAHUNAN_RATE;
    const setelahPajak = setelahPph - pajak;

    const totalKategori = totalPphPerKategori[kat]?.sebelumPph || 0;
    const konsulVisiteSebelumPph = Math.max(0, totalKategori - sebelum[kat]);
    const persenPph = totalPphPerKategori[kat]?.persenPph || 0;
    const konsulVisiteSetelahPph = konsulVisiteSebelumPph * persenPph;
    const konsulVisitePajak = konsulVisiteSetelahPph * PAJAK_TAHUNAN_RATE;
    const konsulVisiteSetelahPajak = konsulVisiteSetelahPph - konsulVisitePajak;

    perKategori[kat] = {
      tindakanSebelumPph: sebelum[kat],
      tindakanSetelahPph: setelahPph,
      pajak,
      setelahPajak,
      konsulVisiteSebelumPph,
      konsulVisiteSetelahPph,
      konsulVisiteSetelahPajak,
    };
    totalSetelahPajak += setelahPajak;
    totalPajak += pajak;
  }

  const totalKonsulVisiteSetelahPajak = Object.values(perKategori)
    .reduce((s, r) => s + r.konsulVisiteSetelahPajak, 0);

  return { perKategori, totalSetelahPajak, totalPajak, totalKonsulVisiteSetelahPajak };
}

// ── Ranap Swasta: Sebelum PPH -> Setelah PPH (pakai persen eselon dasar,
// tanpa duplikasi ×2) -> Pajak 15% flat -> sisa dibagi 50:50 Dokter:Terapis ──
export function hitungRanapSwasta(ranapSwastaEntries, totalPphPerKategori) {
  const sebelum = sumBy(ranapSwastaEntries, (e) => e.eselon);
  const perEselon = {};
  let totalDokter = 0;
  let totalTerapis = 0;
  for (const eselon of RANAP_SWASTA_ESELON) {
    const sebelumPph = sebelum[eselon] || 0;
    const persenPph = totalPphPerKategori[eselon]?.persenPph || 0;
    const setelahPph = sebelumPph * persenPph;
    const pajak = setelahPph * PAJAK_TAHUNAN_RATE;
    const sisa = setelahPph - pajak;
    const dokter = sisa / 2;
    const terapis = sisa / 2;
    perEselon[eselon] = { sebelumPph, setelahPph, pajak, sisa, dokter, terapis };
    totalDokter += dokter;
    totalTerapis += terapis;
  }
  return { perEselon, totalDokter, totalTerapis, total: totalDokter + totalTerapis };
}

// ── Tumbang: sama alurnya, sisa dibagi Dokter 29% tetap; sisa 71% penuh ke
// Tumbang (baris biasa) atau dipecah 20:80 Tumbang:Fisio (baris OT/Fisio) ──
export function hitungTumbang(tumbangEntries, totalPphPerKategori) {
  const sebelum = sumBy(tumbangEntries, (e) => e.eselon);
  const perEselon = {};
  let totalDokter = 0;
  let totalTumbang = 0;
  let totalFisio = 0;
  for (const eselon of TUMBANG_ESELON) {
    const sebelumPph = sebelum[eselon] || 0;
    const persenPph = totalPphPerKategori[TUMBANG_ESELON_BASE[eselon]]?.persenPph || 0;
    const setelahPph = sebelumPph * persenPph;
    const pajak = setelahPph * PAJAK_TAHUNAN_RATE;
    const sisa = setelahPph - pajak;
    const dokter = sisa * 0.29;
    const sisaLain = sisa - dokter;
    let tumbang;
    let fisio;
    if (TUMBANG_FISIO_ROWS.has(eselon)) {
      tumbang = sisaLain * 0.20;
      fisio = sisaLain * 0.80;
    } else {
      tumbang = sisaLain;
      fisio = 0;
    }
    perEselon[eselon] = { sebelumPph, setelahPph, pajak, sisa, dokter, tumbang, fisio };
    totalDokter += dokter;
    totalTumbang += tumbang;
    totalFisio += fisio;
  }
  return { perEselon, totalDokter, totalTumbang, totalFisio, total: totalDokter + totalTumbang + totalFisio };
}

// ── Basis Laporan Final: Total Tindakan Setelah Pajak dikurangi net Ranap
// Swasta & Tumbang (satu langkah, tanpa kolom tambal "tambahan pajak") ──
export function hitungBasisFinal(tindakanResult, ranapResult, tumbangResult) {
  return tindakanResult.totalSetelahPajak - ranapResult.total - tumbangResult.total;
}

// ── Laporan Final: bagi basis (dikurangi KAS) ke roster sesuai persentase.
// Anggota "capped" (mis. Om Phius) punya aturan khusus: (persen × basis) −
// Rp250rb uang kas − F5 → dibatasi min/max → sisanya diredistribusi ke
// anggota lain sesuai redistribusi_dari_capped_persen masing-masing. ──
export function hitungLaporanFinal({
  basisFinal, kasTotal, f5Nominal, roster, tindakanResult, ranapResult, tumbangResult,
  omPhiusMin = 2_000_000, omPhiusMax = 4_000_000, omPhiusPotonganKas = 250_000,
}) {
  const basisSetelahKas = basisFinal - kasTotal;
  const active = (roster || []).filter((r) => r.is_active !== false);
  const capped = active.find((r) => r.is_capped);
  const nonCapped = active.filter((r) => !r.is_capped);

  const perOrang = {};
  let sisaForfeited = 0;

  if (capped) {
    const jatahDasar = basisSetelahKas * ((Number(capped.persentase) || 0) / 100) - omPhiusPotonganKas;
    const setelahF5 = jatahDasar - (f5Nominal || 0);
    const finalCapped = Math.min(omPhiusMax, Math.max(omPhiusMin, setelahF5));
    sisaForfeited = setelahF5 - finalCapped;
    perOrang[capped.id] = { nama: capped.nama, jatahDasar, setelahF5, nominalHitungan: finalCapped, isCapped: true };
  }

  for (const member of nonCapped) {
    const normalShare = basisSetelahKas * ((Number(member.persentase) || 0) / 100);
    const redistribusi = capped && member.redistribusi_dari_capped_persen
      ? sisaForfeited * (Number(member.redistribusi_dari_capped_persen) / 100)
      : 0;
    // Dokter (baris pertama/urutan terkecil, persentase tertinggi) juga
    // menerima Konsul+Visite penuh serta porsi dokter dari Ranap Swasta &
    // Tumbang — pendapatan pribadinya, bukan bagian yang dibagi rata.
    const isDokter = member.urutan === Math.min(...nonCapped.map((m) => m.urutan));
    const pendapatanTambahanDokter = isDokter
      ? (tindakanResult.totalKonsulVisiteSetelahPajak + ranapResult.totalDokter + tumbangResult.totalDokter)
      : 0;
    perOrang[member.id] = {
      nama: member.nama,
      normalShare,
      redistribusi,
      pendapatanTambahanDokter,
      nominalHitungan: normalShare + redistribusi + pendapatanTambahanDokter,
      isCapped: false,
    };
  }

  const totalDibagikan = Object.values(perOrang).reduce((s, r) => s + r.nominalHitungan, 0);
  return { basisSetelahKas, kasTotal, perOrang, totalDibagikan, grandTotal: totalDibagikan + kasTotal };
}

export function formatRupiah(n) {
  return `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(n || 0))}`;
}
