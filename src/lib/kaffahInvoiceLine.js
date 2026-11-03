// Baris layanan invoice Kaffah (CODE / DESCRIPTION / SESSION) berdasarkan jenis pasien & paket.
//
// Jenis pasien -> nama layanan:
//   NORMAL (1 keluhan)            Essential Physiotherapy
//   DUA / TIGA KELUHAN            Advanced Physiotherapy
//   RECOVERY                      Recovery Therapy
//   RECOVERY+TREATMENT            Advanced Physiotherapy + Recovery Therapy
//   KONSULTASI                    Physiotherapy Consultation
//   HOMECARE                      Essential Physiotherapy, Home Visit
//   XTRATIME / FREE / lainnya     mengikuti keluhannya, default Essential Physiotherapy

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Jumlah sesi bila tidak bisa diambil dari package_tracking (nama paket Kaffah).
const FALLBACK_SESSIONS = { 'paket 1': 3, 'paket 2': 6, 'paket 3': 12, 'paket homecare': 3 };

export const kaffahServiceLine = (patientTypeLabel) => {
  const t = UUID_RE.test(String(patientTypeLabel || '')) ? '' : String(patientTypeLabel || '').toUpperCase();
  if (t.includes('RECOVERY') && t.includes('TREATMENT')) return { code: 'AP+RT', description: 'Advanced Physiotherapy + Recovery Therapy' };
  if (t.includes('RECOVERY')) return { code: 'RT', description: 'Recovery Therapy' };
  if (t.includes('KONSULTASI')) return { code: 'PC', description: 'Physiotherapy Consultation' };
  if (t.includes('DUA KELUHAN') || t.includes('TIGA KELUHAN')) return { code: 'AP', description: 'Advanced Physiotherapy' };
  if (t.includes('HOMECARE')) return { code: 'EP', description: 'Essential Physiotherapy, Home Visit' };
  return { code: 'EP', description: 'Essential Physiotherapy' };
};

export const kaffahSessionLabel = (packageTypeLabel, totalSessions) => {
  const raw = UUID_RE.test(String(packageTypeLabel || '')) ? '' : String(packageTypeLabel || '').trim();
  if (!raw || /^reguler$/i.test(raw)) return 'REGULER';
  let n = Number(totalSessions) || 0;
  if (!n) {
    const ru = raw.match(/paket\s*(\d+)\s*ru/i); // "Paket 5 RU" = 5 sesi
    n = ru ? Number(ru[1]) : (FALLBACK_SESSIONS[raw.toLowerCase()] || 0);
  }
  return n ? `${n}-Session Package` : raw;
};
