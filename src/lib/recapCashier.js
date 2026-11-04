// Penentuan kasir (admin yang melayani pembayaran) sebuah daily_recap.
//
// "Dibuat oleh" pada recap hanya menunjukkan akun yang membuat booking (recap dibuat otomatis
// bersama appointment, sering jauh sebelum sesi). Kasir sebenarnya adalah admin yang
//   (1) mengisi TTV, atau
//   (2) mengubah metode/nominal pembayaran recap,
// mana yang lebih dulu. Urutan lengkap: cashier_id (bila tercatat) -> kejadian di atas -> pembuat recap bila admin.

const asNumber = (v) => (v === null || v === undefined || v === '' ? 0 : Number(v));

/**
 * Ambil kejadian "admin menangani pasien" untuk sejumlah recap.
 * @returns {Promise<Record<string, Array<{ userId: string, at: number }>>>} diurutkan dari yang paling awal.
 */
export const fetchRecapHandlerEvents = async (supabase, recapIds) => {
  const byRecap = {};
  const ids = [...new Set((recapIds || []).filter(Boolean))];
  if (!ids.length) return byRecap;
  const add = (recapId, userId, at) => {
    const t = new Date(at).getTime();
    if (!recapId || !userId || Number.isNaN(t)) return;
    (byRecap[recapId] ||= []).push({ userId, at: t });
  };

  const [vitals, audits] = await Promise.all([
    supabase.from('recap_vital_signs').select('recap_id, recorded_by, created_at').in('recap_id', ids).not('recorded_by', 'is', null),
    supabase.from('audit_logs')
      .select('resource_id, user_id, created_at, old_pm:changes->old->>payment_method, new_pm:changes->new->>payment_method, old_amt:changes->old->>amount, new_amt:changes->new->>amount')
      .eq('resource_type', 'daily_recaps').eq('action', 'UPDATE').in('resource_id', ids).not('user_id', 'is', null),
  ]);

  (vitals.data || []).forEach((v) => add(v.recap_id, v.recorded_by, v.created_at));
  (audits.data || []).forEach((a) => {
    const paymentChanged = (a.old_pm || null) !== (a.new_pm || null) || asNumber(a.old_amt) !== asNumber(a.new_amt);
    if (paymentChanged) add(a.resource_id, a.user_id, a.created_at);
  });

  Object.values(byRecap).forEach((list) => list.sort((x, y) => x.at - y.at));
  return byRecap;
};
