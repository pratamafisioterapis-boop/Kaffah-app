export const STATUS_LABEL = {
  baru: 'Baru',
  menunggu_persetujuan: 'Menunggu persetujuan',
  disetujui: 'Dikerjakan',
  dikerjakan: 'Dikerjakan',
  selesai: 'Selesai',
  ditolak: 'Ditolak',
  dibatalkan: 'Dibatalkan',
};

export const STATUS_TONE = {
  baru: 'bg-blue-50 text-blue-700 border-blue-200',
  menunggu_persetujuan: 'bg-amber-50 text-amber-700 border-amber-200',
  disetujui: 'bg-violet-50 text-violet-700 border-violet-200',
  dikerjakan: 'bg-violet-50 text-violet-700 border-violet-200',
  selesai: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ditolak: 'bg-red-50 text-red-700 border-red-200',
  dibatalkan: 'bg-gray-100 text-gray-600 border-gray-200',
};

export const fmtWhen = (iso) =>
  new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
