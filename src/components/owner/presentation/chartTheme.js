// Palet kategorikal tetap-urutan (dark-mode steps dari referensi palet
// data-viz internal, sudah divalidasi untuk kontras & keterbacaan buta warna)
// dipakai konsisten di semua breakdown chart slideshow supaya warnanya tidak
// diacak-random per komponen.
export const CATEGORICAL_COLORS = [
  '#3987e5', // 1 blue
  '#d95926', // 2 orange
  '#199e70', // 3 aqua
  '#c98500', // 4 yellow
  '#d55181', // 5 magenta
  '#22c55e', // 6 green
  '#9085e9', // 7 violet
  '#e66767', // 8 red
];

export const RANK_COLOR = '#fbbf24'; // gold — dipakai khusus utk peringkat #1

export const chartTooltipStyle = {
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.12)',
  background: '#0f172a',
  color: '#fff',
  boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
  padding: '10px 14px',
  fontSize: 13,
};

export const chartAxisTick = { fontSize: 11, fill: '#94a3b8' };
