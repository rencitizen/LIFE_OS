create or replace function public.register_chatgpt_calendar_event(
  p_user_id uuid,
  p_title text,
  p_start_at timestamptz,
  p_end_at timestamptz default null,
  p_all_day boolean default false,
  p_description text default null,
  p_location text default null,
  p_visibility text default 'shared',
  p_event_type text default 'life',
  p_linked_amount numeric default null,
  p_raw_input text default null
)
returns public.calendar_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_event public.calendar_events%rowtype;
begin
  if nullif(btrim(p_title), '') is null then raise exception 'title_is_required'; end if;
  if p_start_at is null then raise exception 'start_at_is_required'; end if;
  if p_end_at is not null and p_end_at < p_start_at then raise exception 'end_before_start'; end if;
  if p_visibility not in ('shared','private','partner_only') then raise exception 'invalid_visibility'; end if;
  if p_event_type not in ('life','financial','anniversary','medical','travel') then raise exception 'invalid_event_type'; end if;
  if p_linked_amount is not null and p_linked_amount < 0 then raise exception 'linked_amount_must_be_nonnegative'; end if;

  select u.couple_id into v_couple_id from public.users u where u.id = p_user_id;
  if v_couple_id is null then raise exception 'user_not_found_or_not_in_couple'; end if;
  if auth.uid() is not null and auth.uid() <> p_user_id then raise exception 'user_must_match_authenticated_user'; end if;

  insert into public.calendar_events (
    couple_id, created_by, title, description, start_at, end_at, all_day,
    visibility, event_type, is_recurring, recurrence_rule, location, linked_amount
  ) values (
    v_couple_id, p_user_id, btrim(p_title), nullif(btrim(p_description), ''), p_start_at, p_end_at, p_all_day,
    p_visibility, p_event_type, false, null, nullif(btrim(p_location), ''), p_linked_amount
  ) returning * into v_event;

  insert into public.chatgpt_action_logs (
    couple_id,user_id,entity_type,entity_id,action,raw_input,payload,status
  ) values (
    v_couple_id,p_user_id,'calendar_event',v_event.id,'create',p_raw_input,
    jsonb_build_object(
      'title',v_event.title,'start_at',v_event.start_at,'end_at',v_event.end_at,'all_day',v_event.all_day,
      'visibility',v_event.visibility,'event_type',v_event.event_type,'location',v_event.location,
      'linked_amount',v_event.linked_amount
    ),'executed'
  );

  return v_event;
end;
$$;

create or replace function public.update_chatgpt_calendar_event(
  p_user_id uuid,
  p_event_id uuid,
  p_changes jsonb,
  p_raw_input text default null
)
returns public.calendar_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_old public.calendar_events%rowtype;
  v_new public.calendar_events%rowtype;
  v_title text;
  v_description text;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_all_day boolean;
  v_visibility text;
  v_event_type text;
  v_location text;
  v_linked_amount numeric;
  v_allowed_keys text[] := array['title','description','start_at','end_at','all_day','visibility','event_type','location','linked_amount'];
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

  select * into v_old from public.calendar_events e where e.id = p_event_id;
  if not found then raise exception 'calendar_event_not_found'; end if;
  if v_old.couple_id <> v_couple_id then raise exception 'calendar_event_not_in_user_couple'; end if;

  v_title := case when p_changes ? 'title' then nullif(btrim(p_changes->>'title'),'') else v_old.title end;
  if v_title is null then raise exception 'title_is_required'; end if;
  v_description := case when p_changes ? 'description' then nullif(btrim(p_changes->>'description'),'') else v_old.description end;
  v_start_at := case when p_changes ? 'start_at' then nullif(p_changes->>'start_at','')::timestamptz else v_old.start_at end;
  v_end_at := case when p_changes ? 'end_at' then nullif(p_changes->>'end_at','')::timestamptz else v_old.end_at end;
  v_all_day := case when p_changes ? 'all_day' then (p_changes->>'all_day')::boolean else v_old.all_day end;
  v_visibility := case when p_changes ? 'visibility' then p_changes->>'visibility' else v_old.visibility end;
  v_event_type := case when p_changes ? 'event_type' then p_changes->>'event_type' else v_old.event_type end;
  v_location := case when p_changes ? 'location' then nullif(btrim(p_changes->>'location'),'') else v_old.location end;
  v_linked_amount := case when p_changes ? 'linked_amount' then nullif(p_changes->>'linked_amount','')::numeric else v_old.linked_amount end;

  if v_start_at is null then raise exception 'start_at_is_required'; end if;
  if v_end_at is not null and v_end_at < v_start_at then raise exception 'end_before_start'; end if;
  if v_visibility not in ('shared','private','partner_only') then raise exception 'invalid_visibility'; end if;
  if v_event_type not in ('life','financial','anniversary','medical','travel') then raise exception 'invalid_event_type'; end if;
  if v_linked_amount is not null and v_linked_amount < 0 then raise exception 'linked_amount_must_be_nonnegative'; end if;

  update public.calendar_events
  set title=v_title,
      description=v_description,
      start_at=v_start_at,
      end_at=v_end_at,
      all_day=v_all_day,
      visibility=v_visibility,
      event_type=v_event_type,
      location=v_location,
      linked_amount=v_linked_amount
  where id=p_event_id
  returning * into v_new;

  insert into public.chatgpt_action_logs (
    couple_id,user_id,entity_type,entity_id,action,raw_input,payload,status
  ) values (v_couple_id,p_user_id,'calendar_event',p_event_id,'update',p_raw_input,p_changes,'executed');

  return v_new;
end;
$$;

create or replace function public.delete_chatgpt_calendar_event(
  p_user_id uuid,
  p_event_id uuid,
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
  v_event public.calendar_events%rowtype;
begin
  if not p_confirmed then raise exception 'explicit_confirmation_required'; end if;
  select u.couple_id into v_couple_id from public.users u where u.id = p_user_id;
  if v_couple_id is null then raise exception 'user_not_found_or_not_in_couple'; end if;
  if auth.uid() is not null and auth.uid() <> p_user_id then raise exception 'user_must_match_authenticated_user'; end if;

  select * into v_event from public.calendar_events e where e.id = p_event_id;
  if not found then raise exception 'calendar_event_not_found'; end if;
  if v_event.couple_id <> v_couple_id then raise exception 'calendar_event_not_in_user_couple'; end if;

  insert into public.chatgpt_action_logs (
    couple_id,user_id,entity_type,entity_id,action,raw_input,payload,status
  ) values (
    v_couple_id,p_user_id,'calendar_event',p_event_id,'delete',p_raw_input,
    jsonb_build_object('title',v_event.title,'start_at',v_event.start_at,'end_at',v_event.end_at,'location',v_event.location),
    'executed'
  );

  delete from public.calendar_events where id=p_event_id;
  return p_event_id;
end;
$$;

revoke all on function public.register_chatgpt_calendar_event(uuid,text,timestamptz,timestamptz,boolean,text,text,text,text,numeric,text) from public, anon;
revoke all on function public.update_chatgpt_calendar_event(uuid,uuid,jsonb,text) from public, anon;
revoke all on function public.delete_chatgpt_calendar_event(uuid,uuid,boolean,text) from public, anon;

grant execute on function public.register_chatgpt_calendar_event(uuid,text,timestamptz,timestamptz,boolean,text,text,text,text,numeric,text) to authenticated, service_role;
grant execute on function public.update_chatgpt_calendar_event(uuid,uuid,jsonb,text) to authenticated, service_role;
grant execute on function public.delete_chatgpt_calendar_event(uuid,uuid,boolean,text) to authenticated, service_role;
