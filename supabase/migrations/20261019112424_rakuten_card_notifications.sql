-- Keep the private receipt table and service-role-only ingestion boundary.
alter table public.gmail_card_notifications
  drop constraint gmail_card_notifications_provider_check;
alter table public.gmail_card_notifications
  add constraint gmail_card_notifications_provider_check
  check (provider in ('jcb', 'smbc', 'rakuten'));

-- One Gmail message may contain multiple Rakuten purchases. Claim its first row
-- with the real message ID, and commit every row atomically before advancing the
-- Gmail history cursor. A retry cannot create another expense for the same row.
create function public.ingest_gmail_card_notifications(
  p_user_id uuid, p_email text, p_message_id text, p_notifications jsonb
) returns integer
language plpgsql security invoker set search_path = public as $$
declare
  v_item jsonb;
  v_index integer := 0;
  v_row_id text;
  v_expense uuid;
begin
  if jsonb_typeof(p_notifications) is distinct from 'array' then
    raise exception 'invalid_notification_batch';
  end if;
  if jsonb_array_length(p_notifications) < 1 or jsonb_array_length(p_notifications) > 100 then
    raise exception 'invalid_notification_batch';
  end if;
  if p_message_id is null or p_message_id !~ '^[A-Za-z0-9_-]{1,100}$' then
    raise exception 'invalid_message_id';
  end if;
  for v_item in select value from jsonb_array_elements(p_notifications) loop
    v_index := v_index + 1;
    v_row_id := case when v_index=1 then p_message_id else p_message_id||'#'||v_index::text end;
    v_expense := public.ingest_gmail_card_notification(p_user_id,p_email,v_row_id,v_item);
    if v_expense is not null then
      update public.expenses set import_meta=import_meta||jsonb_build_object(
        'gmail_message_id',p_message_id,
        'gmail_transaction_index',v_index,
        'date_precision',coalesce(v_item->>'datePrecision','minute')
      ) where id=v_expense;
    end if;
  end loop;
  return v_index;
end $$;
revoke all on function public.ingest_gmail_card_notifications(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.ingest_gmail_card_notifications(uuid,text,text,jsonb) to service_role;
