create table public.bucket_list_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.users(id),
  title text not null check (length(btrim(title)) > 0),
  memo text,
  category text,
  created_at timestamptz not null default now()
);

create index idx_bucket_list_items_couple_created_at
  on public.bucket_list_items(couple_id, created_at desc);

alter table public.bucket_list_items enable row level security;

create policy "Bucket list couple access" on public.bucket_list_items
  for all
  using (couple_id = public.get_couple_id())
  with check (couple_id = public.get_couple_id());

create or replace function public.register_chatgpt_bucket_list_item(
  p_user_id uuid,
  p_title text,
  p_memo text default null,
  p_category text default null,
  p_raw_input text default null
)
returns public.bucket_list_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_item public.bucket_list_items%rowtype;
begin
  if nullif(btrim(p_title), '') is null then raise exception 'title_is_required'; end if;
  select u.couple_id into v_couple_id from public.users u where u.id = p_user_id;
  if v_couple_id is null then raise exception 'user_not_found_or_not_in_couple'; end if;
  if auth.uid() is not null and auth.uid() <> p_user_id then raise exception 'user_must_match_authenticated_user'; end if;

  insert into public.bucket_list_items(couple_id, created_by, title, memo, category)
  values (v_couple_id, p_user_id, btrim(p_title), nullif(btrim(p_memo), ''), nullif(btrim(p_category), ''))
  returning * into v_item;

  insert into public.chatgpt_action_logs(couple_id,user_id,entity_type,entity_id,action,raw_input,payload,status)
  values (v_couple_id,p_user_id,'bucket_list_item',v_item.id,'create',p_raw_input,
    jsonb_build_object('title',v_item.title,'memo',v_item.memo,'category',v_item.category),'executed');

  return v_item;
end;
$$;

create or replace function public.update_chatgpt_bucket_list_item(
  p_user_id uuid,
  p_item_id uuid,
  p_changes jsonb,
  p_raw_input text default null
)
returns public.bucket_list_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_old public.bucket_list_items%rowtype;
  v_new public.bucket_list_items%rowtype;
  v_title text;
  v_memo text;
  v_category text;
  v_key text;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then raise exception 'changes_are_required'; end if;
  for v_key in select jsonb_object_keys(p_changes)
  loop
    if v_key not in ('title','memo','category') then raise exception 'unsupported_change_key: %',v_key; end if;
  end loop;

  select u.couple_id into v_couple_id from public.users u where u.id = p_user_id;
  if v_couple_id is null then raise exception 'user_not_found_or_not_in_couple'; end if;
  if auth.uid() is not null and auth.uid() <> p_user_id then raise exception 'user_must_match_authenticated_user'; end if;

  select * into v_old from public.bucket_list_items b where b.id = p_item_id;
  if not found then raise exception 'bucket_list_item_not_found'; end if;
  if v_old.couple_id <> v_couple_id then raise exception 'bucket_list_item_not_in_user_couple'; end if;

  v_title := case when p_changes ? 'title' then nullif(btrim(p_changes->>'title'),'') else v_old.title end;
  v_memo := case when p_changes ? 'memo' then nullif(btrim(p_changes->>'memo'),'') else v_old.memo end;
  v_category := case when p_changes ? 'category' then nullif(btrim(p_changes->>'category'),'') else v_old.category end;
  if v_title is null then raise exception 'title_is_required'; end if;

  update public.bucket_list_items
  set title = v_title, memo = v_memo, category = v_category
  where id = p_item_id returning * into v_new;

  insert into public.chatgpt_action_logs(couple_id,user_id,entity_type,entity_id,action,raw_input,payload,status)
  values (v_couple_id,p_user_id,'bucket_list_item',p_item_id,'update',p_raw_input,p_changes,'executed');

  return v_new;
end;
$$;

create or replace function public.delete_chatgpt_bucket_list_item(
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
  v_item public.bucket_list_items%rowtype;
begin
  if not p_confirmed then raise exception 'explicit_confirmation_required'; end if;
  select u.couple_id into v_couple_id from public.users u where u.id = p_user_id;
  if v_couple_id is null then raise exception 'user_not_found_or_not_in_couple'; end if;
  if auth.uid() is not null and auth.uid() <> p_user_id then raise exception 'user_must_match_authenticated_user'; end if;

  select * into v_item from public.bucket_list_items b where b.id = p_item_id;
  if not found then raise exception 'bucket_list_item_not_found'; end if;
  if v_item.couple_id <> v_couple_id then raise exception 'bucket_list_item_not_in_user_couple'; end if;

  insert into public.chatgpt_action_logs(couple_id,user_id,entity_type,entity_id,action,raw_input,payload,status)
  values (v_couple_id,p_user_id,'bucket_list_item',p_item_id,'delete',p_raw_input,
    jsonb_build_object('title',v_item.title,'memo',v_item.memo,'category',v_item.category),'executed');

  delete from public.bucket_list_items where id = p_item_id;
  return p_item_id;
end;
$$;

revoke all on function public.register_chatgpt_bucket_list_item(uuid,text,text,text,text) from public, anon;
revoke all on function public.update_chatgpt_bucket_list_item(uuid,uuid,jsonb,text) from public, anon;
revoke all on function public.delete_chatgpt_bucket_list_item(uuid,uuid,boolean,text) from public, anon;

grant execute on function public.register_chatgpt_bucket_list_item(uuid,text,text,text,text) to authenticated, service_role;
grant execute on function public.update_chatgpt_bucket_list_item(uuid,uuid,jsonb,text) to authenticated, service_role;
grant execute on function public.delete_chatgpt_bucket_list_item(uuid,uuid,boolean,text) to authenticated, service_role;
