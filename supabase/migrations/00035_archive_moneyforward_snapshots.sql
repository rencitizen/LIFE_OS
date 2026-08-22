-- Keep legacy monthly/category MoneyForward summaries as reference data without letting them
-- participate in the transaction ledger once detailed rows are available.
create table if not exists public.expense_monthly_snapshots (
  id uuid primary key default gen_random_uuid(),
  original_expense_id uuid not null unique,
  couple_id uuid not null references public.couples(id) on delete cascade,
  snapshot_month date not null,
  payload jsonb not null,
  archived_at timestamptz not null default now()
);
create index if not exists expense_monthly_snapshots_couple_month_idx
  on public.expense_monthly_snapshots(couple_id,snapshot_month desc);
alter table public.expense_monthly_snapshots enable row level security;
drop policy if exists "Couple can view expense snapshots" on public.expense_monthly_snapshots;
create policy "Couple can view expense snapshots" on public.expense_monthly_snapshots for select
  using (couple_id=public.get_couple_id());
revoke all on public.expense_monthly_snapshots from anon;
grant select on public.expense_monthly_snapshots to authenticated;
grant all on public.expense_monthly_snapshots to service_role;

create or replace function public.archive_moneyforward_snapshots_for_month(p_couple_id uuid,p_month date)
returns integer language plpgsql security definer set search_path=public as $$
declare v_n integer;
begin
  insert into public.expense_monthly_snapshots(original_expense_id,couple_id,snapshot_month,payload)
  select e.id,e.couple_id,date_trunc('month',e.expense_date)::date,to_jsonb(e)
  from public.expenses e
  where e.couple_id=p_couple_id and e.record_kind='monthly_snapshot'
    and e.expense_date>=date_trunc('month',p_month)::date
    and e.expense_date<(date_trunc('month',p_month)+interval '1 month')::date
  on conflict (original_expense_id) do nothing;
  get diagnostics v_n=row_count;
  delete from public.expenses e
  where e.couple_id=p_couple_id and e.record_kind='monthly_snapshot'
    and e.expense_date>=date_trunc('month',p_month)::date
    and e.expense_date<(date_trunc('month',p_month)+interval '1 month')::date;
  return v_n;
end $$;
revoke all on function public.archive_moneyforward_snapshots_for_month(uuid,date) from public,anon,authenticated;
grant execute on function public.archive_moneyforward_snapshots_for_month(uuid,date) to service_role;

-- Current transition month: detailed ChatGPT entries now own August, so archive the old aggregate rows.
do $$ declare v_couple uuid; begin
  for v_couple in select distinct couple_id from public.expenses where record_kind='monthly_snapshot' and expense_date>=date '2026-08-01' and expense_date<date '2026-09-01'
  loop
    perform public.archive_moneyforward_snapshots_for_month(v_couple,date '2026-08-01');
  end loop;
end $$;

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

  -- The first detailed row for a month retires any old aggregate snapshot rows for that month.
  perform public.archive_moneyforward_snapshots_for_month(v_couple,p_expense_date);

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