create or replace function public.update_chatgpt_expense(
  p_expense_id uuid,
  p_user_id uuid,
  p_amount numeric default null,
  p_expense_date date default null,
  p_category_name text default null,
  p_description text default null,
  p_is_settlement_target boolean default null,
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
  v_old public.expenses%rowtype;
  v_couple_id uuid;
  v_category_id uuid;
  v_category_count integer;
  v_amount numeric;
  v_expense_date date;
  v_expense_type text;
  v_is_settlement_target boolean;
  v_profile_id uuid;
  v_member_count integer;
  v_ratio_sum numeric;
begin
  select *
    into v_old
  from public.expenses e
  where e.id = p_expense_id;

  if not found then
    raise exception 'expense_not_found';
  end if;

  select u.couple_id
    into v_couple_id
  from public.users u
  where u.id = p_user_id;

  if v_couple_id is null or v_couple_id <> v_old.couple_id then
    raise exception 'expense_not_in_user_couple';
  end if;

  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'user_must_match_authenticated_user';
  end if;

  if v_old.source <> 'chatgpt' then
    raise exception 'only_chatgpt_expenses_can_be_updated';
  end if;

  if exists (
    select 1
    from public.expense_splits s
    where s.expense_id = p_expense_id
      and s.is_settled = true
  ) then
    raise exception 'settled_expense_cannot_be_updated';
  end if;

  v_amount := coalesce(p_amount, v_old.amount);
  if v_amount <= 0 then
    raise exception 'amount_must_be_positive';
  end if;

  v_expense_date := coalesce(p_expense_date, v_old.expense_date);
  v_is_settlement_target := coalesce(p_is_settlement_target, v_old.is_settlement_target);
  v_expense_type := coalesce(nullif(btrim(p_expense_type), ''), v_old.expense_type);

  if v_expense_type not in ('personal', 'shared') then
    raise exception 'invalid_expense_type';
  end if;

  if v_is_settlement_target and v_expense_type <> 'shared' then
    raise exception 'settlement_target_must_be_shared';
  end if;

  if p_payment_method is not null
     and p_payment_method not in ('cash', 'card', 'transfer') then
    raise exception 'invalid_payment_method';
  end if;

  v_category_id := v_old.category_id;

  if nullif(btrim(p_category_name), '') is not null then
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
  end if;

  if v_is_settlement_target then
    select p.id
      into v_profile_id
    from public.expense_split_profiles p
    where p.couple_id = v_couple_id
      and p.effective_from <= v_expense_date
      and (p.effective_to is null or p.effective_to >= v_expense_date)
    order by p.effective_from desc
    limit 1;

    if v_profile_id is null then
      raise exception 'no_active_split_profile_for_date: %', v_expense_date;
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

  update public.expenses e
  set
    amount = v_amount,
    expense_date = v_expense_date,
    category_id = v_category_id,
    description = case when p_description is null then e.description else nullif(btrim(p_description), '') end,
    expense_type = v_expense_type,
    payment_method = case when p_payment_method is null then e.payment_method else p_payment_method end,
    is_settlement_target = v_is_settlement_target,
    split_profile_id = case when v_is_settlement_target then v_profile_id else null end,
    split_mode = case when v_is_settlement_target then 'standard' else 'none' end
  where e.id = p_expense_id;

  delete from public.expense_splits s
  where s.expense_id = p_expense_id;

  if v_is_settlement_target then
    with profile_members as (
      select
        m.user_id,
        m.ratio,
        round(v_amount * m.ratio) as rounded_amount,
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
      p_expense_id,
      user_id,
      ratio,
      case
        when rn = cnt then v_amount - prior_amount
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
    p_user_id,
    p_expense_id,
    'chatgpt',
    'update_expense',
    p_raw_input,
    jsonb_build_object(
      'before', jsonb_build_object(
        'amount', v_old.amount,
        'expense_date', v_old.expense_date,
        'category_id', v_old.category_id,
        'description', v_old.description,
        'expense_type', v_old.expense_type,
        'is_settlement_target', v_old.is_settlement_target,
        'payment_method', v_old.payment_method,
        'split_profile_id', v_old.split_profile_id,
        'split_mode', v_old.split_mode
      ),
      'after', jsonb_build_object(
        'amount', v_amount,
        'expense_date', v_expense_date,
        'category_id', v_category_id,
        'description', case when p_description is null then v_old.description else nullif(btrim(p_description), '') end,
        'expense_type', v_expense_type,
        'is_settlement_target', v_is_settlement_target,
        'payment_method', coalesce(p_payment_method, v_old.payment_method),
        'split_profile_id', v_profile_id,
        'split_mode', case when v_is_settlement_target then 'standard' else 'none' end
      )
    ),
    'executed'
  );

  return query
  select
    p_expense_id,
    v_category_id,
    case when v_is_settlement_target then v_profile_id else null end,
    case when v_is_settlement_target then 'standard'::text else 'none'::text end;
end;
$$;

revoke all on function public.update_chatgpt_expense(
  uuid, uuid, numeric, date, text, text, boolean, text, text, text, text
) from public;
revoke execute on function public.update_chatgpt_expense(
  uuid, uuid, numeric, date, text, text, boolean, text, text, text, text
) from anon;
grant execute on function public.update_chatgpt_expense(
  uuid, uuid, numeric, date, text, text, boolean, text, text, text, text
) to authenticated, service_role;
