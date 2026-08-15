create or replace function public.preview_monthly_settlement(
  p_user_id uuid,
  p_month date
)
returns table (
  couple_id uuid,
  settlement_month date,
  from_user uuid,
  to_user uuid,
  amount numeric,
  expense_count bigint,
  gross_amount numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_month_start date;
  v_next_month date;
  v_member_count integer;
  v_partial_count integer;
  v_from_user uuid;
  v_to_user uuid;
  v_amount numeric := 0;
  v_expense_count bigint := 0;
  v_gross_amount numeric := 0;
begin
  if p_month is null then
    raise exception 'month_is_required';
  end if;

  select u.couple_id into v_couple_id
  from public.users u
  where u.id = p_user_id;

  if v_couple_id is null then
    raise exception 'user_not_found_or_not_in_couple';
  end if;

  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'user_must_match_authenticated_user';
  end if;

  select count(*) into v_member_count
  from public.users u
  where u.couple_id = v_couple_id;

  if v_member_count <> 2 then
    raise exception 'monthly_settlement_currently_requires_two_members';
  end if;

  v_month_start := date_trunc('month', p_month)::date;
  v_next_month := (v_month_start + interval '1 month')::date;

  select count(*) into v_partial_count
  from public.expenses e
  where e.couple_id = v_couple_id
    and e.is_settlement_target = true
    and e.expense_date >= v_month_start
    and e.expense_date < v_next_month
    and exists (
      select 1 from public.expense_splits s
      where s.expense_id = e.id and s.is_settled = true
    )
    and exists (
      select 1 from public.expense_splits s
      where s.expense_id = e.id and s.is_settled = false
    );

  if v_partial_count > 0 then
    raise exception 'partial_settlement_state_not_supported';
  end if;

  with target_expenses as (
    select e.id, e.paid_by, e.amount
    from public.expenses e
    where e.couple_id = v_couple_id
      and e.is_settlement_target = true
      and e.expense_date >= v_month_start
      and e.expense_date < v_next_month
      and exists (
        select 1 from public.expense_splits s
        where s.expense_id = e.id and s.is_settled = false
      )
      and not exists (
        select 1 from public.expense_splits s
        where s.expense_id = e.id and s.is_settled = true
      )
  ), members as (
    select u.id as user_id
    from public.users u
    where u.couple_id = v_couple_id
  ), paid as (
    select t.paid_by as user_id, sum(t.amount) as amount
    from target_expenses t
    group by t.paid_by
  ), owed as (
    select s.user_id, sum(s.amount) as amount
    from public.expense_splits s
    join target_expenses t on t.id = s.expense_id
    group by s.user_id
  ), net as (
    select
      m.user_id,
      coalesce(p.amount, 0) - coalesce(o.amount, 0) as net_amount
    from members m
    left join paid p on p.user_id = m.user_id
    left join owed o on o.user_id = m.user_id
  )
  select
    (array_agg(n.user_id order by n.net_amount asc) filter (where n.net_amount < 0))[1],
    (array_agg(n.user_id order by n.net_amount desc) filter (where n.net_amount > 0))[1],
    coalesce(max(-n.net_amount) filter (where n.net_amount < 0), 0)
  into v_from_user, v_to_user, v_amount
  from net n;

  select count(*), coalesce(sum(t.amount), 0)
    into v_expense_count, v_gross_amount
  from public.expenses t
  where t.couple_id = v_couple_id
    and t.is_settlement_target = true
    and t.expense_date >= v_month_start
    and t.expense_date < v_next_month
    and exists (
      select 1 from public.expense_splits s
      where s.expense_id = t.id and s.is_settled = false
    )
    and not exists (
      select 1 from public.expense_splits s
      where s.expense_id = t.id and s.is_settled = true
    );

  return query
  select
    v_couple_id,
    v_month_start,
    v_from_user,
    v_to_user,
    v_amount,
    v_expense_count,
    v_gross_amount;
end;
$$;

revoke execute on function public.preview_monthly_settlement(uuid, date) from anon;
revoke all on function public.preview_monthly_settlement(uuid, date) from public;
grant execute on function public.preview_monthly_settlement(uuid, date) to authenticated;
grant execute on function public.preview_monthly_settlement(uuid, date) to service_role;

create or replace function public.complete_monthly_settlement(
  p_user_id uuid,
  p_month date,
  p_memo text default null
)
returns table (
  settlement_id uuid,
  settlement_month date,
  from_user uuid,
  to_user uuid,
  amount numeric,
  expense_count bigint,
  gross_amount numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_preview record;
  v_settlement_id uuid;
  v_next_month date;
begin
  select * into v_preview
  from public.preview_monthly_settlement(p_user_id, p_month);

  if v_preview.expense_count = 0 then
    raise exception 'no_unsettled_expenses_for_month';
  end if;

  v_next_month := (v_preview.settlement_month + interval '1 month')::date;

  insert into public.settlements (
    couple_id,
    from_user,
    to_user,
    amount,
    settled_at,
    status,
    memo,
    settlement_month
  ) values (
    v_preview.couple_id,
    v_preview.from_user,
    v_preview.to_user,
    v_preview.amount,
    current_date,
    'done',
    nullif(btrim(p_memo), ''),
    v_preview.settlement_month
  )
  returning id into v_settlement_id;

  update public.expense_splits s
  set is_settled = true
  where s.is_settled = false
    and s.expense_id in (
      select e.id
      from public.expenses e
      where e.couple_id = v_preview.couple_id
        and e.is_settlement_target = true
        and e.expense_date >= v_preview.settlement_month
        and e.expense_date < v_next_month
        and not exists (
          select 1 from public.expense_splits sx
          where sx.expense_id = e.id and sx.is_settled = true
        )
    );

  insert into public.finance_action_logs (
    couple_id,
    user_id,
    settlement_id,
    source,
    action,
    raw_input,
    payload,
    status
  ) values (
    v_preview.couple_id,
    p_user_id,
    v_settlement_id,
    'chatgpt',
    'complete_settlement',
    null,
    jsonb_build_object(
      'settlement_month', v_preview.settlement_month,
      'from_user', v_preview.from_user,
      'to_user', v_preview.to_user,
      'amount', v_preview.amount,
      'expense_count', v_preview.expense_count,
      'gross_amount', v_preview.gross_amount
    ),
    'executed'
  );

  return query
  select
    v_settlement_id,
    v_preview.settlement_month,
    v_preview.from_user,
    v_preview.to_user,
    v_preview.amount,
    v_preview.expense_count,
    v_preview.gross_amount;
end;
$$;

revoke execute on function public.complete_monthly_settlement(uuid, date, text) from anon;
revoke all on function public.complete_monthly_settlement(uuid, date, text) from public;
grant execute on function public.complete_monthly_settlement(uuid, date, text) to authenticated;
grant execute on function public.complete_monthly_settlement(uuid, date, text) to service_role;
