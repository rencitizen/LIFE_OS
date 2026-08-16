create or replace function public.register_chatgpt_shopping_item(
  p_user_id uuid,
  p_list_id uuid,
  p_name text,
  p_memo text default null,
  p_quantity numeric default null,
  p_unit text default null,
  p_estimated_price numeric default null,
  p_priority text default 'medium',
  p_raw_input text default null
)
returns public.shopping_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_item public.shopping_items%rowtype;
begin
  if nullif(btrim(p_name), '') is null then raise exception 'name_is_required'; end if;
  if p_priority not in ('high','medium','low') then raise exception 'invalid_priority'; end if;
  if p_quantity is not null and p_quantity <= 0 then raise exception 'quantity_must_be_positive'; end if;
  if p_estimated_price is not null and p_estimated_price < 0 then raise exception 'estimated_price_must_be_nonnegative'; end if;

  select u.couple_id into v_couple_id from public.users u where u.id = p_user_id;
  if v_couple_id is null then raise exception 'user_not_found_or_not_in_couple'; end if;
  if auth.uid() is not null and auth.uid() <> p_user_id then raise exception 'user_must_match_authenticated_user'; end if;

  if not exists (
    select 1 from public.shopping_lists l
    where l.id=p_list_id and l.couple_id=v_couple_id and l.is_active=true
  ) then raise exception 'active_shopping_list_not_in_user_couple'; end if;

  insert into public.shopping_items (
    list_id,name,memo,quantity,unit,estimated_price,priority,is_checked,checked_by,checked_at,expense_created
  ) values (
    p_list_id,btrim(p_name),nullif(btrim(p_memo),''),p_quantity,nullif(btrim(p_unit),''),p_estimated_price,p_priority,false,null,null,false
  ) returning * into v_item;

  insert into public.chatgpt_action_logs (
    couple_id,user_id,entity_type,entity_id,action,raw_input,payload,status
  ) values (
    v_couple_id,p_user_id,'shopping_item',v_item.id,'create',p_raw_input,
    jsonb_build_object(
      'list_id',v_item.list_id,'name',v_item.name,'memo',v_item.memo,'quantity',v_item.quantity,
      'unit',v_item.unit,'estimated_price',v_item.estimated_price,'priority',v_item.priority
    ),'executed'
  );

  return v_item;
end;
$$;

create or replace function public.update_chatgpt_shopping_item(
  p_user_id uuid,
  p_item_id uuid,
  p_changes jsonb,
  p_raw_input text default null
)
returns public.shopping_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_old public.shopping_items%rowtype;
  v_new public.shopping_items%rowtype;
  v_name text;
  v_memo text;
  v_quantity numeric;
  v_unit text;
  v_estimated_price numeric;
  v_priority text;
  v_allowed_keys text[] := array['name','memo','quantity','unit','estimated_price','priority'];
  v_key text;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes='{}'::jsonb then raise exception 'changes_are_required'; end if;
  for v_key in select jsonb_object_keys(p_changes)
  loop
    if not (v_key=any(v_allowed_keys)) then raise exception 'unsupported_change_key: %',v_key; end if;
  end loop;

  select u.couple_id into v_couple_id from public.users u where u.id=p_user_id;
  if v_couple_id is null then raise exception 'user_not_found_or_not_in_couple'; end if;
  if auth.uid() is not null and auth.uid()<>p_user_id then raise exception 'user_must_match_authenticated_user'; end if;

  select i.* into v_old
  from public.shopping_items i
  join public.shopping_lists l on l.id=i.list_id
  where i.id=p_item_id and l.couple_id=v_couple_id;
  if not found then raise exception 'shopping_item_not_in_user_couple'; end if;

  v_name := case when p_changes?'name' then nullif(btrim(p_changes->>'name'),'') else v_old.name end;
  if v_name is null then raise exception 'name_is_required'; end if;
  v_memo := case when p_changes?'memo' then nullif(btrim(p_changes->>'memo'),'') else v_old.memo end;
  v_quantity := case when p_changes?'quantity' then nullif(p_changes->>'quantity','')::numeric else v_old.quantity end;
  v_unit := case when p_changes?'unit' then nullif(btrim(p_changes->>'unit'),'') else v_old.unit end;
  v_estimated_price := case when p_changes?'estimated_price' then nullif(p_changes->>'estimated_price','')::numeric else v_old.estimated_price end;
  v_priority := case when p_changes?'priority' then p_changes->>'priority' else v_old.priority end;

  if v_priority not in ('high','medium','low') then raise exception 'invalid_priority'; end if;
  if v_quantity is not null and v_quantity<=0 then raise exception 'quantity_must_be_positive'; end if;
  if v_estimated_price is not null and v_estimated_price<0 then raise exception 'estimated_price_must_be_nonnegative'; end if;

  update public.shopping_items
  set name=v_name,memo=v_memo,quantity=v_quantity,unit=v_unit,estimated_price=v_estimated_price,priority=v_priority
  where id=p_item_id
  returning * into v_new;

  insert into public.chatgpt_action_logs (
    couple_id,user_id,entity_type,entity_id,action,raw_input,payload,status
  ) values (v_couple_id,p_user_id,'shopping_item',p_item_id,'update',p_raw_input,p_changes,'executed');

  return v_new;
end;
$$;

create or replace function public.set_chatgpt_shopping_item_checked(
  p_user_id uuid,
  p_item_id uuid,
  p_checked boolean,
  p_raw_input text default null
)
returns public.shopping_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_item public.shopping_items%rowtype;
begin
  select u.couple_id into v_couple_id from public.users u where u.id=p_user_id;
  if v_couple_id is null then raise exception 'user_not_found_or_not_in_couple'; end if;
  if auth.uid() is not null and auth.uid()<>p_user_id then raise exception 'user_must_match_authenticated_user'; end if;

  if not exists (
    select 1 from public.shopping_items i
    join public.shopping_lists l on l.id=i.list_id
    where i.id=p_item_id and l.couple_id=v_couple_id
  ) then raise exception 'shopping_item_not_in_user_couple'; end if;

  update public.shopping_items
  set is_checked=p_checked,
      checked_by=case when p_checked then p_user_id else null end,
      checked_at=case when p_checked then now() else null end
  where id=p_item_id
  returning * into v_item;

  insert into public.chatgpt_action_logs (
    couple_id,user_id,entity_type,entity_id,action,raw_input,payload,status
  ) values (
    v_couple_id,p_user_id,'shopping_item',p_item_id,case when p_checked then 'complete' else 'update' end,
    p_raw_input,jsonb_build_object('is_checked',p_checked),'executed'
  );

  return v_item;
end;
$$;

create or replace function public.delete_chatgpt_shopping_item(
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
  v_item public.shopping_items%rowtype;
begin
  if not p_confirmed then raise exception 'explicit_confirmation_required'; end if;
  select u.couple_id into v_couple_id from public.users u where u.id=p_user_id;
  if v_couple_id is null then raise exception 'user_not_found_or_not_in_couple'; end if;
  if auth.uid() is not null and auth.uid()<>p_user_id then raise exception 'user_must_match_authenticated_user'; end if;

  select i.* into v_item
  from public.shopping_items i join public.shopping_lists l on l.id=i.list_id
  where i.id=p_item_id and l.couple_id=v_couple_id;
  if not found then raise exception 'shopping_item_not_in_user_couple'; end if;

  insert into public.chatgpt_action_logs (
    couple_id,user_id,entity_type,entity_id,action,raw_input,payload,status
  ) values (
    v_couple_id,p_user_id,'shopping_item',p_item_id,'delete',p_raw_input,
    jsonb_build_object('list_id',v_item.list_id,'name',v_item.name,'memo',v_item.memo,'is_checked',v_item.is_checked),'executed'
  );

  delete from public.shopping_items where id=p_item_id;
  return p_item_id;
end;
$$;

revoke all on function public.register_chatgpt_shopping_item(uuid,uuid,text,text,numeric,text,numeric,text,text) from public, anon;
revoke all on function public.update_chatgpt_shopping_item(uuid,uuid,jsonb,text) from public, anon;
revoke all on function public.set_chatgpt_shopping_item_checked(uuid,uuid,boolean,text) from public, anon;
revoke all on function public.delete_chatgpt_shopping_item(uuid,uuid,boolean,text) from public, anon;

grant execute on function public.register_chatgpt_shopping_item(uuid,uuid,text,text,numeric,text,numeric,text,text) to authenticated, service_role;
grant execute on function public.update_chatgpt_shopping_item(uuid,uuid,jsonb,text) to authenticated, service_role;
grant execute on function public.set_chatgpt_shopping_item_checked(uuid,uuid,boolean,text) to authenticated, service_role;
grant execute on function public.delete_chatgpt_shopping_item(uuid,uuid,boolean,text) to authenticated, service_role;
