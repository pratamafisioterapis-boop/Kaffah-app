-- Skala nyeri (0-10) dipindahkan dari template Subjective ke Objective (NPRS).
-- Subjective hanya memuat karakter nyeri. Template Objective yang belum punya
-- NPRS mendapat NPRS di awal baris "Pengukuran Luaran".
update public.operational_options
set objective_template = case
      when subjective_template ~ '(Intensitas 0-10|Nyeri 0-10)' and objective_template !~ 'NPRS'
      then replace(objective_template, '**Pengukuran Luaran:** ', '**Pengukuran Luaran:** NPRS (.....)/10 | ')
      else objective_template end,
    subjective_template = replace(replace(replace(replace(replace(replace(subjective_template,
      'Intensitas 0-10: sekarang (.....), terburuk (.....). ', ''),
      'Intensitas 0-10 (.....). ', ''),
      'Nyeri 0-10: sekarang (.....), terburuk (.....). ', 'Sifat nyeri (tajam/tumpul/terbakar/berdenyut/pegal). '),
      ' Intensitas 0-10: sekarang (.....), terburuk (.....).', ''),
      ' Intensitas 0-10 (.....).', ''),
      'Nyeri 0-10: sekarang (.....), terburuk (.....).', 'Sifat nyeri (tajam/tumpul/terbakar/berdenyut/pegal).')
where subjective_template ~ '(Intensitas 0-10|Nyeri 0-10)';
