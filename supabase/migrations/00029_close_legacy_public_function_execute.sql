revoke execute on function public.create_couple_for_current_user(text) from public, anon;
revoke execute on function public.generate_invite_code() from public, anon;
revoke execute on function public.get_couple_id() from public, anon;
revoke execute on function public.handle_auth_user_created() from public, anon, authenticated;
revoke execute on function public.join_couple_for_current_user(text) from public, anon;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.seed_default_categories() from public, anon;
revoke execute on function public.update_savings_current_amount() from public, anon, authenticated;

grant execute on function public.create_couple_for_current_user(text) to authenticated, service_role;
grant execute on function public.join_couple_for_current_user(text) to authenticated, service_role;
grant execute on function public.get_couple_id() to authenticated, service_role;
grant execute on function public.seed_default_categories() to authenticated, service_role;
grant execute on function public.generate_invite_code() to service_role;
