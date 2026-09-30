// Gaya tabel data seragam (Daily Recaps, Database Patients, Package Recaps,
// Medical Records): tabel selalu muat di lebar layar (table-fixed + lebar kolom
// persentase lewat <TableCols />), font 11px -> 12px (xl) -> 14px (2xl), padding
// sel menyesuaikan, dan teks hanya turun baris di spasi (tidak memotong kata).
// Ditulis sebagai string literal agar terdeteksi Tailwind.
export const TABLE_FIT =
  'w-full table-fixed text-left text-[11px] [&_td]:text-[11px] [&_th]:text-[11px] [&_.text-base]:text-[11px] [&_.text-sm]:text-[11px] [&_.text-xs]:text-[11px] xl:text-xs xl:[&_td]:text-xs xl:[&_th]:text-xs xl:[&_.text-base]:text-xs xl:[&_.text-sm]:text-xs xl:[&_.text-xs]:text-xs 2xl:text-sm 2xl:[&_td]:text-sm 2xl:[&_th]:text-sm 2xl:[&_.text-base]:text-sm 2xl:[&_.text-sm]:text-sm 2xl:[&_.text-xs]:text-sm [&_td]:px-1 [&_th]:px-1 xl:[&_td]:px-2 xl:[&_th]:px-2 2xl:[&_td]:px-3 2xl:[&_th]:px-3 [&_td]:py-3 [&_td]:[overflow-wrap:break-word] [&_td]:align-middle [&_th]:py-3 [&_th]:[overflow-wrap:break-word] [&_th]:align-middle [&_th]:h-auto [&_th]:font-semibold [&_th]:normal-case [&_th]:tracking-normal [&_th]:text-slate-700 [&_th]:leading-tight [&_th]:whitespace-normal';
