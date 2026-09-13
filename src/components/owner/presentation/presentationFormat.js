export const formatCurrency = (amount) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);

export const formatShortCurrency = (amount) => {
  const num = Number(amount) || 0;
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1).replace(/\.0$/, '')} M`;
  if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')} Jt`;
  if (abs >= 1_000) return `${sign}Rp ${(abs / 1_000).toFixed(0)} Rb`;
  return `${sign}Rp ${Math.round(abs).toLocaleString('id-ID')}`;
};

export const formatPercent = (value) => `${value > 0 ? '+' : ''}${value ?? 0}%`;
