create table if not exists public.chatgpt_action_logs (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  entity_type text not null check (entity_type in ('calendar_event','shopping_item','shopping_list','idea_item')),
  entity_id uuid,
  source text not null default 'chatgpt' check (source = 'chatgpt'),
  action text not null check (action in ('create','update','complete','delete')),
  raw_input text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'executed' check (status in ('executed','failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists chatgpt_action_logs_couple_created_idx
  on public.chatgpt_action_logs(couple_id, created_at desc);
create index if not exists chatgpt_action_logs_entity_idx
  on public.chatgpt_action_logs(entity_type, entity_id, created_at desc);

alter table public.chatgpt_action_logs enable row level security;

drop policy if exists "ChatGPT action logs select" on public.chatgpt_action_logs;
create policy "ChatGPT action logs select"
  on public.chatgpt_action_logs
  for select
  using (couple_id = public.get_couple_id());

revoke all on public.chatgpt_action_logs from anon;
grant select on public.chatgpt_action_logs to authenticated;
grant all on public.chatgpt_action_logs to service_role;
