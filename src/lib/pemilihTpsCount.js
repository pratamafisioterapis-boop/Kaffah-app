import { supabase } from './customSupabaseClient';

// pemilih_suara_tps_count (Jumlah TPS per kelurahan+tahun di Setup Dapil)
// awalnya cuma diisi otomatis SEKALI — begitu ada baris tersimpan, tidak ada
// yang menjaganya tetap sinkron kalau TPS baru terus ditambah lewat Detail
// per TPS / Upload PDF / Input Manual / Input Suara per TPS (DPC). Panggil
// ini setelah menyimpan TPS di jalur manapun supaya angkanya ikut naik kalau
// TPS yang baru disimpan nomornya melebihi yang tercatat. Best-effort — gagal
// di sini tidak boleh membatalkan penyimpanan suara yang sudah berhasil.
export const bumpTpsCountIfNeeded = async (kelurahanId, electionYear, maxTpsNumber) => {
  if (!kelurahanId || !electionYear || !maxTpsNumber) return;
  try {
    const { data } = await supabase
      .from('pemilih_suara_tps_count')
      .select('jumlah_tps')
      .eq('kelurahan_id', kelurahanId)
      .eq('election_year', electionYear)
      .maybeSingle();
    const current = data?.jumlah_tps ?? 0;
    if (maxTpsNumber > current) {
      await supabase
        .from('pemilih_suara_tps_count')
        .upsert({ kelurahan_id: kelurahanId, election_year: electionYear, jumlah_tps: maxTpsNumber }, { onConflict: 'kelurahan_id,election_year' });
    }
  } catch (e) {
    console.warn('Gagal menyinkronkan jumlah TPS', e);
  }
};
