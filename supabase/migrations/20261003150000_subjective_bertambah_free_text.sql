-- Tambah isian teks bebas setelah pilihan "Keluhan dirasakan bertambah saat/ketika (...)"
-- agar faktor pemberat yang tidak ada di pilihan bisa diketik manual.
update public.operational_options
   set subjective_template = regexp_replace(
         subjective_template,
         '(bertambah (?:saat|ketika) \([^()]*/[^()]*\))(?! \(\.{5}\))',
         '\1 (.....)',
         'g')
 where category = 'diagnosa'
   and subjective_template ~ 'bertambah (saat|ketika) \([^()]*/[^()]*\)(?! \(\.{5}\))';
