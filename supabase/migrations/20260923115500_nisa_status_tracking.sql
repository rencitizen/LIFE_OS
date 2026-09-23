create table if not exists public.nisa_statuses (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  year integer not null check (year >= 2024 and year <= 2100),
  tsumitate_used numeric(14,2) check (tsumitate_used is null or tsumitate_used >= 0),
  growth_used numeric(14,2) check (growth_used is null or growth_used >= 0),
  lifetime_used numeric(14,2) check (lifetime_used is null or lifetime_used >= 0),
  monthly_tsumitate numeric(14,2) not null default 0 check (monthly_tsumitate >= 0),
  monthly_growth numeric(14,2) not null default 0 check (monthly_growth >= 0),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, year)
);

create index if not exists nisa_statuses_couple_year_idx
  on public.nisa_statuses(couple_id, year, user_id);

alter table public.nisa_statuses enable row level security;

drop policy if exists "NISA statuses couple access" on public.nisa_statuses;
create policy "NISA statuses couple access"
  on public.nisa_statuses for all
  using (couple_id = public.get_couple_id())
  with check (couple_id = public.get_couple_id());

revoke all on public.nisa_statuses from anon;
grant select, insert, update, delete on public.nisa_statuses to authenticated;
grant all on public.nisa_statuses to service_role;
