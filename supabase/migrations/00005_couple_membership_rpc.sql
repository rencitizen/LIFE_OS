create or replace function public.create_couple_for_current_user(p_name text)
returns public.couples
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
  v_couple public.couples;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if trim(coalesce(p_name, '')) = '' then
    raise exception 'Couple name is required';
  end if;

  if exists (
    select 1
    from public.users
    where id = v_user_id
      and couple_id is not null
  ) then
    raise exception 'User already belongs to a couple';
  end if;

  loop
    v_code := public.generate_invite_code();
    exit when not exists (
      select 1 from public.couples where invite_code = v_code
    );
  end loop;

  insert into public.couples (name, invite_code)
  values (trim(p_name), v_code)
  returning * into v_couple;

  update public.users
  set couple_id = v_couple.id
  where id = v_user_id;

  return v_couple;
end;
$$;

create or replace function public.join_couple_for_current_user(p_invite_code text)
returns public.couples
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple public.couples;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if trim(coalesce(p_invite_code, '')) = '' then
    raise exception 'Invite code is required';
  end if;

  if exists (
    select 1
    from public.users
    where id = v_user_id
      and couple_id is not null
  ) then
    raise exception 'User already belongs to a couple';
  end if;

  select *
  into v_couple
  from public.couples
  where invite_code = upper(trim(p_invite_code))
  limit 1;

  if v_couple.id is null then
    raise exception 'Invite code not found';
  end if;

  update public.users
  set couple_id = v_couple.id
  where id = v_user_id;

  return v_couple;
end;
$$;

grant execute on function public.create_couple_for_current_user(text) to authenticated;
grant execute on function public.join_couple_for_current_user(text) to authenticated;
