-- Supabase may retain explicit execute grants for API roles on functions.
-- Keep the ChatGPT write RPC unavailable to anon while allowing authenticated app callers
-- and privileged service/database callers.

revoke execute on function public.register_chatgpt_expense(
  uuid, numeric, date, text, text, boolean, text, text, text, text
) from anon;

revoke all on function public.register_chatgpt_expense(
  uuid, numeric, date, text, text, boolean, text, text, text, text
) from public;

grant execute on function public.register_chatgpt_expense(
  uuid, numeric, date, text, text, boolean, text, text, text, text
) to authenticated;

grant execute on function public.register_chatgpt_expense(
  uuid, numeric, date, text, text, boolean, text, text, text, text
) to service_role;
