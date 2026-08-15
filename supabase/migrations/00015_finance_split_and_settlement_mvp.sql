-- Finance MVP: configurable default split ratios, immutable per-expense split snapshots,
-- monthly net settlement metadata, and ChatGPT audit logging.

create table if not exists public.expense_split_profiles (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  effective_from date not null,
  effective_to date,
  basis text not null default 'salary' check (basis in ('salary','manual')),
  note text,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create index if not exists expense_split_profiles_couple_effective_idx
  on public.expense_split_profiles(couple_id, effective_from desc);

create table if not exists public.expense_split_profile_members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.expense_split_profiles(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  ratio numeric(8,7) not null check (ratio >= 0 and ratio <= 1),
  created_at timestamptz not null default now(),
  unique (profile_id, user_id)
);

create index if not exists expense_split_profile_members_profile_idx
  on public.expense_split_profile_members(profile_id);

alter table public.expenses
  add column if not exists split_profile_id uuid references public.expense_split_profiles(id) on delete set null,
  add column if not exists split_mode text not null default 'none'
    check (split_mode in ('none','standard','custom','full_payer'));

create unique index if not exists expense_splits_expense_user_unique
  on public.expense_splits(expense_id, user_id);

alter table public.settlements
  add column if not exists settlement_month date;

create index if not exists settlements_couple_month_idx
  on public.settlements(couple_id, settlement_month desc);

create table if not exists public.finance_action_logs (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  expense_id uuid references public.expenses(id) on delete set null,
  settlement_id uuid references public.settlements(id) on delete set null,
  source text not null default 'chatgpt' check (source = 'chatgpt'),
  action text not null check (action in ('create_expense','update_expense','delete_expense','create_settlement','complete_settlement','update_split_profile')),
  raw_input text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'executed' check (status in ('executed','failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists finance_action_logs_couple_created_idx
  on public.finance_action_logs(couple_id, created_at desc);
create index if not exists finance_action_logs_expense_idx
  on public.finance_action_logs(expense_id, created_at desc);

alter table public.expense_split_profiles enable row level security;
alter table public.expense_split_profile_members enable row level security;
alter table public.finance_action_logs enable row level security;

create policy "Couple can view split profiles"
  on public.expense_split_profiles for select
  using (couple_id = public.get_couple_id());
create policy "Couple can insert split profiles"
  on public.expense_split_profiles for insert
  with check (couple_id = public.get_couple_id());
create policy "Couple can update split profiles"
  on public.expense_split_profiles for update
  using (couple_id = public.get_couple_id())
  with check (couple_id = public.get_couple_id());

create policy "Couple can view split profile members"
  on public.expense_split_profile_members for select
  using (exists (
    select 1 from public.expense_split_profiles p
    where p.id = profile_id and p.couple_id = public.get_couple_id()
  ));
create policy "Couple can insert split profile members"
  on public.expense_split_profile_members for insert
  with check (exists (
    select 1 from public.expense_split_profiles p
    where p.id = profile_id and p.couple_id = public.get_couple_id()
  ));
create policy "Couple can update split profile members"
  on public.expense_split_profile_members for update
  using (exists (
    select 1 from public.expense_split_profiles p
    where p.id = profile_id and p.couple_id = public.get_couple_id()
  ))
  with check (exists (
    select 1 from public.expense_split_profiles p
    where p.id = profile_id and p.couple_id = public.get_couple_id()
  ));

create policy "Couple can view finance logs"
  on public.finance_action_logs for select
  using (couple_id = public.get_couple_id());
create policy "Couple can insert finance logs"
  on public.finance_action_logs for insert
  with check (couple_id = public.get_couple_id());
