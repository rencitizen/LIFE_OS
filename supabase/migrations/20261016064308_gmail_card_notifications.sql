-- OAuth secrets are encrypted in the application and are never readable through
-- authenticated/anonymous Data API clients. Only backend service_role can use them.
create table public.gmail_connections (
  user_id uuid primary key references public.users(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  email text not null unique,
  refresh_token_encrypted text not null,
  enabled boolean not null default true,
  connected_at timestamptz not null default now(),
  history_id text,
  watch_expires_at timestamptz,
  last_synced_at timestamptz,
  last_error text
);
alter table public.gmail_connections enable row level security;
revoke all on public.gmail_connections from public, anon, authenticated;
grant all on public.gmail_connections to service_role;
create index gmail_connections_couple_idx on public.gmail_connections(couple_id);

create table public.gmail_card_notifications (
  email text not null,
  message_id text not null,
  user_id uuid not null references public.users(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  provider text not null check (provider in ('jcb','smbc')),
  amount numeric(12,2),
  merchant text,
  used_at timestamptz,
  kind text not null check (kind in ('purchase','investment','review')),
  reason text,
  expense_id uuid references public.expenses(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(email,message_id)
);
alter table public.gmail_card_notifications enable row level security;
revoke all on public.gmail_card_notifications from public, anon, authenticated;
grant all on public.gmail_card_notifications to service_role;
create index gmail_card_notifications_user_created_idx on public.gmail_card_notifications(user_id, created_at desc);
create index gmail_card_notifications_couple_idx on public.gmail_card_notifications(couple_id);
create index gmail_card_notifications_expense_idx on public.gmail_card_notifications(expense_id);

-- SECURITY INVOKER: only service_role has EXECUTE/table access. The receipt claim
-- and expense insert share one transaction, making concurrent/retried pushes safe.
create function public.ingest_gmail_card_notification(
  p_user_id uuid, p_email text, p_message_id text, p_notification jsonb
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_connection public.gmail_connections%rowtype;
  v_couple uuid;
  v_expense uuid;
  v_amount numeric := nullif(p_notification->>'amount','')::numeric;
  v_used_at timestamptz := nullif(p_notification->>'usedAt','')::timestamptz;
  v_claimed integer;
begin
  select * into v_connection from public.gmail_connections
    where user_id=p_user_id and email=p_email and enabled=true for update;
  if not found then raise exception 'gmail_connection_not_found'; end if;
  select couple_id into v_couple from public.users where id=p_user_id;
  if v_couple is null or v_couple <> v_connection.couple_id then raise exception 'gmail_owner_membership_changed'; end if;
  if coalesce(p_message_id,'')='' or length(p_message_id)>128 then raise exception 'invalid_message_id'; end if;

  insert into public.gmail_card_notifications(email,message_id,user_id,couple_id,provider,amount,merchant,used_at,kind,reason)
  values(p_email,p_message_id,p_user_id,v_couple,p_notification->>'provider',v_amount,p_notification->>'merchant',v_used_at,p_notification->>'kind',p_notification->>'reason')
  on conflict(email,message_id) do nothing;
  get diagnostics v_claimed = row_count;
  if v_claimed=0 then
    select expense_id into v_expense from public.gmail_card_notifications where email=p_email and message_id=p_message_id;
    return v_expense;
  end if;

  if p_notification->>'kind'='purchase' then
    if v_amount is null or v_amount<=0 or v_used_at is null or nullif(btrim(p_notification->>'merchant'),'') is null then
      raise exception 'incomplete_purchase_notification';
    end if;
    insert into public.expenses(couple_id,paid_by,amount,currency,category_id,description,expense_date,expense_type,payment_method,is_fixed,source,is_settlement_target,record_kind,counts_toward_totals,external_provider,external_id,import_meta,notes)
    values(v_couple,p_user_id,v_amount,'JPY',null,p_notification->>'merchant',(v_used_at at time zone 'Asia/Tokyo')::date,'personal','card',false,'auto',false,'transaction',true,'gmail',p_email||':'||p_message_id,
      jsonb_build_object('status','provisional','provider',p_notification->>'provider','card',p_notification->>'card','used_at',v_used_at,'gmail_message_id',p_message_id),
      'カード利用通知から自動登録（未確定・明細照合前）')
    returning id into v_expense;
    update public.gmail_card_notifications set expense_id=v_expense where email=p_email and message_id=p_message_id;
  end if;
  return v_expense;
end $$;
revoke all on function public.ingest_gmail_card_notification(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.ingest_gmail_card_notification(uuid,text,text,jsonb) to service_role;
