-- Tambah pilihan modalitas elektrofisis: Recovery pump.
insert into public.plan_options(category,name,sort_order) values
('epa','Recovery pump',16)
on conflict (category, name) do nothing;
