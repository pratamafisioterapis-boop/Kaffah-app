// Logika murni (tanpa I/O) untuk membaca status dari Watzap; dipisah supaya bisa diuji.

const RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3 };

export type Parsed = { status: string; at: string; error?: string } | null;

/** Baca balasan /messages action=status dari Watzap menjadi status akhir pesan. */
export function parseStatus(out: any): Parsed {
  const d = out?.data;
  const status = String(d?.status ?? "");
  if (!["sent", "delivered", "read", "failed"].includes(status)) return null;
  const hist: any[] = Array.isArray(d?.status_history) ? d.status_history : [];
  const last = [...hist].reverse().find((h) => h?.status === status);
  const ms = Number(last?.at?.$date?.$numberLong ?? NaN);
  const at = Number.isFinite(ms) ? new Date(ms).toISOString() : new Date().toISOString();
  let error: string | undefined;
  if (status === "failed") {
    const e = last?.raw?.errors?.[0];
    error = String(e?.error_data?.details || e?.title || e?.message || d?.error || "Gagal terkirim").slice(0, 500);
  }
  return { status, at, error };
}

/** Status baru hanya boleh maju (sent < delivered < read); failed selalu diterima. */
export function shouldAdvance(current: string, next: string): boolean {
  if (next === "failed") return current !== "failed";
  return (RANK[next] ?? 0) > (RANK[current] ?? 0);
}

/** Watzap menjawab HTTP 200 dengan {status:false, message:"Limit Exceeded ..."} saat kena batas laju. */
export function isRateLimited(out: any): boolean {
  return out?.status === false && /limit exceeded/i.test(String(out?.message ?? ""));
}
