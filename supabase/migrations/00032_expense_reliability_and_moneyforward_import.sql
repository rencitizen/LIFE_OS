-- Expense reliability hardening: canonical dining hierarchy, transaction-vs-snapshot semantics,
-- idempotent MoneyForward import, and DB-level split consistency.

alter table public.expenses
  add column if not exists record_kind text not null default 'transaction',
  add column if not exists counts_toward_totals boolean not null default true,
  add column if not exists external_provider text,
  add column if not exists external_id text,
  add column if not exists import_meta jsonb not null default '{}'::jsonb;

alter table public.expenses drop constraint if exists expenses_record_kind_check;
alter table public.expenses add constraint expenses_record_kind_check
  check (record_kind in ('transaction','monthly_snapshot'));
alter table public.expenses drop constraint if exists expenses_snapshot_not_settlement_check;
alter table public.expenses add constraint expenses_snapshot_not_settlement_check
  check (record_kind = 'transaction' or is_settlement_target = false);

alter table public.expenses drop constraint if exists expenses_source_check;
alter table public.expenses add constraint expenses_source_check
  check (source = any (array['manual','shopping_list','ocr','auto','moneyforward_screenshot','moneyforward_csv','chatgpt']::text[]));

create unique index if not exists expenses_external_provider_id_unique
  on public.expenses(couple_id, external_provider, external_id)
  where external_provider is not null and external_id is not null;

-- MoneyForward records currently stored in the DB are monthly/category snapshots.
update public.expenses
set record_kind = 'monthly_snapshot',
    counts_toward_totals = case when expense_date < date '2026-08-01' then true else false end,
    is_settlement_target = false,
    split_profile_id = null,
    split_mode = 'none'
where source = 'moneyforward_screenshot';

delete from public.expense_splits s
using public.expenses e
where s.expense_id = e.id and e.record_kind = 'monthly_snapshot';

-- Canonical hierarchy: 食費 (with optional 食料品) and 外食 > 食事 / 飲み会 / カフェ.
do $$
declare
  r record;
  v_food uuid;
  v_dining uuid;
begin
  for r in select distinct couple_id from public.expense_categories where couple_id is not null loop
    select id into v_food from public.expense_categories where couple_id=r.couple_id and name='食費' order by created_at limit 1;
    select id into v_dining from public.expense_categories where couple_id=r.couple_id and name='外食' order by created_at limit 1;
    if v_dining is not null then
      update public.expense_categories set parent_category_id=null, sort_order=2 where id=v_dining;
      update public.expense_categories set parent_category_id=v_dining
       where couple_id=r.couple_id and name in ('食事','飲み会','カフェ');
    end if;
    if v_food is not null then
      update public.expense_categories set parent_category_id=v_food
       where couple_id=r.couple_id and name='食料品';
    end if;
  end loop;
end $$;

-- ChatGPT rows recorded directly against the 外食 parent are normal meals.
update public.expenses e
set category_id = meal.id
from public.expense_categories dining
join public.expense_categories meal on meal.couple_id=dining.couple_id and meal.parent_category_id=dining.id and meal.name='食事'
where e.category_id=dining.id
  and dining.name='外食'
  and e.source='chatgpt';

create or replace function public.resolve_expense_category_id(
  p_couple_id uuid,
  p_category_name text,
  p_parent_category_name text default null
) returns uuid
language plpgsql stable security definer set search_path=public as $$
declare
  v_name text := btrim(p_category_name);
  v_parent text := nullif(btrim(p_parent_category_name),'');
  v_id uuid;
  v_count integer;
begin
  if v_name is null or v_name='' then raise exception 'category_is_required'; end if;
  if v_name='外食' then v_name:='食事'; v_parent:='外食'; end if;
  if v_name in ('食事','飲み会','カフェ') then v_parent:='外食'; end if;

  select count(*), (array_agg(c.id))[1] into v_count,v_id
  from public.expense_categories c
  left join public.expense_categories p on p.id=c.parent_category_id
  where c.couple_id=p_couple_id and btrim(c.name)=v_name
    and (v_parent is null or btrim(p.name)=v_parent);
  if v_count=0 then raise exception 'category_not_found: %',v_name; end if;
  if v_count>1 then raise exception 'category_is_ambiguous: %',v_name; end if;
  return v_id;
end $$;
revoke all on function public.resolve_expense_category_id(uuid,text,text) from public,anon,authenticated;
grant execute on function public.resolve_expense_category_id(uuid,text,text) to service_role;

create or replace function public.ensure_expense_split_consistency()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.rebuild_expense_splits(new.id);
  return new;
end $$;

drop trigger if exists trg_expense_split_consistency on public.expenses;
create trigger trg_expense_split_consistency
after insert or update of amount,expense_date,expense_type,is_settlement_target on public.expenses
for each row when (new.record_kind='transaction')
execute function public.ensure_expense_split_consistency();

-- Repair every transaction that was marked for settlement but missed its split snapshot.
do $$ declare r record; begin
  for r in
    select e.id from public.expenses e
    where e.record_kind='transaction' and e.is_settlement_target=true
      and not exists (select 1 from public.expense_splits s where s.expense_id=e.id)
  loop
    perform public.rebuild_expense_splits(r.id);
  end loop;
end $$;

create or replace function public.register_chatgpt_expense(
  p_paid_by uuid,
  p_amount numeric,
  p_expense_date date,
  p_category_name text,
  p_description text default null,
  p_is_settlement_target boolean default false,
  p_payment_method text default null,
  p_raw_input text default null,
  p_expense_type text default null,
  p_parent_category_name text default null
) returns table(expense_id uuid,category_id uuid,split_profile_id uuid,split_mode text)
language plpgsql security definer set search_path=public as $$
declare
  v_couple uuid; v_category uuid; v_type text; v_id uuid; v_row public.expenses%rowtype;
begin
  if p_amount is null or p_amount<=0 then raise exception 'amount_must_be_positive'; end if;
  if p_expense_date is null then raise exception 'expense_date_is_required'; end if;
  if p_payment_method is not null and p_payment_method not in ('cash','card','transfer') then raise exception 'invalid_payment_method'; end if;
  select couple_id into v_couple from public.users where id=p_paid_by;
  if v_couple is null then raise exception 'payer_not_found_or_not_in_couple'; end if;
  if auth.uid() is not null and auth.uid()<>p_paid_by then raise exception 'payer_must_match_authenticated_user'; end if;
  v_type:=coalesce(nullif(btrim(p_expense_type),''),case when p_is_settlement_target then 'shared' else 'personal' end);
  if v_type not in ('personal','shared') then raise exception 'invalid_expense_type'; end if;
  if p_is_settlement_target and v_type<>'shared' then raise exception 'settlement_target_must_be_shared'; end if;
  v_category:=public.resolve_expense_category_id(v_couple,p_category_name,p_parent_category_name);

  insert into public.expenses(couple_id,paid_by,amount,currency,category_id,description,expense_date,expense_type,payment_method,is_fixed,source,is_settlement_target,record_kind,counts_toward_totals)
  values(v_couple,p_paid_by,p_amount,'JPY',v_category,nullif(btrim(p_description),''),p_expense_date,v_type,p_payment_method,false,'chatgpt',p_is_settlement_target,'transaction',true)
  returning id into v_id;

  insert into public.finance_action_logs(couple_id,user_id,expense_id,source,action,raw_input,payload,status)
  values(v_couple,p_paid_by,v_id,'chatgpt','create_expense',p_raw_input,
    jsonb_build_object('amount',p_amount,'expense_date',p_expense_date,'category_name',p_category_name,'parent_category_name',p_parent_category_name,'description',p_description,'expense_type',v_type,'is_settlement_target',p_is_settlement_target,'payment_method',p_payment_method),'executed');

  select * into v_row from public.expenses where id=v_id;
  return query select v_id,v_category,v_row.split_profile_id,v_row.split_mode;
end $$;

revoke all on function public.register_chatgpt_expense(uuid,numeric,date,text,text,boolean,text,text,text,text) from public,anon;
grant execute on function public.register_chatgpt_expense(uuid,numeric,date,text,text,boolean,text,text,text,text) to authenticated,service_role;

create or replace function public.upsert_moneyforward_expense(
  p_user_id uuid,
  p_paid_by uuid,
  p_amount numeric,
  p_expense_date date,
  p_category_name text,
  p_description text,
  p_external_id text default null,
  p_parent_category_name text default null,
  p_is_settlement_target boolean default false,
  p_payment_method text default null,
  p_raw_payload jsonb default '{}'::jsonb
) returns table(expense_id uuid,result_status text,matched_by text)
language plpgsql security definer set search_path=public as $$
declare
  v_couple uuid; v_category uuid; v_existing uuid; v_n integer; v_norm text;
begin
  if p_amount is null or p_amount<=0 then raise exception 'amount_must_be_positive'; end if;
  select couple_id into v_couple from public.users where id=p_user_id;
  if v_couple is null then raise exception 'user_not_found_or_not_in_couple'; end if;
  if not exists(select 1 from public.users where id=p_paid_by and couple_id=v_couple) then raise exception 'payer_not_in_user_couple'; end if;
  v_category:=public.resolve_expense_category_id(v_couple,p_category_name,p_parent_category_name);

  if nullif(btrim(p_external_id),'') is not null then
    select id into v_existing from public.expenses where couple_id=v_couple and external_provider='moneyforward' and external_id=btrim(p_external_id) limit 1;
    if v_existing is not null then
      update public.expenses set import_meta=coalesce(import_meta,'{}'::jsonb)||coalesce(p_raw_payload,'{}'::jsonb) where id=v_existing;
      return query select v_existing,'unchanged'::text,'external_id'::text; return;
    end if;
  end if;

  v_norm:=lower(regexp_replace(coalesce(btrim(p_description),''),'[[:space:]　[:punct:]]+','','g'));
  select count(*),(array_agg(e.id order by abs(e.expense_date-p_expense_date),e.created_at))[1]
    into v_n,v_existing
  from public.expenses e
  where e.couple_id=v_couple and e.record_kind='transaction' and e.paid_by=p_paid_by and e.amount=p_amount
    and e.expense_date between p_expense_date-1 and p_expense_date+1
    and lower(regexp_replace(coalesce(btrim(e.description),''),'[[:space:]　[:punct:]]+','','g'))=v_norm;
  if v_n>1 then raise exception 'ambiguous_duplicate_candidate'; end if;
  if v_n=1 then
    update public.expenses set external_provider='moneyforward',external_id=nullif(btrim(p_external_id),''),import_meta=coalesce(import_meta,'{}'::jsonb)||coalesce(p_raw_payload,'{}'::jsonb) where id=v_existing;
    return query select v_existing,'linked_existing'::text,'fuzzy'::text; return;
  end if;

  insert into public.expenses(couple_id,paid_by,amount,currency,category_id,description,expense_date,expense_type,payment_method,is_fixed,source,is_settlement_target,record_kind,counts_toward_totals,external_provider,external_id,import_meta)
  values(v_couple,p_paid_by,p_amount,'JPY',v_category,nullif(btrim(p_description),''),p_expense_date,case when p_is_settlement_target then 'shared' else 'personal' end,p_payment_method,false,'moneyforward_csv',p_is_settlement_target,'transaction',true,'moneyforward',nullif(btrim(p_external_id),''),coalesce(p_raw_payload,'{}'::jsonb))
  returning id into v_existing;
  return query select v_existing,'inserted'::text,'none'::text;
end $$;
revoke all on function public.upsert_moneyforward_expense(uuid,uuid,numeric,date,text,text,text,text,boolean,text,jsonb) from public,anon,authenticated;
grant execute on function public.upsert_moneyforward_expense(uuid,uuid,numeric,date,text,text,text,text,boolean,text,jsonb) to service_role;