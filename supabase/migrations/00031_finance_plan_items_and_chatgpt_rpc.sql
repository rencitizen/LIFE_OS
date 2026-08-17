create table if not exists public.finance_plan_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  horizon text not null check (horizon in ('short','medium','long')),
  title text not null,
  description text,
  category text,
  target_date date,
  target_amount numeric(14,2) check (target_amount is null or target_amount >= 0),
  current_amount numeric(14,2) check (current_amount is null or current_amount >= 0),
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  status text not null default 'active' check (status in ('active','achieved','paused','cancelled')),
  source text not null default 'manual' check (source in ('manual','chatgpt')),
  raw_input text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_plan_items_couple_horizon_idx
  on public.finance_plan_items(couple_id, horizon, status, target_date);

create table if not exists public.finance_plan_action_logs (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  plan_item_id uuid references public.finance_plan_items(id) on delete set null,
  action text not null check (action in ('create','update','status_change')),
  source text not null default 'chatgpt' check (source = 'chatgpt'),
  raw_input text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists finance_plan_action_logs_couple_created_idx
  on public.finance_plan_action_logs(couple_id, created_at desc);

alter table public.finance_plan_items enable row level security;
alter table public.finance_plan_action_logs enable row level security;

drop policy if exists "Finance plan items select" on public.finance_plan_items;
create policy "Finance plan items select"
  on public.finance_plan_items for select
  using (couple_id = public.get_couple_id());

drop policy if exists "Finance plan items insert" on public.finance_plan_items;
create policy "Finance plan items insert"
  on public.finance_plan_items for insert
  with check (couple_id = public.get_couple_id());

drop policy if exists "Finance plan items update" on public.finance_plan_items;
create policy "Finance plan items update"
  on public.finance_plan_items for update
  using (couple_id = public.get_couple_id())
  with check (couple_id = public.get_couple_id());

drop policy if exists "Finance plan items delete" on public.finance_plan_items;
create policy "Finance plan items delete"
  on public.finance_plan_items for delete
  using (couple_id = public.get_couple_id());

drop policy if exists "Finance plan action logs select" on public.finance_plan_action_logs;
create policy "Finance plan action logs select"
  on public.finance_plan_action_logs for select
  using (couple_id = public.get_couple_id());

revoke all on public.finance_plan_items from anon;
revoke all on public.finance_plan_action_logs from anon;
grant select, insert, update, delete on public.finance_plan_items to authenticated;
grant select on public.finance_plan_action_logs to authenticated;
grant all on public.finance_plan_items to service_role;
grant all on public.finance_plan_action_logs to service_role;

create or replace function public.upsert_chatgpt_finance_plan_item(
  p_user_id uuid,
  p_item_id uuid default null,
  p_horizon text default null,
  p_title text default null,
  p_description text default null,
  p_category text default null,
  p_target_date date default null,
  p_target_amount numeric default null,
  p_current_amount numeric default null,
  p_priority text default null,
  p_status text default null,
  p_raw_input text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_item public.finance_plan_items%rowtype;
  v_action text;
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'user_mismatch';
  end if;

  select couple_id into v_couple_id from public.users where id = p_user_id;
  if v_couple_id is null then
    raise exception 'couple_not_found';
  end if;

  if p_horizon is not null and p_horizon not in ('short','medium','long') then
    raise exception 'invalid_horizon';
  end if;
  if p_priority is not null and p_priority not in ('high','medium','low') then
    raise exception 'invalid_priority';
  end if;
  if p_status is not null and p_status not in ('active','achieved','paused','cancelled') then
    raise exception 'invalid_status';
  end if;
  if p_target_amount is not null and p_target_amount < 0 then
    raise exception 'invalid_target_amount';
  end if;
  if p_current_amount is not null and p_current_amount < 0 then
    raise exception 'invalid_current_amount';
  end if;

  if p_item_id is null then
    if coalesce(trim(p_title), '') = '' then
      raise exception 'title_required';
    end if;
    if p_horizon is null then
      raise exception 'horizon_required';
    end if;

    insert into public.finance_plan_items (
      couple_id, created_by, horizon, title, description, category,
      target_date, target_amount, current_amount, priority, status,
      source, raw_input
    ) values (
      v_couple_id, p_user_id, p_horizon, trim(p_title), p_description, p_category,
      p_target_date, p_target_amount, p_current_amount,
      coalesce(p_priority, 'medium'), coalesce(p_status, 'active'),
      'chatgpt', p_raw_input
    ) returning * into v_item;
    v_action := 'create';
  else
    select * into v_item
    from public.finance_plan_items
    where id = p_item_id and couple_id = v_couple_id
    for update;

    if not found then
      raise exception 'plan_item_not_found';
    end if;

    update public.finance_plan_items
    set
      horizon = coalesce(p_horizon, horizon),
      title = coalesce(nullif(trim(p_title), ''), title),
      description = coalesce(p_description, description),
      category = coalesce(p_category, category),
      target_date = coalesce(p_target_date, target_date),
      target_amount = coalesce(p_target_amount, target_amount),
      current_amount = coalesce(p_current_amount, current_amount),
      priority = coalesce(p_priority, priority),
      status = coalesce(p_status, status),
      source = 'chatgpt',
      raw_input = coalesce(p_raw_input, raw_input),
      updated_at = now()
    where id = p_item_id
    returning * into v_item;

    v_action := case when p_status is not null then 'status_change' else 'update' end;
  end if;

  insert into public.finance_plan_action_logs (
    couple_id, user_id, plan_item_id, action, source, raw_input, payload
  ) values (
    v_couple_id,
    p_user_id,
    v_item.id,
    v_action,
    'chatgpt',
    p_raw_input,
    jsonb_build_object(
      'horizon', v_item.horizon,
      'title', v_item.title,
      'target_date', v_item.target_date,
      'target_amount', v_item.target_amount,
      'current_amount', v_item.current_amount,
      'priority', v_item.priority,
      'status', v_item.status,
      'category', v_item.category
    )
  );

  return v_item.id;
end;
$$;

revoke all on function public.upsert_chatgpt_finance_plan_item(uuid, uuid, text, text, text, text, date, numeric, numeric, text, text, text) from public, anon;
grant execute on function public.upsert_chatgpt_finance_plan_item(uuid, uuid, text, text, text, text, date, numeric, numeric, text, text, text) to authenticated, service_role;
