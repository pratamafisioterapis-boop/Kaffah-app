-- Kekuatan Otot pada diagnosa kaki/pergelangan kaki: ganti tes fungsional (single leg heel raise,
-- single leg stance) dengan MMT (0-5) per gerakan; tes fungsional dipindah ke bagian "Tes Fungsional".
update public.operational_options
   set objective_template = replace(
         objective_template,
         E'Kekuatan Otot\nSingle leg heel raise : (.....) repetisi\nSingle leg stance : (.....) detik',
         E'Kekuatan Otot\nKekuatan dorsofleksi (0-5) : (.....)\nKekuatan plantarfleksi (0-5) : (.....)\nKekuatan inversi (0-5) : (.....)\nKekuatan eversi (0-5) : (.....)\nTes Fungsional\nSingle leg heel raise : (.....) repetisi\nSingle leg stance : (.....) detik')
 where category = 'diagnosa'
   and objective_template like E'%Kekuatan Otot\nSingle leg heel raise : (.....) repetisi\nSingle leg stance : (.....) detik%';
