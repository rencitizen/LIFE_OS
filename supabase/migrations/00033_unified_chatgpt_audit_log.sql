-- Make chatgpt_action_logs the canonical cross-domain audit stream while keeping domain logs.
alter table public.chatgpt_action_logs
  add column if not exists origin_table text,
  add column if not exists origin_id uuid;

alter table public.chatgpt_action_logs drop constraint if exists chatgpt_action_logs_entity_type_check;
alter table public.chatgpt_action_logs add constraint chatgpt_action_logs_entity_type_check
  check (entity_type in ('calendar_event','shopping_item','shopping_list','idea_item','todo','expense','settlement','split_profile','finance_plan'));

create unique index if not exists chatgpt_action_logs_origin_unique
  on public.chatgpt_action_logs(origin_table,origin_id)
  where origin_table is not null and origin_id is not null;

create or replace function public.mirror_todo_action_log()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.chatgpt_action_logs(couple_id,user_id,entity_type,entity_id,action,raw_input,payload,status,error_message,origin_table,origin_id)
  values(new.couple_id,new.user_id,'todo',new.todo_id,new.action,new.raw_input,new.payload,new.status,new.error_message,'todo_action_logs',new.id)
  on conflict (origin_table,origin_id) where origin_table is not null and origin_id is not null do nothing;
  return new;
end $$;

drop trigger if exists trg_mirror_todo_action_log on public.todo_action_logs;
create trigger trg_mirror_todo_action_log after insert on public.todo_action_logs
for each row execute function public.mirror_todo_action_log();

create or replace function public.mirror_finance_action_log()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_entity text; v_entity_id uuid; v_action text;
begin
  if new.expense_id is not null then v_entity:='expense'; v_entity_id:=new.expense_id;
  elsif new.settlement_id is not null then v_entity:='settlement'; v_entity_id:=new.settlement_id;
  else v_entity:='split_profile'; v_entity_id:=null; end if;
  v_action:=case new.action when 'create_expense' then 'create' when 'update_expense' then 'update' when 'delete_expense' then 'delete' when 'create_settlement' then 'create' when 'complete_settlement' then 'complete' else 'update' end;
  insert into public.chatgpt_action_logs(couple_id,user_id,entity_type,entity_id,action,raw_input,payload,status,error_message,origin_table,origin_id)
  values(new.couple_id,new.user_id,v_entity,v_entity_id,v_action,new.raw_input,new.payload,new.status,new.error_message,'finance_action_logs',new.id)
  on conflict (origin_table,origin_id) where origin_table is not null and origin_id is not null do nothing;
  return new;
end $$;

drop trigger if exists trg_mirror_finance_action_log on public.finance_action_logs;
create trigger trg_mirror_finance_action_log after insert on public.finance_action_logs
for each row execute function public.mirror_finance_action_log();

create or replace function public.mirror_finance_plan_action_log()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.chatgpt_action_logs(couple_id,user_id,entity_type,entity_id,action,raw_input,payload,status,origin_table,origin_id)
  values(new.couple_id,new.user_id,'finance_plan',new.plan_item_id,case when new.action='create' then 'create' else 'update' end,new.raw_input,new.payload,'executed','finance_plan_action_logs',new.id)
  on conflict (origin_table,origin_id) where origin_table is not null and origin_id is not null do nothing;
  return new;
end $$;

drop trigger if exists trg_mirror_finance_plan_action_log on public.finance_plan_action_logs;
create trigger trg_mirror_finance_plan_action_log after insert on public.finance_plan_action_logs
for each row execute function public.mirror_finance_plan_action_log();

insert into public.chatgpt_action_logs(couple_id,user_id,entity_type,entity_id,action,raw_input,payload,status,error_message,origin_table,origin_id,created_at)
select l.couple_id,l.user_id,'todo',l.todo_id,l.action,l.raw_input,l.payload,l.status,l.error_message,'todo_action_logs',l.id,l.created_at
from public.todo_action_logs l
on conflict (origin_table,origin_id) where origin_table is not null and origin_id is not null do nothing;

insert into public.chatgpt_action_logs(couple_id,user_id,entity_type,entity_id,action,raw_input,payload,status,error_message,origin_table,origin_id,created_at)
select l.couple_id,l.user_id,
       case when l.expense_id is not null then 'expense' when l.settlement_id is not null then 'settlement' else 'split_profile' end,
       coalesce(l.expense_id,l.settlement_id),
       case l.action when 'create_expense' then 'create' when 'update_expense' then 'update' when 'delete_expense' then 'delete' when 'create_settlement' then 'create' when 'complete_settlement' then 'complete' else 'update' end,
       l.raw_input,l.payload,l.status,l.error_message,'finance_action_logs',l.id,l.created_at
from public.finance_action_logs l
on conflict (origin_table,origin_id) where origin_table is not null and origin_id is not null do nothing;

insert into public.chatgpt_action_logs(couple_id,user_id,entity_type,entity_id,action,raw_input,payload,status,origin_table,origin_id,created_at)
select l.couple_id,l.user_id,'finance_plan',l.plan_item_id,case when l.action='create' then 'create' else 'update' end,l.raw_input,l.payload,'executed','finance_plan_action_logs',l.id,l.created_at
from public.finance_plan_action_logs l
on conflict (origin_table,origin_id) where origin_table is not null and origin_id is not null do nothing;