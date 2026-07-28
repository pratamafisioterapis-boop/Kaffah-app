-- Add optional accounting category/subcategory assignment to inventory_items.
-- Nullable so existing items (and other clinics) keep working unchanged;
-- take_inventory_stock() falls back to the previous hardcoded literals when null.
-- A trigger enforces that an assigned category/subcategory belongs to the
-- same clinic_id as the inventory item (owner explicitly requested this
-- cross-tenant safety check on top of the plain FK).

alter table public.inventory_items
  add column category_id uuid references public.accounting_categories(id) on delete set null,
  add column subcategory_id uuid references public.accounting_subcategories(id) on delete set null;

create index if not exists idx_inventory_items_category_id on public.inventory_items(category_id);
create index if not exists idx_inventory_items_subcategory_id on public.inventory_items(subcategory_id);

create or replace function public.check_inventory_item_category_clinic()
returns trigger
language plpgsql
as $$
declare
  v_cat_clinic uuid;
  v_sub_clinic uuid;
begin
  if new.category_id is not null then
    select clinic_id into v_cat_clinic from public.accounting_categories where id = new.category_id;
    if v_cat_clinic is distinct from new.clinic_id then
      raise exception 'category_id % does not belong to clinic %', new.category_id, new.clinic_id;
    end if;
  end if;

  if new.subcategory_id is not null then
    select clinic_id into v_sub_clinic from public.accounting_subcategories where id = new.subcategory_id;
    if v_sub_clinic is distinct from new.clinic_id then
      raise exception 'subcategory_id % does not belong to clinic %', new.subcategory_id, new.clinic_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_inventory_item_category_clinic on public.inventory_items;
create trigger trg_inventory_item_category_clinic
  before insert or update of category_id, subcategory_id on public.inventory_items
  for each row execute function public.check_inventory_item_category_clinic();
