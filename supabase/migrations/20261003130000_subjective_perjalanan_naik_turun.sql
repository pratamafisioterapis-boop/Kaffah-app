-- Tambah opsi "naik turun" (kadang membaik, kadang memburuk) pada pilihan perjalanan keluhan Subjective
update public.operational_options
   set subjective_template = replace(subjective_template, '(membaik/menetap/memburuk)', '(membaik/menetap/memburuk/naik turun)')
 where category = 'diagnosa'
   and subjective_template like '%(membaik/menetap/memburuk)%';
