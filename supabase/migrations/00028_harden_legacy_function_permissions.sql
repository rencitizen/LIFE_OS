alter function public.generate_invite_code() set search_path = public;
alter function public.get_couple_id() set search_path = public;
alter function public.update_savings_current_amount() set search_path = public;
alter function public.seed_default_categories() set search_path = public;

revoke execute on function public.create_couple_for_current_user(text) from anon;
revoke execute on function public.get_couple_id() from anon;
revoke execute on function public.handle_auth_user_created() from anon;
revoke execute on function public.join_couple_for_current_user(text) from anon;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.seed_default_categories() from anon;
revoke execute on function public.update_savings_current_amount() from anon;
revoke execute on function public.generate_invite_code() from anon;
