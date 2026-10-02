-- EMS, PRWE, Boston CTS Questionnaire, HOOS, PSFS: token isian bebas di
-- template Objective diganti token form pop-up.
update public.operational_options
set objective_template = replace(replace(replace(replace(replace(objective_template, 'Elderly Mobility Scale (.....)/20', '{{form:ems}}'), 'PRWE (.....)', '{{form:prwe}}'), 'Boston Carpal Tunnel Questionnaire (.....)', '{{form:bctsq}}'), 'HOOS (.....)', '{{form:hoos}}'), 'PSFS (.....)/10', '{{form:psfs}}')
where objective_template is not null;
