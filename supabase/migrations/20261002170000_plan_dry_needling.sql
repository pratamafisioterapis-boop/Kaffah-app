-- Tambah Dry needling ke pilihan manual therapy Plan SOAP.
insert into public.plan_options(category,name,sort_order) values
('manual','Dry needling',15)
on conflict (category, name) do nothing;
