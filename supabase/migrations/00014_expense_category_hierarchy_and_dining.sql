alter table public.expense_categories
  add column if not exists parent_category_id uuid references public.expense_categories(id) on delete restrict;

create index if not exists idx_expense_categories_parent_category_id
  on public.expense_categories(parent_category_id);

with base as (
  select couple_id
  from public.expense_categories
  where name = '食費'
  order by created_at asc
  limit 1
), inserted_parent as (
  insert into public.expense_categories (couple_id, name, is_default, sort_order)
  select base.couple_id, '外食', true, 2
  from base
  where not exists (
    select 1 from public.expense_categories ec
    where ec.couple_id = base.couple_id and ec.name = '外食' and ec.parent_category_id is null
  )
  returning id, couple_id
), parent_row as (
  select id, couple_id from inserted_parent
  union all
  select ec.id, ec.couple_id
  from public.expense_categories ec
  join base on base.couple_id = ec.couple_id
  where ec.name = '外食' and ec.parent_category_id is null
  limit 1
)
insert into public.expense_categories (couple_id, name, is_default, sort_order, parent_category_id)
select pr.couple_id, v.name, true, v.sort_order, pr.id
from parent_row pr
cross join (values
  ('食事'::text, 201),
  ('飲み会'::text, 202),
  ('カフェ'::text, 203)
) as v(name, sort_order)
where not exists (
  select 1
  from public.expense_categories ec
  where ec.couple_id = pr.couple_id
    and ec.name = v.name
    and ec.parent_category_id = pr.id
);
