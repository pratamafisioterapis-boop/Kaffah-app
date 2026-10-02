-- IKDC, VISA-P/A, CAIT, HAQ-DI, Fugl-Meyer, SCIM III, CSI, Tinetti, PRTEE:
-- token isian bebas di template Objective diganti token form pop-up.
update public.operational_options
set objective_template = replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(objective_template, 'IKDC (.....)/100', '{{form:ikdc}}'), 'VISA-P (.....)/100', '{{form:visap}}'), 'VISA-A (.....)/100', '{{form:visaa}}'), 'CAIT (.....)/30', '{{form:cait}}'), 'HAQ-DI (.....)', '{{form:haqdi}}'), 'Fugl-Meyer (.....)', '{{form:fugl}}'), 'SCIM III (.....)/100', '{{form:scim}}'), 'CSI (.....)/100', '{{form:csi}}'), 'Tinetti (.....)/28', '{{form:tinetti}}'), 'PRTEE (.....)/100', '{{form:prtee}}')
where objective_template is not null;
