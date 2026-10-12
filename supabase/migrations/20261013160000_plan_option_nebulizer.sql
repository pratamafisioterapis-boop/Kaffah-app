-- Tambah pilihan modalitas elektrofisis: Nebulizer.
insert into public.plan_options(category,name,sort_order) values
('epa','Nebulizer',17)
on conflict (category, name) do nothing;
