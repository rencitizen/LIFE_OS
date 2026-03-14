create table if not exists budget_member_limits (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  limit_amount numeric(12,2) not null default 0,
  created_at timestamptz default now(),
  unique (budget_id, user_id)
);

create index if not exists idx_budget_member_limits_budget on budget_member_limits(budget_id);
create index if not exists idx_budget_member_limits_user on budget_member_limits(user_id);

alter table budget_member_limits enable row level security;

drop policy if exists "Couple access" on budget_member_limits;
create policy "Couple access" on budget_member_limits
  for all using (
    budget_id in (select id from budgets where couple_id = public.get_couple_id())
  );

with ranked_members as (
  select
    b.id as budget_id,
    u.id as user_id,
    row_number() over (
      partition by b.id
      order by
        case
          when lower(coalesce(u.display_name, '')) like '%hikaru%' then 2
          when lower(coalesce(u.email, '')) like '%hikaru%' then 2
          else 1
        end,
        u.created_at,
        u.id
    ) as member_order,
    count(*) over (partition by b.id) as member_count,
    coalesce(b.total_limit, 0) as total_limit
  from budgets b
  join users u on u.couple_id = b.couple_id
)
insert into budget_member_limits (budget_id, user_id, limit_amount)
select
  budget_id,
  user_id,
  case
    when member_count = 1 then total_limit
    when member_order = 1 then round(total_limit * 0.679493)
    when member_order = 2 then total_limit - round(total_limit * 0.679493)
    else 0
  end
from ranked_members
where member_order <= 2
on conflict (budget_id, user_id) do nothing;
