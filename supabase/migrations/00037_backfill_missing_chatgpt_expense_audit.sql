-- Backfill only expenses that are explicitly marked source=chatgpt and lack a create audit.
-- Raw conversational input is intentionally left NULL; the payload records that this is a DB-derived repair.
insert into public.finance_action_logs (
  couple_id,user_id,expense_id,source,action,raw_input,payload,status,created_at
)
select
  e.couple_id,
  e.paid_by,
  e.id,
  'chatgpt',
  'create_expense',
  null,
  jsonb_build_object(
    'backfilled',true,
    'reason','missing_historical_audit',
    'amount',e.amount,
    'expense_date',e.expense_date,
    'description',e.description,
    'expense_type',e.expense_type,
    'is_settlement_target',e.is_settlement_target,
    'category_id',e.category_id
  ),
  'executed',
  e.created_at
from public.expenses e
where e.source='chatgpt'
  and not exists (
    select 1 from public.finance_action_logs l
    where l.expense_id=e.id and l.action='create_expense' and l.status='executed'
  );