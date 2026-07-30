-- Migration 20260729030000 menandai is_auto_fixed_cost = true untuk SEMUA baris
-- owner_expenditures berkategori 'FIXED COST'. Padahal kategori itu juga dipakai
-- owner saat menginput pengeluaran manual (mis. "wifi xl", "pasang indihome"),
-- sehingga pengeluaran manual ikut tertandai sebagai hasil auto post fixed cost.
-- Akibatnya getBepFinancials() membuangnya dari perhitungan pengeluaran — biaya
-- nyata yang tidak pernah masuk BEP.
--
-- Baris yang benar-benar hasil auto post selalu memakai nama item fixed cost
-- sebagai deskripsi (versi kode lama menambahkan akhiran " bulan <Bulan>"), jadi
-- baris yang deskripsinya tidak cocok dengan item fixed cost mana pun di klinik
-- yang sama pasti input manual. Nominal sengaja tidak ikut dicocokkan: nominal
-- item fixed cost bisa berubah sewaktu-waktu, sedangkan baris lama menyimpan
-- nominal saat diposting.
--
-- Applied directly against the Supabase project via MCP apply_migration on
-- 2026-07-30.

update owner_expenditures oe
set is_auto_fixed_cost = false
where oe.is_auto_fixed_cost = true
  and oe.payroll_record_id is null
  and not exists (
    select 1
    from clinic_fixed_costs f
    where f.clinic_id = oe.clinic_id
      and (
        lower(trim(oe.description)) = lower(trim(f.item_name))
        or lower(trim(oe.description)) like lower(trim(f.item_name)) || ' %'
      )
  );
