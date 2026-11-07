// Barang gudang yang dijual di recap (daily_recaps.goods_items) -> baris invoice.
// Total dihitung ulang dari baris supaya konsisten walau goods_amount belum terisi.
export const getGoodsLines = (data) => {
  const items = Array.isArray(data?.goods_items) ? data.goods_items : [];
  const lines = items
    .map((it) => {
      const qty = Number(it.qty) || 0;
      const price = Number(it.price) || 0;
      const discount = Number(it.discount) || 0;
      return { name: it.name || '-', qty, total: qty * price - discount };
    })
    .filter((l) => l.qty > 0);
  return { lines, total: lines.reduce((s, l) => s + l.total, 0) };
};
