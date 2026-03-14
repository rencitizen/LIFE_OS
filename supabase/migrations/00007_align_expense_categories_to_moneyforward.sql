create or replace function seed_default_categories()
returns trigger as $$
begin
  insert into expense_categories (couple_id, name, icon, is_default, sort_order) values
    (new.id, '食費', '🍽️', true, 1),
    (new.id, '日用品', '🧻', true, 2),
    (new.id, '交通費', '🚃', true, 3),
    (new.id, '健康・医療', '🏥', true, 4),
    (new.id, '趣味・娯楽', '🎮', true, 5),
    (new.id, '衣服・美容', '👕', true, 6),
    (new.id, '水道・光熱費', '💡', true, 7),
    (new.id, '通信費', '📱', true, 8),
    (new.id, '住宅', '🏠', true, 9),
    (new.id, '保険', '🛡️', true, 10),
    (new.id, '教養・教育', '📚', true, 11),
    (new.id, '特別な支出', '🎁', true, 12),
    (new.id, 'その他', '📦', true, 99);
  return new;
end;
$$ language plpgsql security definer;

do $$
declare
  mapping record;
  couple record;
  target_category_id uuid;
  old_category_id uuid;
  budget_row record;
begin
  for couple in select id from couples loop
    for mapping in
      select *
      from (
        values
          ('食費', '食費', '🍽️', 1),
          ('日用品', '日用品', '🧻', 2),
          ('交通費', '交通費', '🚃', 3),
          ('医療費', '健康・医療', '🏥', 4),
          ('健康・医療', '健康・医療', '🏥', 4),
          ('娯楽', '趣味・娯楽', '🎮', 5),
          ('趣味・娯楽', '趣味・娯楽', '🎮', 5),
          ('衣服', '衣服・美容', '👕', 6),
          ('衣服・美容', '衣服・美容', '👕', 6),
          ('光熱費', '水道・光熱費', '💡', 7),
          ('水道・光熱費', '水道・光熱費', '💡', 7),
          ('通信費', '通信費', '📱', 8),
          ('家賃', '住宅', '🏠', 9),
          ('住宅', '住宅', '🏠', 9),
          ('保険', '保険', '🛡️', 10),
          ('教育', '教養・教育', '📚', 11),
          ('教養・教育', '教養・教育', '📚', 11),
          ('旅行', '特別な支出', '🎁', 12),
          ('サブスク', '趣味・娯楽', '🎮', 5),
          ('特別な支出', '特別な支出', '🎁', 12),
          ('その他', 'その他', '📦', 99)
      ) as t(old_name, new_name, icon, sort_order)
    loop
      select id
      into target_category_id
      from expense_categories
      where couple_id = couple.id
        and name = mapping.new_name
      order by created_at
      limit 1;

      if target_category_id is null then
        insert into expense_categories (couple_id, name, icon, is_default, sort_order)
        values (couple.id, mapping.new_name, mapping.icon, true, mapping.sort_order)
        returning id into target_category_id;
      else
        update expense_categories
        set icon = mapping.icon,
            is_default = true,
            sort_order = mapping.sort_order
        where id = target_category_id;
      end if;

      select id
      into old_category_id
      from expense_categories
      where couple_id = couple.id
        and name = mapping.old_name
      order by created_at
      limit 1;

      if old_category_id is null or old_category_id = target_category_id then
        continue;
      end if;

      update expenses
      set category_id = target_category_id
      where couple_id = couple.id
        and category_id = old_category_id;

      for budget_row in
        select bc.id, bc.budget_id, bc.limit_amount, bc.alert_ratio
        from budget_categories bc
        join budgets b on b.id = bc.budget_id
        where b.couple_id = couple.id
          and bc.category_id = old_category_id
      loop
        if exists (
          select 1
          from budget_categories
          where budget_id = budget_row.budget_id
            and category_id = target_category_id
        ) then
          update budget_categories
          set limit_amount = coalesce(limit_amount, 0) + coalesce(budget_row.limit_amount, 0),
              alert_ratio = greatest(alert_ratio, coalesce(budget_row.alert_ratio, 0.80))
          where budget_id = budget_row.budget_id
            and category_id = target_category_id;

          delete from budget_categories
          where id = budget_row.id;
        else
          update budget_categories
          set category_id = target_category_id
          where id = budget_row.id;
        end if;
      end loop;

      delete from expense_categories
      where id = old_category_id;
    end loop;
  end loop;
end;
$$;
