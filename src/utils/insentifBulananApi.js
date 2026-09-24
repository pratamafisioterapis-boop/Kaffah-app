// src/utils/insentifBulananApi.js
//
// Akses Supabase untuk sistem Insentif Bulanan — semua di-scope per akun
// (owner_user_id), bukan per klinik.

import { supabase } from '@/lib/customSupabaseClient';

const LAPORAN_TABLE = 'insentif_bulanan_laporan';
const ROSTER_TABLE = 'insentif_roster';
const TABUNGAN_TABLE = 'insentif_tabungan_pajak_penarikan';

export async function getOrCreateLaporanBulanan(ownerUserId, periodeBulan) {
  const { data: existing, error: selectError } = await supabase
    .from(LAPORAN_TABLE)
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .eq('periode_bulan', periodeBulan)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from(LAPORAN_TABLE)
    .insert({ owner_user_id: ownerUserId, periode_bulan: periodeBulan })
    .select('*')
    .single();
  if (insertError) throw insertError;
  return created;
}

export async function updateLaporanBulanan(laporanId, patch) {
  const { data, error } = await supabase
    .from(LAPORAN_TABLE)
    .update(patch)
    .eq('id', laporanId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function listLaporanBulananHistory(ownerUserId) {
  const { data, error } = await supabase
    .from(LAPORAN_TABLE)
    .select('id, periode_bulan, created_at, updated_at')
    .eq('owner_user_id', ownerUserId)
    .order('periode_bulan', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listRoster(ownerUserId) {
  const { data, error } = await supabase
    .from(ROSTER_TABLE)
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .order('urutan', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function upsertRosterMember(ownerUserId, member) {
  const payload = { ...member, owner_user_id: ownerUserId };
  const { data, error } = await supabase
    .from(ROSTER_TABLE)
    .upsert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRosterMember(id) {
  const { error } = await supabase.from(ROSTER_TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function listTabunganPajakPenarikan(ownerUserId) {
  const { data, error } = await supabase
    .from(TABUNGAN_TABLE)
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addTabunganPajakPenarikan(ownerUserId, { laporanId, nominal, keterangan }) {
  const { data, error } = await supabase
    .from(TABUNGAN_TABLE)
    .insert({ owner_user_id: ownerUserId, laporan_id: laporanId || null, nominal, keterangan: keterangan || null })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTabunganPajakPenarikan(id) {
  const { error } = await supabase.from(TABUNGAN_TABLE).delete().eq('id', id);
  if (error) throw error;
}
