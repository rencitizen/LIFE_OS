-- Fix UUID category lookup in register_chatgpt_expense.
-- PostgreSQL does not provide min(uuid), so resolve count and id separately.

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
)
returns table (
  expense_id uuid,
  category_id uuid,
  split_profile_id uuid,
  split_mode text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_category_id uuid;
  v_category_count integer;
  v_expense_type text;
  v_profile_id uuid;
  v_member_count integer;
  v_ratio_sum numeric;
  v_expense_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount_must_be_positive';
  end if;

  if p_expense_date is null then
    raise exception 'expense_date_is_required';
  end if;

  if nullif(btrim(p_category_name), '') is null then
    raise exception 'category_is_required';
  end if;

  if p_payment_method is not null
     and p_payment_method not in ('cash', 'card', 'transfer') then
    raise exception 'invalid_payment_method';
  end if;

  select u.couple_id
    into v_couple_id
  from public.users u
  where u.id = p_paid_by;

  if v_couple_id is null then
    raise exception 'payer_not_found_or_not_in_couple';
  end if;

  if auth.uid() is not null and auth.uid() <> p_paid_by then
    raise exception 'payer_must_match_authenticated_user';
  end if;

  v_expense_type := coalesce(
    nullif(btrim(p_expense_type), ''),
    case when p_is_settlement_target then 'shared' else 'personal' end
  );

  if v_expense_type not in ('personal', 'shared') then
    raise exception 'invalid_expense_type';
  end if;

  if p_is_settlement_target and v_expense_type <> 'shared' then
    raise exception 'settlement_target_must_be_shared';
  end if;

  select count(*)
    into v_category_count
  from public.expense_categories c
  left join public.expense_categories parent on parent.id = c.parent_category_id
  where c.couple_id = v_couple_id
    and btrim(c.name) = btrim(p_category_name)
    and (
      p_parent_category_name is null
      or btrim(parent.name) = btrim(p_parent_category_name)
    );

  if v_category_count = 0 then
    raise exception 'category_not_found: %', p_category_name;
  end if;

  if v_category_count > 1 then
    raise exception 'category_is_ambiguous: %', p_category_name;
  end if;

  select c.id
    into v_category_id
  from public.expense_categories c
  left join public.expense_categories parent on parent.id = c.parent_category_id
  where c.couple_id = v_couple_id
    and btrim(c.name) = btrim(p_category_name)
    and (
      p_parent_category_name is null
      or btrim(parent.name) = btrim(p_parent_category_name)
    )
  limit 1;

  if p_is_settlement_target then
    select p.id
      into v_profile_id
    from public.expense_split_profiles p
    where p.couple_id = v_couple_id
      and p.effective_from <= p_expense_date
      and (p.effective_to is null or p.effective_to >= p_expense_date)
    order by p.effective_from desc
    limit 1;

    if v_profile_id is null then
      raise exception 'no_active_split_profile_for_date: %', p_expense_date;
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
  end if;

  insert into public.expenses (
    couple_id,
    paid_by,
    amount,
    currency,
    category_id,
    description,
    expense_date,
    expense_type,
    payment_method,
    is_fixed,
    source,
    split_profile_id,
    split_mode,
    is_settlement_target
  ) values (
    v_couple_id,
    p_paid_by,
    p_amount,
    'JPY',
    v_category_id,
    nullif(btrim(p_description), ''),
    p_expense_date,
    v_expense_type,
    p_payment_method,
    false,
    'chatgpt',
    case when p_is_settlement_target then v_profile_id else null end,
    case when p_is_settlement_target then 'standard' else 'none' end,
    p_is_settlement_target
  )
  returning id into v_expense_id;

  if p_is_settlement_target then
    with profile_members as (
      select
        m.user_id,
        m.ratio,
        round(p_amount * m.ratio) as rounded_amount,
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
            order by rn
            rows between unbounded preceding and 1 preceding
          ),
          0
        ) as prior_amount
      from profile_members
    )
    insert into public.expense_splits (
      expense_id,
      user_id,
      ratio,
      amount,
      is_settled
    )
    select
      v_expense_id,
      user_id,
      ratio,
      case
        when rn = cnt then p_amount - prior_amount
        else rounded_amount
      end,
      false
    from allocated;
  end if;

  insert into public.finance_action_logs (
    couple_id,
    user_id,
    expense_id,
    source,
    action,
    raw_input,
    payload,
    status
  ) values (
    v_couple_id,
    p_paid_by,
    v_expense_id,
    'chatgpt',
    'create_expense',
    p_raw_input,
    jsonb_build_object(
      'amount', p_amount,
      'expense_date', p_expense_date,
      'category_name', p_category_name,
      'parent_category_name', p_parent_category_name,
      'description', p_description,
      'expense_type', v_expense_type,
      'is_settlement_target', p_is_settlement_target,
      'payment_method', p_payment_method,
      'split_profile_id', v_profile_id
    ),
    'executed'
  );

  return query
  select
    v_expense_id,
    v_category_id,
    case when p_is_settlement_target then v_profile_id else null end,
    case when p_is_settlement_target then 'standard'::text else 'none'::text end;
end;
$$;