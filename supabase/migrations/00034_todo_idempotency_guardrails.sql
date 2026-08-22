-- Prevent accidental duplicate active Todos while allowing intentionally repeated tasks on different dates.
create unique index if not exists todos_active_semantic_unique
on public.todos(
  couple_id,
  lower(btrim(title)),
  coalesce(assigned_to,'00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(start_date,date '0001-01-01'),
  coalesce(due_date,date '0001-01-01'),
  coalesce(end_date,date '0001-01-01'),
  coalesce(parent_todo_id,'00000000-0000-0000-0000-000000000000'::uuid)
)
where status in ('pending','in_progress');

create or replace function public.register_chatgpt_todo(
  p_user_id uuid,
  p_title text,
  p_description text default null,
  p_due_date date default null,
  p_start_date date default null,
  p_end_date date default null,
  p_assigned_to uuid default null,
  p_priority text default 'medium',
  p_task_level text default 'small',
  p_visibility text default 'shared',
  p_parent_todo_id uuid default null,
  p_raw_input text default null
) returns public.todos
language plpgsql security definer set search_path=public as $$
declare
  v_couple uuid; v_todo public.todos%rowtype; v_dedup boolean:=false;
begin
  if nullif(btrim(p_title),'') is null then raise exception 'title_is_required'; end if;
  if p_priority not in ('high','medium','low') then raise exception 'invalid_priority'; end if;
  if p_task_level not in ('large','medium','small') then raise exception 'invalid_task_level'; end if;
  if p_visibility not in ('shared','private') then raise exception 'invalid_visibility'; end if;
  select couple_id into v_couple from public.users where id=p_user_id;
  if v_couple is null then raise exception 'user_not_found_or_not_in_couple'; end if;
  if auth.uid() is not null and auth.uid()<>p_user_id then raise exception 'user_must_match_authenticated_user'; end if;
  if p_assigned_to is not null and not exists(select 1 from public.users where id=p_assigned_to and couple_id=v_couple) then raise exception 'assignee_not_in_user_couple'; end if;
  if p_parent_todo_id is not null and not exists(select 1 from public.todos where id=p_parent_todo_id and couple_id=v_couple) then raise exception 'parent_todo_not_in_user_couple'; end if;

  insert into public.todos(couple_id,created_by,assigned_to,parent_todo_id,title,description,due_date,start_date,end_date,task_level,priority,status,visibility,is_recurring,recurrence_rule)
  values(v_couple,p_user_id,p_assigned_to,p_parent_todo_id,btrim(p_title),nullif(btrim(p_description),''),p_due_date,p_start_date,p_end_date,p_task_level,p_priority,'pending',p_visibility,false,null)
  on conflict do nothing
  returning * into v_todo;

  if not found then
    v_dedup:=true;
    select * into v_todo from public.todos t
    where t.couple_id=v_couple and t.status in ('pending','in_progress')
      and lower(btrim(t.title))=lower(btrim(p_title))
      and t.assigned_to is not distinct from p_assigned_to
      and t.start_date is not distinct from p_start_date
      and t.due_date is not distinct from p_due_date
      and t.end_date is not distinct from p_end_date
      and t.parent_todo_id is not distinct from p_parent_todo_id
    order by t.created_at desc limit 1;
    if not found then raise exception 'todo_conflict_without_match'; end if;
  end if;

  insert into public.todo_action_logs(couple_id,user_id,todo_id,source,action,raw_input,payload,status)
  values(v_couple,p_user_id,v_todo.id,'chatgpt','create',p_raw_input,
    jsonb_build_object('title',v_todo.title,'description',v_todo.description,'due_date',v_todo.due_date,'start_date',v_todo.start_date,'end_date',v_todo.end_date,'assigned_to',v_todo.assigned_to,'priority',v_todo.priority,'task_level',v_todo.task_level,'visibility',v_todo.visibility,'parent_todo_id',v_todo.parent_todo_id,'deduplicated',v_dedup),'executed');
  return v_todo;
end $$;