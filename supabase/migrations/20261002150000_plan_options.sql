-- Pilihan checklist Plan SOAP: modalitas elektrofisis (epa) dan manual therapy (manual).
create table if not exists public.plan_options (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('epa', 'manual')),
  name text not null,
  sort_order int not null default 0,
  unique (category, name)
);
alter table public.plan_options enable row level security;
create policy "plan_options_read" on public.plan_options for select to authenticated using (true);
create policy "plan_options_write" on public.plan_options for all to authenticated
  using (public.get_my_role() = 'super_admin') with check (public.get_my_role() = 'super_admin');
insert into public.plan_options(category,name,sort_order) values
('epa','Hot pack',1),
('epa','Cold pack / cryotherapy',2),
('epa','Infrared (IR)',3),
('epa','TENS',4),
('epa','Ultrasound (US)',5),
('epa','Interferential current (IFC)',6),
('epa','Shortwave diathermy (SWD)',7),
('epa','Microwave diathermy (MWD)',8),
('epa','Low level laser (LLLT)',9),
('epa','Shockwave (ESWT)',10),
('epa','Electrical stimulation otot (NMES)',11),
('epa','Functional electrical stimulation (FES)',12),
('epa','Traksi mekanik',13),
('epa','Paraffin bath',14),
('epa','Magnetic therapy',15),
('manual','Soft tissue mobilization / massage',1),
('manual','Myofascial release',2),
('manual','Trigger point release',3),
('manual','Muscle energy technique (MET)',4),
('manual','Joint mobilization (Maitland)',5),
('manual','Mulligan (MWM / SNAGs)',6),
('manual','Traksi manual',7),
('manual','Neural mobilization',8),
('manual','Stretching pasif / PNF',9),
('manual','Kinesio taping',10),
('manual','IASTM',11),
('manual','Manipulasi (HVLA)',12),
('manual','Drainase limfatik manual',13),
('manual','Postural drainage, perkusi & vibrasi',14)
on conflict (category, name) do nothing;
