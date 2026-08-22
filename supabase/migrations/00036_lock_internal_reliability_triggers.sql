-- Internal trigger helpers must never be callable over PostgREST RPC.
revoke all on function public.ensure_expense_split_consistency() from public, anon, authenticated;
revoke all on function public.mirror_todo_action_log() from public, anon, authenticated;
revoke all on function public.mirror_finance_action_log() from public, anon, authenticated;
revoke all on function public.mirror_finance_plan_action_log() from public, anon, authenticated;

grant execute on function public.ensure_expense_split_consistency() to service_role;
grant execute on function public.mirror_todo_action_log() to service_role;
grant execute on function public.mirror_finance_action_log() to service_role;
grant execute on function public.mirror_finance_plan_action_log() to service_role;