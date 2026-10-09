// Pengaturan animasi Recharts yang dipakai bersama di dashboard owner.
// Bawaan Recharts (1500ms) terlalu lambat untuk grafik yang sering dilihat;
// 500ms ease-out terasa responsif tapi tetap memperlihatkan data "tumbuh".
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const CHART_MOTION = {
  isAnimationActive: !prefersReducedMotion,
  animationDuration: 500,
  animationEasing: 'ease-out',
};
