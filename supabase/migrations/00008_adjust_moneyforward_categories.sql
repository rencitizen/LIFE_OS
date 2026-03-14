create or replace function seed_default_categories()
returns trigger as $$
begin
  insert into expense_categories (couple_id, name, icon, is_default, sort_order) values
    (new.id, '食費', '🍽️', true, 1),
    (new.id, '日用品', '🧻', true, 2),
    (new.id, '交通費', '🚃', true, 3),
    (new.id, '自動車', '🚗', true, 4),
    (new.id, '健康・医療', '🏥', true, 5),
    (new.id, '趣味・娯楽', '🎮', true, 6),
    (new.id, '衣服・美容', '👕', true, 7),
    (new.id, '水道・光熱費', '💡', true, 8),
    (new.id, '通信費', '📱', true, 9),
    (new.id, '住宅', '🏠', true, 10),
    (new.id, '税・社会保障', '📄', true, 11),
    (new.id, '教養・教育', '📚', true, 12),
    (new.id, '特別な支出', '🎁', true, 13),
    (new.id, 'その他', '📦', true, 99);
  return new;
end;
$$ language plpgsql security definer;

do $$
declare
  couple_row record;
  insurance_id uuid;
  tax_id uuid;
begin
  for couple_row in select id from couples loop
    insert into expense_categories (couple_id, name, icon, is_default, sort_order)
    values (couple_row.id, '自動車', '🚗', true, 4)
    on conflict do nothing;

    insert into expense_categories (couple_id, name, icon, is_default, sort_order)
    values (couple_row.id, '税・社会保障', '📄', true, 11)
    on conflict do nothing;

    update expense_categories
    set icon = '🚗', is_default = true, sort_order = 4
    where couple_id = couple_row.id and name = '自動車';

    update expense_categories
    set icon = '📄', is_default = true, sort_order = 11
    where couple_id = couple_row.id and name = '税・社会保障';

    select id into insurance_id
    from expense_categories
    where couple_id = couple_row.id and name = '保険'
    order by created_at
    limit 1;

    select id into tax_id
    from expense_categories
    where couple_id = couple_row.id and name = '税・社会保障'
    order by created_at
    limit 1;

    if insurance_id is null or tax_id is null or insurance_id = tax_id then
      continue;
    end if;

    update expenses
    set category_id = tax_id
    where couple_id = couple_row.id
      and category_id = insurance_id;

    update budget_categories bc
    set category_id = tax_id
    where bc.category_id = insurance_id
      and exists (
        select 1 from budgets b
        where b.id = bc.budget_id and b.couple_id = couple_row.id
      )
      and not exists (
        select 1 from budget_categories existing
        where existing.budget_id = bc.budget_id
          and existing.category_id = tax_id
      );

    update budget_categories target
    set limit_amount = coalesce(target.limit_amount, 0) + coalesce(source.limit_amount, 0),
        alert_ratio = greatest(target.alert_ratio, coalesce(source.alert_ratio, 0.80))
    from budget_categories source
    join budgets b on b.id = source.budget_id
    where b.couple_id = couple_row.id
      and source.category_id = insurance_id
      and target.budget_id = source.budget_id
      and target.category_id = tax_id;

    delete from budget_categories bc
    using budgets b
    where b.id = bc.budget_id
      and b.couple_id = couple_row.id
      and bc.category_id = insurance_id;

    delete from expense_categories
    where id = insurance_id;
  end loop;
end;
$$;
