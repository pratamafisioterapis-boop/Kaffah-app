// Join `users!created_by` bisa kosong karena RLS tabel users (hanya admin/owner yang boleh
// membaca user lain). Lengkapi nama terapis dari tabel physiotherapists (user_id) sebagai fallback.
export async function fillTherapistNames(supabase, records) {
  const rows = records || [];
  const missing = [...new Set(rows.filter(r => !r.therapist?.full_name && r.created_by).map(r => r.created_by))];
  if (missing.length === 0) return rows;
  const { data } = await supabase.from('physiotherapists').select('user_id, name').in('user_id', missing);
  const nameByUser = new Map((data || []).map(p => [p.user_id, p.name]));
  return rows.map(r => (!r.therapist?.full_name && nameByUser.has(r.created_by))
    ? { ...r, therapist: { full_name: nameByUser.get(r.created_by) } }
    : r);
}
