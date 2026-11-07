-- Applied to LIFE_OS Supabase on 2026-11-07; idempotent on re-apply.
alter table public.gmail_card_notifications drop constraint if exists gmail_card_notifications_provider_check;
alter table public.gmail_card_notifications add constraint gmail_card_notifications_provider_check check (provider in ('jcb','smbc','rakuten','viewcard'));

create or replace function public.lifeos_merchant_key(p_text text)
returns text language sql immutable strict security invoker set search_path=''
as $$
 select lower(regexp_replace(translate(p_text, '　－ーｰ・．（）「」『』', '           '), '[[:space:][:punct:]]+', '', 'g'));
$$;

create or replace function public.lifeos_suggest_category(p_couple_id uuid, p_description text)
returns uuid language sql stable security invoker set search_path=''
as $$
with matching as (
 select category_id from public.expenses
 where couple_id=p_couple_id and category_id is not null
 and record_kind='transaction' and description is not null
 and public.lifeos_merchant_key(description)=public.lifeos_merchant_key(p_description)
), agg as (
 select count(*) as matches, count(distinct category_id) as distinct_categories,
 min(category_id::text)::uuid as predicted from matching
)
select case when length(public.lifeos_merchant_key(p_description)) >= 4
and matches >= 2 and distinct_categories = 1 then predicted else null::uuid end
from agg;
$$;

create or replace function public.lifeos_autocategory_imported_expense()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
 if new.category_id is null and new.source='auto' and new.record_kind='transaction'
 and new.description is not null and new.couple_id is not null then
 new.category_id := public.lifeos_suggest_category(new.couple_id,new.description);
 end if;
 return new;
end;
$$;
drop trigger if exists lifeos_autocategory_imported_expense on public.expenses;
create trigger lifeos_autocategory_imported_expense
before insert on public.expenses for each row
execute function public.lifeos_autocategory_imported_expense();
revoke execute on function public.lifeos_merchant_key(text) from public, anon, authenticated;
revoke execute on function public.lifeos_suggest_category(uuid,text) from public, anon, authenticated;
revoke execute on function public.lifeos_autocategory_imported_expense() from public, anon, authenticated;
grant execute on function public.lifeos_merchant_key(text) to service_role;
grant execute on function public.lifeos_suggest_category(uuid,text) to service_role;
grant execute on function public.lifeos_autocategory_imported_expense() to service_role;
