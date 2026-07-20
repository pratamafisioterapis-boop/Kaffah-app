// src/utils/insentifDokterHistory.js
//
// Persistensi laporan rekap Insentif Dokter (hasil agregasi dari
// buildInsentifDokterReport) ke Supabase, supaya ada riwayat per bulan/tanggal
// yang bisa dibuka kembali kapan saja — bukan cuma sesi upload yang sedang
// berjalan.

import { supabase } from '@/lib/customSupabaseClient';

const TABLE = 'insentif_dokter_reports';

export async function saveInsentifDokterHistory({
  clinicId, userId, periodeLabel, periodeMonth, fileNames, report,
}) {
  if (!clinicId) throw new Error('Clinic tidak ditemukan pada akun ini.');
  const totalBpjs = report?.bpjs?.total || 0;
  const totalJaminan = Object.values(report?.jaminan || {}).reduce((s, v) => s + (v.total || 0), 0);

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      clinic_id: clinicId,
      periode_label: periodeLabel,
      periode_month: periodeMonth,
      file_names: fileNames || [],
      report_data: report,
      total_bpjs: totalBpjs,
      total_jaminan: totalJaminan,
      grand_total: totalBpjs + totalJaminan,
      created_by: userId || null,
    })
    .select('id, periode_label, periode_month, file_names, total_bpjs, total_jaminan, grand_total, created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function listInsentifDokterHistory(clinicId) {
  if (!clinicId) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, periode_label, periode_month, file_names, total_bpjs, total_jaminan, grand_total, created_at')
    .eq('clinic_id', clinicId)
    .order('periode_month', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getInsentifDokterHistoryDetail(id) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteInsentifDokterHistory(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
