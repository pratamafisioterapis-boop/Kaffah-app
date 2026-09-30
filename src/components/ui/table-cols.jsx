import React from 'react';

// Lebar kolom dalam persen (total 100) untuk tabel `table-fixed`.
export const TableCols = ({ widths }) => (
  <colgroup>
    {widths.map((w, i) => (
      <col key={i} style={{ width: `${w}%` }} />
    ))}
  </colgroup>
);
