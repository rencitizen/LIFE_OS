create unique index if not exists expense_split_profiles_one_open_per_couple
  on public.expense_split_profiles(couple_id)
  where effective_to is null;

create index if not exists expense_splits_unsettled_idx
  on public.expense_splits(is_settled, expense_id)
  where is_settled = false;
