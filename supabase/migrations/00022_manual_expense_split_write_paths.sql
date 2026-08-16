create or replace function public.rebuild_expense_splits(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense public.expenses%rowtype;
  v_profile_id uuid;
  v_member_count integer;
  v_ratio_sum numeric;
begin
  select * into v_expense
  from public.expenses e
  where e.id = p_expense_id;

  if not found then
    raise exception 'expense_not_found';
  end if;

  if exists (
    select 1 from public.expense_splits s
    where s.expense_id = p_expense_id and s.is_settled = true
  ) then
    raise exception 'settled_expense_cannot_be_rebuilt';
  end if;

  delete from public.expense_splits where expense_id = p_expense_id;

  if not v_expense.is_settlement_target then
    update public.expenses
    set split_profile_id = null,
        split_mode = 'none'
    where id = p_expense_id;
    return;
  end if;

  if v_expense.expense_type <> 'shared' then
    raise exception 'settlement_target_must_be_shared';
  end if;

  select p.id into v_profile_id
  from public.expense_split_profiles p
  where p.couple_id = v_expense.couple_id
    and p.effective_from <= v_expense.expense_date
    and (p.effective_to is null or p.effective_to >= v_expense.expense_date)
  order by p.effective_from desc
  limit 1;

  if v_profile_id is null then
    raise exception 'no_active_split_profile_for_date: %', v_expense.expense_date;
  end if;

  select count(*), coalesce(sum(m.ratio), 0)
    into v_member_count, v_ratio_sum
  from public.expense_split_profile_members m
  where m.profile_id = v_profile_id;

  if v_member_count < 2 then
    raise exception 'split_profile_requires_at_least_two_members';
  end if;

  if abs(v_ratio_sum - 1) > 0.00001 then
    raise exception 'split_profile_ratio_must_sum_to_one';
  end if;

  update public.expenses
  set split_profile_id = v_profile_id,
      split_mode = 'standard'
  where id = p_expense_id;

  with profile_members as (
    select
      m.user_id,
      m.ratio,
      round(v_expense.amount * m.ratio) as rounded_amount,
      row_number() over (order by m.user_id) as rn,
      count(*) over () as cnt
    from public.expense_split_profile_members m
    where m.profile_id = v_profile_id
  ), allocated as (
    select
      user_id,
      ratio,
      rn,
      cnt,
      rounded_amount,
      coalesce(
        sum(rounded_amount) over (
          order by rn rows between unbounded preceding and 1 preceding
        ),
        0
      ) as prior_amount
    from profile_members
  )
  insert into public.expense_splits (expense_id, user_id, ratio, amount, is_settled)
  select
    p_expense_id,
    user_id,
    ratio,
    case when rn = cnt then v_expense.amount - prior_amount else rounded_amount end,
    false
  from allocated;
end;
$$;

revoke all on function public.rebuild_expense_splits(uuid) from public, anon, authenticated;
grant execute on function public.rebuild_expense_splits(uuid) to service_role;

create or replace function public.register_manual_expense(
  p_user_id uuid,
  p_paid_by uuid,
  p_amount numeric,
  p_expense_date date,
  p_category_id uuid,
  p_description text default null,
  p_is_settlement_target boolean default false,
  p_payment_method text default null,
  p_expense_type text default null
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_expense_type text;
  v_expense public.expenses%rowtype;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'amount_must_be_positive'; end if;
  if p_expense_date is null then raise exception 'expense_date_is_required'; end if;
  if p_category_id is null then raise exception 'category_is_required'; end if;
  if p_payment_method is not null and p_payment_method not in ('cash','card','transfer') then
    raise exception 'invalid_payment_method';
  end if;

  select u.couple_id into v_couple_id
  from public.users u where u.id = p_user_id;

  if v_couple_id is null then raise exception 'user_not_found_or_not_in_couple'; end if;
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'user_must_match_authenticated_user';
  end if;

  if not exists (select 1 from public.users u where u.id = p_paid_by and u.couple_id = v_couple_id) then
    raise exception 'payer_not_in_user_couple';
  end if;
  if not exists (select 1 from public.expense_categories c where c.id = p_category_id and c.couple_id = v_couple_id) then
    raise exception 'category_not_in_user_couple';
  end if;

  v_expense_type := coalesce(nullif(btrim(p_expense_type), ''), case when p_is_settlement_target then 'shared' else 'personal' end);
  if v_expense_type not in ('personal','shared') then raise exception 'invalid_expense_type'; end if;
  if p_is_settlement_target and v_expense_type <> 'shared' then raise exception 'settlement_target_must_be_shared'; end if;

  insert into public.expenses (
    couple_id, paid_by, amount, currency, category_id, description,
    expense_date, expense_type, payment_method, is_fixed, source,
    split_profile_id, split_mode, is_settlement_target
  ) values (
    v_couple_id, p_paid_by, p_amount, 'JPY', p_category_id, nullif(btrim(p_description), ''),
    p_expense_date, v_expense_type, p_payment_method, false, 'manual',
    null, 'none', p_is_settlement_target
  ) returning * into v_expense;

  perform public.rebuild_expense_splits(v_expense.id);
  select * into v_expense from public.expenses where id = v_expense.id;
  return v_expense;
end;
$$;

revoke all on function public.register_manual_expense(uuid,uuid,numeric,date,uuid,text,boolean,text,text) from public, anon;
grant execute on function public.register_manual_expense(uuid,uuid,numeric,date,uuid,text,boolean,text,text) to authenticated, service_role;

create or replace function public.update_expense_with_splits(
  p_user_id uuid,
  p_expense_id uuid,
  p_amount numeric,
  p_expense_date date,
  p_category_id uuid,
  p_description text,
  p_is_settlement_target boolean,
  p_payment_method text,
  p_expense_type text
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_existing public.expenses%rowtype;
  v_expense public.expenses%rowtype;
begin
  select u.couple_id into v_couple_id from public.users u where u.id = p_user_id;
  if v_couple_id is null then raise exception 'user_not_found_or_not_in_couple'; end if;
  if auth.uid() is not null and auth.uid() <> p_user_id then raise exception 'user_must_match_authenticated_user'; end if;

  select * into v_existing from public.expenses e where e.id = p_expense_id;
  if not found then raise exception 'expense_not_found'; end if;
  if v_existing.couple_id <> v_couple_id then raise exception 'expense_not_in_user_couple'; end if;
  if exists (select 1 from public.expense_splits s where s.expense_id = p_expense_id and s.is_settled = true) then
    raise exception 'settled_expense_cannot_be_updated';
  end if;

  if p_amount is null or p_amount <= 0 then raise exception 'amount_must_be_positive'; end if;
  if p_expense_date is null then raise exception 'expense_date_is_required'; end if;
  if p_category_id is null then raise exception 'category_is_required'; end if;
  if not exists (select 1 from public.expense_categories c where c.id = p_category_id and c.couple_id = v_couple_id) then
    raise exception 'category_not_in_user_couple';
  end if;
  if p_expense_type not in ('personal','shared') then raise exception 'invalid_expense_type'; end if;
  if p_is_settlement_target and p_expense_type <> 'shared' then raise exception 'settlement_target_must_be_shared'; end if;
  if p_payment_method is not null and p_payment_method not in ('cash','card','transfer') then raise exception 'invalid_payment_method'; end if;

  update public.expenses
  set amount = p_amount,
      expense_date = p_expense_date,
      category_id = p_category_id,
      description = nullif(btrim(p_description), ''),
      is_settlement_target = p_is_settlement_target,
      expense_type = p_expense_type,
      payment_method = p_payment_method
  where id = p_expense_id
  returning * into v_expense;

  perform public.rebuild_expense_splits(p_expense_id);
  select * into v_expense from public.expenses where id = p_expense_id;
  return v_expense;
end;
$$;

revoke all on function public.update_expense_with_splits(uuid,uuid,numeric,date,uuid,text,boolean,text,text) from public, anon;
grant execute on function public.update_expense_with_splits(uuid,uuid,numeric,date,uuid,text,boolean,text,text) to authenticated, service_role;
