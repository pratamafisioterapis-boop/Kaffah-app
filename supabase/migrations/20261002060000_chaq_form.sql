-- CHAQ: token isian bebas di template Objective diganti form pop-up.
update public.operational_options
set objective_template = replace(objective_template, 'CHAQ (.....)', '{{form:chaq}}')
where objective_template like '%CHAQ (.....)%';
