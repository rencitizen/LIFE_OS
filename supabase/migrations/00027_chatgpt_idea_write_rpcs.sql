create or replace function public.register_chatgpt_idea_item(
  p_user_id uuid,
  p_title text,
  p_memo text default null,
  p_raw_input text default null
)
returns public.idea_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_item public.idea_items%rowtype;
begin
  if nullif(btrim(p_title), '') is null then raise exception 'title_is_required'; end if;
  select u.couple_id into v_couple_id from public.users u where u.id=p_user_id;
  if v_couple_id is null then raise exception 'user_not_found_or_not_in_couple'; end if;
  if auth.uid() is not null and auth.uid()<>p_user_id then raise exception 'user_must_match_authenticated_user'; end if;

  insert into public.idea_items(couple_id,created_by,title,memo,status)
  values(v_couple_id,p_user_id,btrim(p_title),nullif(btrim(p_memo),''),'active')
  returning * into v_item;

  insert into public.chatgpt_action_logs(couple_id,user_id,entity_type,entity_id,action,raw_input,payload,status)
  values(v_couple_id,p_user_id,'idea_item',v_item.id,'create',p_raw_input,
    jsonb_build_object('title',v_item.title,'memo',v_item.memo,'status',v_item.status),'executed');

  return v_item;
end;
$$;

create or replace function public.update_chatgpt_idea_item(
  p_user_id uuid,
  p_item_id uuid,
  p_changes jsonb,
  p_raw_input text default null
)
returns public.idea_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_old public.idea_items%rowtype;
  v_new public.idea_items%rowtype;
  v_title text;
  v_memo text;
  v_status text;
  v_key text;
begin
  if p_changes is null or jsonb_typeof(p_changes)<>'object' or p_changes='{}'::jsonb then raise exception 'changes_are_required'; end if;
  for v_key in select jsonb_object_keys(p_changes)
  loop
    if v_key not in ('title','memo','status') then raise exception 'unsupported_change_key: %',v_key; end if;
  end loop;

  select u.couple_id into v_couple_id from public.users u where u.id=p_user_id;
  if v_couple_id is null then raise exception 'user_not_found_or_not_in_couple'; end if;
  if auth.uid() is not null and auth.uid()<>p_user_id then raise exception 'user_must_match_authenticated_user'; end if;

  select * into v_old from public.idea_items i where i.id=p_item_id;
  if not found then raise exception 'idea_item_not_found'; end if;
  if v_old.couple_id<>v_couple_id then raise exception 'idea_item_not_in_user_couple'; end if;

  v_title := case when p_changes?'title' then nullif(btrim(p_changes->>'title'),'') else v_old.title end;
  v_memo := case when p_changes?'memo' then nullif(btrim(p_changes->>'memo'),'') else v_old.memo end;
  v_status := case when p_changes?'status' then p_changes->>'status' else v_old.status end;
  if v_title is null then raise exception 'title_is_required'; end if;
  if v_status not in ('active','done') then raise exception 'invalid_status'; end if;

  update public.idea_items set title=v_title,memo=v_memo,status=v_status where id=p_item_id returning * into v_new;

  insert into public.chatgpt_action_logs(couple_id,user_id,entity_type,entity_id,action,raw_input,payload,status)
  values(v_couple_id,p_user_id,'idea_item',p_item_id,'update',p_raw_input,p_changes,'executed');

  return v_new;
end;
$$;

create or replace function public.complete_chatgpt_idea_item(
  p_user_id uuid,
  p_item_id uuid,
  p_raw_input text default null
)
returns public.idea_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_item public.idea_items%rowtype;
begin
  select u.couple_id into v_couple_id from public.users u where u.id=p_user_id;
  if v_couple_id is null then raise exception 'user_not_found_or_not_in_couple'; end if;
  if auth.uid() is not null and auth.uid()<>p_user_id then raise exception 'user_must_match_authenticated_user'; end if;

  select * into v_item from public.idea_items i where i.id=p_item_id;
  if not found then raise exception 'idea_item_not_found'; end if;
  if v_item.couple_id<>v_couple_id then raise exception 'idea_item_not_in_user_couple'; end if;

  update public.idea_items set status='done' where id=p_item_id returning * into v_item;

  insert into public.chatgpt_action_logs(couple_id,user_id,entity_type,entity_id,action,raw_input,payload,status)
  values(v_couple_id,p_user_id,'idea_item',p_item_id,'complete',p_raw_input,
    jsonb_build_object('title',v_item.title,'status',v_item.status),'executed');

  return v_item;
end;
$$;

create or replace function public.delete_chatgpt_idea_item(
  p_user_id uuid,
  p_item_id uuid,
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
  v_item public.idea_items%rowtype;
begin
  if not p_confirmed then raise exception 'explicit_confirmation_required'; end if;
  select u.couple_id into v_couple_id from public.users u where u.id=p_user_id;
  if v_couple_id is null then raise exception 'user_not_found_or_not_in_couple'; end if;
  if auth.uid() is not null and auth.uid()<>p_user_id then raise exception 'user_must_match_authenticated_user'; end if;

  select * into v_item from public.idea_items i where i.id=p_item_id;
  if not found then raise exception 'idea_item_not_found'; end if;
  if v_item.couple_id<>v_couple_id then raise exception 'idea_item_not_in_user_couple'; end if;

  insert into public.chatgpt_action_logs(couple_id,user_id,entity_type,entity_id,action,raw_input,payload,status)
  values(v_couple_id,p_user_id,'idea_item',p_item_id,'delete',p_raw_input,
    jsonb_build_object('title',v_item.title,'memo',v_item.memo,'status',v_item.status),'executed');

  delete from public.idea_items where id=p_item_id;
  return p_item_id;
end;
$$;

revoke all on function public.register_chatgpt_idea_item(uuid,text,text,text) from public, anon;
revoke all on function public.update_chatgpt_idea_item(uuid,uuid,jsonb,text) from public, anon;
revoke all on function public.complete_chatgpt_idea_item(uuid,uuid,text) from public, anon;
revoke all on function public.delete_chatgpt_idea_item(uuid,uuid,boolean,text) from public, anon;

grant execute on function public.register_chatgpt_idea_item(uuid,text,text,text) to authenticated, service_role;
grant execute on function public.update_chatgpt_idea_item(uuid,uuid,jsonb,text) to authenticated, service_role;
grant execute on function public.complete_chatgpt_idea_item(uuid,uuid,text) to authenticated, service_role;
grant execute on function public.delete_chatgpt_idea_item(uuid,uuid,boolean,text) to authenticated, service_role;
