// Supabase/PostgREST caps any select without an explicit .range() at a
// server-side max row count (1000 by default). Tables that grow past that —
// pemilih_tps, pemilih_dpt_periode, pemilih_suara_caleg, dst. all get there
// fast once more than a couple dapil/kelurahan are in play — will silently
// come back truncated instead of erroring, so pagination isn't optional for
// any query that isn't already scoped tight enough to guarantee <1000 rows.
//
// `buildQuery` must return a *fresh* Supabase query builder each call (no
// .range() applied yet) — this function appends .range() itself per page.
const PAGE_SIZE = 1000;

export const fetchAllRows = async (buildQuery, pageSize = PAGE_SIZE) => {
  let allRows = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const to = from + pageSize - 1;
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await buildQuery().range(from, to);
    if (error) return { data: null, error };
    allRows = allRows.concat(data || []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return { data: allRows, error: null };
};
