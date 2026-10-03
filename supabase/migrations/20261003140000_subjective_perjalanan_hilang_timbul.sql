-- Ganti opsi "naik turun" menjadi "hilang-timbul" pada pilihan perjalanan keluhan Subjective
update public.operational_options
   set subjective_template = replace(subjective_template, '(membaik/menetap/memburuk/naik turun)', '(membaik/menetap/memburuk/hilang-timbul)')
 where category = 'diagnosa'
   and subjective_template like '%(membaik/menetap/memburuk/naik turun)%';
