drop policy if exists "Users can update self" on public.users;

create policy "Users can update self" on public.users
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and couple_id is not distinct from old.couple_id
  );

create or replace function public.convert_shopping_items_to_expenses(p_item_ids uuid[], p_paid_by uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple_id uuid;
  v_item record;
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_paid_by is null then
    raise exception 'Paid by user is required';
  end if;

  if p_paid_by is distinct from v_user_id then
    raise exception 'Cannot create expenses for another user';
  end if;

  if p_item_ids is null or array_length(p_item_ids, 1) is null then
    return 0;
  end if;

  select couple_id
  into v_couple_id
  from public.users
  where id = v_user_id;

  if v_couple_id is null then
    raise exception 'User must belong to a couple';
  end if;

  for v_item in
    select si.id, si.name, si.estimated_price
    from public.shopping_items si
    join public.shopping_lists sl on sl.id = si.list_id
    where si.id = any(p_item_ids)
      and sl.couple_id = v_couple_id
      and coalesce(si.expense_created, false) = false
      and coalesce(si.estimated_price, 0) > 0
    order by si.created_at
    for update
  loop
    insert into public.expenses (
      couple_id,
      paid_by,
      amount,
      currency,
      description,
      expense_date,
      expense_type,
      source,
      notes,
      is_fixed,
      category_id
    )
    values (
      v_couple_id,
      p_paid_by,
      v_item.estimated_price,
      'JPY',
      v_item.name,
      current_date,
      'shared',
      'shopping_list',
      '買い物リストから作成',
      false,
      null
    );

    update public.shopping_items
    set expense_created = true
    where id = v_item.id
      and expense_created = false;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.convert_shopping_items_to_expenses(uuid[], uuid) to authenticated;
