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
)
returns public.todos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_todo public.todos%rowtype;
begin
  if nullif(btrim(p_title), '') is null then raise exception 'title_is_required'; end if;
  if p_priority not in ('high','medium','low') then raise exception 'invalid_priority'; end if;
  if p_task_level not in ('large','medium','small') then raise exception 'invalid_task_level'; end if;
  if p_visibility not in ('shared','private') then raise exception 'invalid_visibility'; end if;

  select u.couple_id into v_couple_id from public.users u where u.id = p_user_id;
  if v_couple_id is null then raise exception 'user_not_found_or_not_in_couple'; end if;
  if auth.uid() is not null and auth.uid() <> p_user_id then raise exception 'user_must_match_authenticated_user'; end if;

  if p_assigned_to is not null and not exists (
    select 1 from public.users u where u.id = p_assigned_to and u.couple_id = v_couple_id
  ) then raise exception 'assignee_not_in_user_couple'; end if;

  if p_parent_todo_id is not null and not exists (
    select 1 from public.todos t where t.id = p_parent_todo_id and t.couple_id = v_couple_id
  ) then raise exception 'parent_todo_not_in_user_couple'; end if;

  insert into public.todos (
    couple_id, created_by, assigned_to, parent_todo_id, title, description,
    due_date, start_date, end_date, task_level, priority, status, visibility,
    is_recurring, recurrence_rule
  ) values (
    v_couple_id, p_user_id, p_assigned_to, p_parent_todo_id, btrim(p_title), nullif(btrim(p_description), ''),
    p_due_date, p_start_date, p_end_date, p_task_level, p_priority, 'pending', p_visibility,
    false, null
  ) returning * into v_todo;

  insert into public.todo_action_logs (couple_id,user_id,todo_id,source,action,raw_input,payload,status)
  values (
    v_couple_id,p_user_id,v_todo.id,'chatgpt','create',p_raw_input,
    jsonb_build_object(
      'title',v_todo.title,'description',v_todo.description,'due_date',v_todo.due_date,
      'start_date',v_todo.start_date,'end_date',v_todo.end_date,'assigned_to',v_todo.assigned_to,
      'priority',v_todo.priority,'task_level',v_todo.task_level,'visibility',v_todo.visibility,
      'parent_todo_id',v_todo.parent_todo_id
    ),'executed'
  );

  return v_todo;
end;
$$;

create or replace function public.update_chatgpt_todo(
  p_user_id uuid,
  p_todo_id uuid,
  p_changes jsonb,
  p_raw_input text default null
)
returns public.todos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_old public.todos%rowtype;
  v_new public.todos%rowtype;
  v_title text;
  v_description text;
  v_due_date date;
  v_start_date date;
  v_end_date date;
  v_assigned_to uuid;
  v_parent_todo_id uuid;
  v_priority text;
  v_task_level text;
  v_visibility text;
  v_status text;
  v_allowed_keys text[] := array['title','description','due_date','start_date','end_date','assigned_to','parent_todo_id','priority','task_level','visibility','status'];
  v_key text;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then
    raise exception 'changes_are_required';
  end if;

  for v_key in select jsonb_object_keys(p_changes)
  loop
    if not (v_key = any(v_allowed_keys)) then raise exception 'unsupported_change_key: %', v_key; end if;
  end loop;

  select u.couple_id into v_couple_id from public.users u where u.id = p_user_id;
  if v_couple_id is null then raise exception 'user_not_found_or_not_in_couple'; end if;
  if auth.uid() is not null and auth.uid() <> p_user_id then raise exception 'user_must_match_authenticated_user'; end if;

  select * into v_old from public.todos t where t.id = p_todo_id;
  if not found then raise exception 'todo_not_found'; end if;
  if v_old.couple_id <> v_couple_id then raise exception 'todo_not_in_user_couple'; end if;

  v_title := case when p_changes ? 'title' then nullif(btrim(p_changes->>'title'),'') else v_old.title end;
  if v_title is null then raise exception 'title_is_required'; end if;
  v_description := case when p_changes ? 'description' then nullif(btrim(p_changes->>'description'),'') else v_old.description end;
  v_due_date := case when p_changes ? 'due_date' then nullif(p_changes->>'due_date','')::date else v_old.due_date end;
  v_start_date := case when p_changes ? 'start_date' then nullif(p_changes->>'start_date','')::date else v_old.start_date end;
  v_end_date := case when p_changes ? 'end_date' then nullif(p_changes->>'end_date','')::date else v_old.end_date end;
  v_assigned_to := case when p_changes ? 'assigned_to' then nullif(p_changes->>'assigned_to','')::uuid else v_old.assigned_to end;
  v_parent_todo_id := case when p_changes ? 'parent_todo_id' then nullif(p_changes->>'parent_todo_id','')::uuid else v_old.parent_todo_id end;
  v_priority := case when p_changes ? 'priority' then p_changes->>'priority' else v_old.priority end;
  v_task_level := case when p_changes ? 'task_level' then p_changes->>'task_level' else v_old.task_level end;
  v_visibility := case when p_changes ? 'visibility' then p_changes->>'visibility' else v_old.visibility end;
  v_status := case when p_changes ? 'status' then p_changes->>'status' else v_old.status end;

  if v_priority not in ('high','medium','low') then raise exception 'invalid_priority'; end if;
  if v_task_level not in ('large','medium','small') then raise exception 'invalid_task_level'; end if;
  if v_visibility not in ('shared','private') then raise exception 'invalid_visibility'; end if;
  if v_status not in ('pending','in_progress','done') then raise exception 'invalid_status'; end if;

  if v_assigned_to is not null and not exists (
    select 1 from public.users u where u.id = v_assigned_to and u.couple_id = v_couple_id
  ) then raise exception 'assignee_not_in_user_couple'; end if;
  if v_parent_todo_id is not null and not exists (
    select 1 from public.todos t where t.id = v_parent_todo_id and t.couple_id = v_couple_id and t.id <> p_todo_id
  ) then raise exception 'parent_todo_not_in_user_couple'; end if;

  update public.todos
  set title = v_title,
      description = v_description,
      due_date = v_due_date,
      start_date = v_start_date,
      end_date = v_end_date,
      assigned_to = v_assigned_to,
      parent_todo_id = v_parent_todo_id,
      priority = v_priority,
      task_level = v_task_level,
      visibility = v_visibility,
      status = v_status,
      completed_at = case
        when v_status = 'done' and v_old.status <> 'done' then now()
        when v_status <> 'done' then null
        else v_old.completed_at
      end
  where id = p_todo_id
  returning * into v_new;

  insert into public.todo_action_logs (couple_id,user_id,todo_id,source,action,raw_input,payload,status)
  values (v_couple_id,p_user_id,p_todo_id,'chatgpt','update',p_raw_input,p_changes,'executed');

  return v_new;
end;
$$;

create or replace function public.complete_chatgpt_todo(
  p_user_id uuid,
  p_todo_id uuid,
  p_raw_input text default null
)
returns public.todos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_todo public.todos%rowtype;
begin
  select u.couple_id into v_couple_id from public.users u where u.id = p_user_id;
  if v_couple_id is null then raise exception 'user_not_found_or_not_in_couple'; end if;
  if auth.uid() is not null and auth.uid() <> p_user_id then raise exception 'user_must_match_authenticated_user'; end if;

  select * into v_todo from public.todos t where t.id = p_todo_id;
  if not found then raise exception 'todo_not_found'; end if;
  if v_todo.couple_id <> v_couple_id then raise exception 'todo_not_in_user_couple'; end if;

  update public.todos
  set status = 'done', completed_at = coalesce(completed_at, now())
  where id = p_todo_id
  returning * into v_todo;

  insert into public.todo_action_logs (couple_id,user_id,todo_id,source,action,raw_input,payload,status)
  values (v_couple_id,p_user_id,p_todo_id,'chatgpt','complete',p_raw_input,jsonb_build_object('title',v_todo.title),'executed');

  return v_todo;
end;
$$;

create or replace function public.delete_chatgpt_todo(
  p_user_id uuid,
  p_todo_id uuid,
  p_confirmed boolean default false,
  p_raw_input text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_todo public.todos%rowtype;
begin
  if not p_confirmed then raise exception 'explicit_confirmation_required'; end if;
  select u.couple_id into v_couple_id from public.users u where u.id = p_user_id;
  if v_couple_id is null then raise exception 'user_not_found_or_not_in_couple'; end if;
  if auth.uid() is not null and auth.uid() <> p_user_id then raise exception 'user_must_match_authenticated_user'; end if;

  select * into v_todo from public.todos t where t.id = p_todo_id;
  if not found then raise exception 'todo_not_found'; end if;
  if v_todo.couple_id <> v_couple_id then raise exception 'todo_not_in_user_couple'; end if;

  insert into public.todo_action_logs (couple_id,user_id,todo_id,source,action,raw_input,payload,status)
  values (
    v_couple_id,p_user_id,p_todo_id,'chatgpt','delete',p_raw_input,
    jsonb_build_object('title',v_todo.title,'status',v_todo.status,'assigned_to',v_todo.assigned_to,'due_date',v_todo.due_date),
    'executed'
  );

  delete from public.todos where id = p_todo_id;
  return p_todo_id;
end;
$$;

revoke all on function public.register_chatgpt_todo(uuid,text,text,date,date,date,uuid,text,text,text,uuid,text) from public, anon;
revoke all on function public.update_chatgpt_todo(uuid,uuid,jsonb,text) from public, anon;
revoke all on function public.complete_chatgpt_todo(uuid,uuid,text) from public, anon;
revoke all on function public.delete_chatgpt_todo(uuid,uuid,boolean,text) from public, anon;

grant execute on function public.register_chatgpt_todo(uuid,text,text,date,date,date,uuid,text,text,text,uuid,text) to authenticated, service_role;
grant execute on function public.update_chatgpt_todo(uuid,uuid,jsonb,text) to authenticated, service_role;
grant execute on function public.complete_chatgpt_todo(uuid,uuid,text) to authenticated, service_role;
grant execute on function public.delete_chatgpt_todo(uuid,uuid,boolean,text) to authenticated, service_role;
