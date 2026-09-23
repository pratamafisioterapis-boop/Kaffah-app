// src/utils/insentifDokterHistory.js
//
// Persistensi laporan rekap Insentif Dokter (hasil agregasi dari
// buildInsentifDokterReport) ke Supabase, supaya ada riwayat per bulan/tanggal
// yang bisa dibuka kembali kapan saja — bukan cuma sesi upload yang sedang
// berjalan.
//
// Konversi Dokter adalah aplikasi mandiri, terpisah dari sistem klinik, jadi
// riwayat di sini di-scope per akun (owner_user_id), bukan per klinik.

import { supabase } from '@/lib/customSupabaseClient';

const TABLE = 'insentif_dokter_reports';

export async function saveInsentifDokterHistory({
  userId, periodeLabel, periodeMonth, fileNames, report,
}) {
  if (!userId) throw new Error('Akun tidak ditemukan.');
  const totalBpjs = report?.bpjs?.total || 0;
  const totalJaminan = Object.values(report?.jaminan || {}).reduce((s, v) => s + (v.total || 0), 0);

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      owner_user_id: userId,
      periode_label: periodeLabel,
      periode_month: periodeMonth,
      file_names: fileNames || [],
      report_data: report,
      total_bpjs: totalBpjs,
      total_jaminan: totalJaminan,
      grand_total: totalBpjs + totalJaminan,
      created_by: userId,
    })
    .select('id, periode_label, periode_month, file_names, total_bpjs, total_jaminan, grand_total, created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function listInsentifDokterHistory(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, periode_label, periode_month, file_names, total_bpjs, total_jaminan, grand_total, created_at')
    .eq('owner_user_id', userId)
    .order('periode_month', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getInsentifDokterHistoryDetail(id, userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .eq('owner_user_id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteInsentifDokterHistory(id, userId) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id).eq('owner_user_id', userId);
  if (error) throw error;
}
