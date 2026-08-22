-- Performance cleanup from Supabase advisor.
-- Avoid per-row auth.uid() evaluation in hot RLS policies.

drop policy if exists "Users can view couple members" on public.users;
create policy "Users can view couple members" on public.users for select
using ((couple_id = public.get_couple_id()) or (id = (select auth.uid())));

drop policy if exists "Users can insert self" on public.users;
create policy "Users can insert self" on public.users for insert
with check (id = (select auth.uid()));

drop policy if exists "Users can update self" on public.users;
create policy "Users can update self" on public.users for update
using (id = (select auth.uid()));

drop policy if exists "Calendar select" on public.calendar_events;
create policy "Calendar select" on public.calendar_events for select
using (
  couple_id = public.get_couple_id()
  and (visibility = 'shared' or created_by = (select auth.uid()))
);

drop policy if exists "Calendar delete" on public.calendar_events;
create policy "Calendar delete" on public.calendar_events for delete
using (couple_id = public.get_couple_id() and created_by = (select auth.uid()));

drop policy if exists "Todo select" on public.todos;
create policy "Todo select" on public.todos for select
using (
  couple_id = public.get_couple_id()
  and (
    visibility = 'shared'
    or created_by = (select auth.uid())
    or assigned_to = (select auth.uid())
  )
);

drop policy if exists "Todo delete" on public.todos;
create policy "Todo delete" on public.todos for delete
using (couple_id = public.get_couple_id() and created_by = (select auth.uid()));

create index if not exists accounts_couple_idx on public.accounts(couple_id);
create index if not exists accounts_owner_idx on public.accounts(owner_id);
create index if not exists budget_categories_category_idx on public.budget_categories(category_id);
create index if not exists calendar_events_created_by_idx on public.calendar_events(created_by);
create index if not exists expenses_split_profile_idx on public.expenses(split_profile_id);
create index if not exists finance_action_logs_settlement_idx on public.finance_action_logs(settlement_id);
create index if not exists finance_plan_action_logs_plan_item_idx on public.finance_plan_action_logs(plan_item_id);
create index if not exists finance_plan_action_logs_user_idx on public.finance_plan_action_logs(user_id);
create index if not exists finance_plan_items_created_by_idx on public.finance_plan_items(created_by);
create index if not exists idea_items_created_by_idx on public.idea_items(created_by);
create index if not exists moneyforward_import_runs_user_idx on public.moneyforward_import_runs(user_id);
create index if not exists savings_contributions_user_idx on public.savings_contributions(user_id);
create index if not exists savings_goals_couple_idx on public.savings_goals(couple_id);
create index if not exists shopping_items_checked_by_idx on public.shopping_items(checked_by);
create index if not exists shopping_lists_created_by_idx on public.shopping_lists(created_by);
create index if not exists todos_created_by_idx on public.todos(created_by);
create index if not exists todos_event_idx on public.todos(event_id);
create index if not exists todos_parent_todo_idx on public.todos(parent_todo_id);
