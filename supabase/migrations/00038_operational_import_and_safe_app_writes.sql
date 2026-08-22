-- Operational hardening: authenticated CSV import and RPC-only app write paths.

create table if not exists public.moneyforward_import_runs (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  file_name text,
  rows_total integer not null default 0,
  inserted_count integer not null default 0,
  linked_existing_count integer not null default 0,
  unchanged_count integer not null default 0,
  failed_count integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.moneyforward_import_runs enable row level security;
drop policy if exists "Couple can view moneyforward import runs" on public.moneyforward_import_runs;
create policy "Couple can view moneyforward import runs"
  on public.moneyforward_import_runs for select
  using (couple_id = public.get_couple_id());
revoke all on public.moneyforward_import_runs from anon;
grant select on public.moneyforward_import_runs to authenticated;
grant all on public.moneyforward_import_runs to service_role;

create index if not exists moneyforward_import_runs_couple_created_idx
  on public.moneyforward_import_runs(couple_id, created_at desc);

create or replace function public.import_moneyforward_rows(
  p_user_id uuid,
  p_paid_by uuid,
  p_rows jsonb,
  p_file_name text default null
) returns table(
  run_id uuid,
  rows_total integer,
  inserted_count integer,
  linked_existing_count integer,
  unchanged_count integer,
  failed_count integer,
  errors jsonb
)
language plpgsql security definer set search_path=public as $$
declare
  v_couple uuid;
  v_row jsonb;
  v_result record;
  v_run_id uuid;
  v_total integer := 0;
  v_inserted integer := 0;
  v_linked integer := 0;
  v_unchanged integer := 0;
  v_failed integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_index integer := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'rows_must_be_json_array'; end if;
  if jsonb_array_length(p_rows) > 5000 then raise exception 'too_many_rows'; end if;
  select couple_id into v_couple from public.users where id=p_user_id;
  if v_couple is null then raise exception 'user_not_found_or_not_in_couple'; end if;
  if auth.uid() is not null and auth.uid() <> p_user_id then raise exception 'user_must_match_authenticated_user'; end if;
  if not exists(select 1 from public.users where id=p_paid_by and couple_id=v_couple) then raise exception 'payer_not_in_user_couple'; end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_index := v_index + 1;
    v_total := v_total + 1;
    begin
      select * into v_result from public.upsert_moneyforward_expense(
        p_user_id,p_paid_by,nullif(v_row->>'amount','')::numeric,nullif(v_row->>'expense_date','')::date,
        coalesce(nullif(v_row->>'category_name',''),'その他'),nullif(v_row->>'description',''),nullif(v_row->>'external_id',''),
        nullif(v_row->>'parent_category_name',''),coalesce((v_row->>'is_settlement_target')::boolean,false),
        nullif(v_row->>'payment_method',''),coalesce(v_row->'raw_payload',v_row)
      );
      if v_result.result_status='inserted' then v_inserted:=v_inserted+1;
      elsif v_result.result_status='linked_existing' then v_linked:=v_linked+1;
      else v_unchanged:=v_unchanged+1;
      end if;
    exception when others then
      v_failed:=v_failed+1;
      v_errors:=v_errors||jsonb_build_array(jsonb_build_object('row',v_index,'external_id',v_row->>'external_id','description',v_row->>'description','message',sqlerrm));
    end;
  end loop;

  insert into public.moneyforward_import_runs(couple_id,user_id,file_name,rows_total,inserted_count,linked_existing_count,unchanged_count,failed_count,errors)
  values(v_couple,p_user_id,nullif(btrim(p_file_name),''),v_total,v_inserted,v_linked,v_unchanged,v_failed,v_errors)
  returning id into v_run_id;
  return query select v_run_id,v_total,v_inserted,v_linked,v_unchanged,v_failed,v_errors;
end $$;
revoke all on function public.import_moneyforward_rows(uuid,uuid,jsonb,text) from public,anon;
grant execute on function public.import_moneyforward_rows(uuid,uuid,jsonb,text) to authenticated,service_role;

create or replace function public.register_app_expense(p_payload jsonb)
returns public.expenses language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_row public.expenses%rowtype;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  select * into v_row from public.register_manual_expense(
    v_uid,coalesce(nullif(p_payload->>'paid_by','')::uuid,v_uid),nullif(p_payload->>'amount','')::numeric,
    nullif(p_payload->>'expense_date','')::date,nullif(p_payload->>'category_id','')::uuid,nullif(p_payload->>'description',''),
    coalesce((p_payload->>'is_settlement_target')::boolean,false),nullif(p_payload->>'payment_method',''),
    coalesce(nullif(p_payload->>'expense_type',''),case when coalesce((p_payload->>'is_settlement_target')::boolean,false) then 'shared' else 'personal' end)
  );
  return v_row;
end $$;

create or replace function public.update_app_expense(p_expense_id uuid,p_changes jsonb)
returns public.expenses language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid:=auth.uid(); v_old public.expenses%rowtype; v_row public.expenses%rowtype;
  v_category uuid; v_amount numeric; v_date date; v_description text; v_target boolean; v_payment text; v_type text;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  select e.* into v_old from public.expenses e join public.users u on u.couple_id=e.couple_id where e.id=p_expense_id and u.id=v_uid;
  if not found then raise exception 'expense_not_in_user_couple'; end if;
  v_category:=coalesce(nullif(p_changes->>'category_id','')::uuid,v_old.category_id);
  v_amount:=coalesce(nullif(p_changes->>'amount','')::numeric,v_old.amount);
  v_date:=coalesce(nullif(p_changes->>'expense_date','')::date,v_old.expense_date);
  v_description:=case when p_changes?'description' then nullif(p_changes->>'description','') else v_old.description end;
  v_target:=case when p_changes?'is_settlement_target' then (p_changes->>'is_settlement_target')::boolean else v_old.is_settlement_target end;
  v_payment:=case when p_changes?'payment_method' then nullif(p_changes->>'payment_method','') else v_old.payment_method end;
  v_type:=coalesce(nullif(p_changes->>'expense_type',''),v_old.expense_type,case when v_target then 'shared' else 'personal' end);
  select * into v_row from public.update_expense_with_splits(v_uid,p_expense_id,v_amount,v_date,v_category,v_description,v_target,v_payment,v_type);
  return v_row;
end $$;

create or replace function public.delete_app_expense(p_expense_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_couple uuid;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  select couple_id into v_couple from public.users where id=v_uid;
  if not exists(select 1 from public.expenses where id=p_expense_id and couple_id=v_couple) then raise exception 'expense_not_in_user_couple'; end if;
  if exists(select 1 from public.expense_splits where expense_id=p_expense_id and is_settled=true) then raise exception 'settled_expense_cannot_be_deleted'; end if;
  delete from public.expenses where id=p_expense_id;
  return p_expense_id;
end $$;
revoke all on function public.register_app_expense(jsonb) from public,anon;
revoke all on function public.update_app_expense(uuid,jsonb) from public,anon;
revoke all on function public.delete_app_expense(uuid) from public,anon;
grant execute on function public.register_app_expense(jsonb) to authenticated;
grant execute on function public.update_app_expense(uuid,jsonb) to authenticated;
grant execute on function public.delete_app_expense(uuid) to authenticated;

create or replace function public.register_app_todo(p_payload jsonb)
returns public.todos language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid:=auth.uid(); v_couple uuid; v_assignee uuid; v_existing public.todos%rowtype; v_row public.todos%rowtype;
  v_title text; v_start date; v_due date; v_end date;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  select couple_id into v_couple from public.users where id=v_uid;
  if v_couple is null then raise exception 'user_not_in_couple'; end if;
  v_title:=nullif(btrim(p_payload->>'title'),'');
  if v_title is null then raise exception 'title_is_required'; end if;
  v_assignee:=nullif(p_payload->>'assigned_to','')::uuid;
  if v_assignee is not null and not exists(select 1 from public.users where id=v_assignee and couple_id=v_couple) then raise exception 'assignee_not_in_user_couple'; end if;
  v_start:=nullif(p_payload->>'start_date','')::date; v_due:=nullif(p_payload->>'due_date','')::date; v_end:=nullif(p_payload->>'end_date','')::date;
  select * into v_existing from public.todos t where t.couple_id=v_couple and t.status in ('pending','in_progress')
    and lower(regexp_replace(btrim(t.title),'[[:space:]　]+','','g'))=lower(regexp_replace(v_title,'[[:space:]　]+','','g'))
    and t.assigned_to is not distinct from v_assignee and t.start_date is not distinct from v_start and t.due_date is not distinct from v_due
    and t.end_date is not distinct from v_end and t.parent_todo_id is not distinct from nullif(p_payload->>'parent_todo_id','')::uuid
  order by t.created_at desc limit 1;
  if found then return v_existing; end if;
  insert into public.todos(couple_id,created_by,assigned_to,parent_todo_id,title,description,due_date,start_date,end_date,task_level,priority,status,visibility,is_recurring,recurrence_rule,event_id)
  values(v_couple,v_uid,v_assignee,nullif(p_payload->>'parent_todo_id','')::uuid,v_title,nullif(btrim(p_payload->>'description'),''),v_due,v_start,v_end,
    coalesce(nullif(p_payload->>'task_level',''),'small'),coalesce(nullif(p_payload->>'priority',''),'medium'),coalesce(nullif(p_payload->>'status',''),'pending'),
    coalesce(nullif(p_payload->>'visibility',''),'shared'),coalesce((p_payload->>'is_recurring')::boolean,false),nullif(p_payload->>'recurrence_rule',''),nullif(p_payload->>'event_id','')::uuid)
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.register_app_todos(p_payloads jsonb)
returns setof public.todos language plpgsql security definer set search_path=public as $$
declare v_item jsonb; v_row public.todos%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_payloads is null or jsonb_typeof(p_payloads)<>'array' then raise exception 'payloads_must_be_array'; end if;
  for v_item in select value from jsonb_array_elements(p_payloads) loop v_row:=public.register_app_todo(v_item); return next v_row; end loop;
end $$;

create or replace function public.update_app_todo(p_todo_id uuid,p_changes jsonb)
returns public.todos language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid:=auth.uid(); v_couple uuid; v_old public.todos%rowtype; v_row public.todos%rowtype; v_title text; v_assignee uuid; v_parent uuid; v_status text;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  select couple_id into v_couple from public.users where id=v_uid;
  select * into v_old from public.todos where id=p_todo_id and couple_id=v_couple;
  if not found then raise exception 'todo_not_in_user_couple'; end if;
  v_title:=case when p_changes?'title' then nullif(btrim(p_changes->>'title'),'') else v_old.title end;
  if v_title is null then raise exception 'title_is_required'; end if;
  v_assignee:=case when p_changes?'assigned_to' then nullif(p_changes->>'assigned_to','')::uuid else v_old.assigned_to end;
  v_parent:=case when p_changes?'parent_todo_id' then nullif(p_changes->>'parent_todo_id','')::uuid else v_old.parent_todo_id end;
  v_status:=coalesce(nullif(p_changes->>'status',''),v_old.status,'pending');
  if v_assignee is not null and not exists(select 1 from public.users where id=v_assignee and couple_id=v_couple) then raise exception 'assignee_not_in_user_couple'; end if;
  if v_parent is not null and not exists(select 1 from public.todos where id=v_parent and couple_id=v_couple and id<>p_todo_id) then raise exception 'parent_todo_not_in_user_couple'; end if;
  if v_status not in ('pending','in_progress','done') then raise exception 'invalid_status'; end if;
  update public.todos set
    title=v_title,description=case when p_changes?'description' then nullif(btrim(p_changes->>'description'),'') else v_old.description end,
    due_date=case when p_changes?'due_date' then nullif(p_changes->>'due_date','')::date else v_old.due_date end,
    start_date=case when p_changes?'start_date' then nullif(p_changes->>'start_date','')::date else v_old.start_date end,
    end_date=case when p_changes?'end_date' then nullif(p_changes->>'end_date','')::date else v_old.end_date end,
    assigned_to=v_assignee,parent_todo_id=v_parent,priority=coalesce(nullif(p_changes->>'priority',''),v_old.priority),
    task_level=coalesce(nullif(p_changes->>'task_level',''),v_old.task_level),visibility=coalesce(nullif(p_changes->>'visibility',''),v_old.visibility),
    status=v_status,completed_at=case when v_status='done' then coalesce(v_old.completed_at,now()) else null end,
    is_recurring=case when p_changes?'is_recurring' then (p_changes->>'is_recurring')::boolean else v_old.is_recurring end,
    recurrence_rule=case when p_changes?'recurrence_rule' then nullif(p_changes->>'recurrence_rule','') else v_old.recurrence_rule end,
    event_id=case when p_changes?'event_id' then nullif(p_changes->>'event_id','')::uuid else v_old.event_id end
  where id=p_todo_id returning * into v_row;
  return v_row;
end $$;

create or replace function public.delete_app_todo(p_todo_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_couple uuid;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  select couple_id into v_couple from public.users where id=v_uid;
  if not exists(select 1 from public.todos where id=p_todo_id and couple_id=v_couple) then raise exception 'todo_not_in_user_couple'; end if;
  delete from public.todos where id=p_todo_id; return p_todo_id;
end $$;
revoke all on function public.register_app_todo(jsonb) from public,anon;
revoke all on function public.register_app_todos(jsonb) from public,anon;
revoke all on function public.update_app_todo(uuid,jsonb) from public,anon;
revoke all on function public.delete_app_todo(uuid) from public,anon;
grant execute on function public.register_app_todo(jsonb) to authenticated;
grant execute on function public.register_app_todos(jsonb) to authenticated;
grant execute on function public.update_app_todo(uuid,jsonb) to authenticated;
grant execute on function public.delete_app_todo(uuid) to authenticated;

create index if not exists expenses_couple_date_counted_idx on public.expenses(couple_id,expense_date desc) where counts_toward_totals=true;
create index if not exists expenses_paid_by_date_idx on public.expenses(paid_by,expense_date desc);
create index if not exists expense_splits_user_idx on public.expense_splits(user_id);
create index if not exists settlements_from_user_idx on public.settlements(from_user);
create index if not exists settlements_to_user_idx on public.settlements(to_user);
create index if not exists incomes_couple_date_idx on public.incomes(couple_id,income_date desc);
create index if not exists incomes_user_date_idx on public.incomes(user_id,income_date desc);
create index if not exists todos_couple_status_dates_idx on public.todos(couple_id,status,start_date,due_date);
create index if not exists chatgpt_action_logs_user_idx on public.chatgpt_action_logs(user_id);
create index if not exists todo_action_logs_user_idx on public.todo_action_logs(user_id);
create index if not exists finance_action_logs_user_idx on public.finance_action_logs(user_id);
create index if not exists expense_split_profile_members_user_idx on public.expense_split_profile_members(user_id);
create index if not exists shopping_lists_couple_idx on public.shopping_lists(couple_id);
