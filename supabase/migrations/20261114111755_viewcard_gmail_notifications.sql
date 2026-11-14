alter table public.gmail_card_notifications
  drop constraint gmail_card_notifications_provider_check,
  add constraint gmail_card_notifications_provider_check
    check (provider in ('jcb','smbc','rakuten','viewcard'));

create or replace function public.ingest_gmail_card_notification(
  p_user_id uuid,p_email text,p_message_id text,p_notification jsonb
) returns uuid language plpgsql security invoker set search_path=public as $$
declare
 v_connection public.gmail_connections%rowtype;
 v_receipt public.gmail_card_notifications%rowtype;
 v_couple uuid; v_expense uuid; v_count integer; v_exact integer;
 v_manual_candidates integer := 0; v_same_amount integer;
 v_amount numeric := nullif(p_notification->>'amount','')::numeric;
 v_used_at timestamptz := nullif(p_notification->>'usedAt','')::timestamptz;
 v_day date := (v_used_at at time zone 'Asia/Tokyo')::date;
 v_version integer := coalesce((p_notification->>'parserVersion')::integer,0);
 v_kind text := p_notification->>'kind';
 v_reason text := p_notification->>'reason';
 v_viewcard_flash boolean := coalesce(
   p_notification->>'provider'='viewcard' and p_notification->>'stage'='authorization',false
 );
begin
 -- Both import directions take this lock before looking for candidates. It also
 -- serializes ordinary expense writes while the short reconciliation runs.
 lock table public.expenses in share row exclusive mode;
 select * into v_connection from public.gmail_connections
   where user_id=p_user_id and email=p_email and enabled for update;
 if not found then raise exception 'gmail_connection_not_found'; end if;
 select couple_id into v_couple from public.users where id=p_user_id;
 if v_couple is null or v_couple<>v_connection.couple_id then raise exception 'gmail_owner_membership_changed'; end if;
 if coalesce(p_message_id,'')='' or length(p_message_id)>128 then raise exception 'invalid_message_id'; end if;
 select * into v_receipt from public.gmail_card_notifications
   where email=p_email and message_id=p_message_id for update;
 if found then
   if v_receipt.user_id<>p_user_id or v_receipt.couple_id<>v_couple then raise exception 'notification_owner_changed'; end if;
   -- purchase+NULL expense_id is a tombstone, never an invitation to reinsert.
   if v_receipt.kind<>'review' or v_receipt.expense_id is not null
     or not public.gmail_parse_failure(v_receipt.reason)
     or v_receipt.parser_version>=v_version then return v_receipt.expense_id; end if;
 end if;
 if v_kind='purchase' then
   if v_amount is null or v_amount<=0 or v_amount<>trunc(v_amount) or v_amount>=10000000000
     or v_used_at is null or nullif(btrim(p_notification->>'merchant'),'') is null then
     raise exception 'incomplete_purchase_notification';
   end if;
   if v_viewcard_flash and exists (
     select 1 from public.gmail_card_notifications n
     left join public.expenses e on e.id=n.expense_id
     where n.email=p_email and n.user_id=p_user_id and n.couple_id=v_couple
       and n.provider='viewcard' and n.kind='purchase'
       and n.merchant is distinct from 'ビューカード速報（加盟店未確定）'
       and (n.used_at at time zone 'Asia/Tokyo')::date=v_day
       and (e.import_meta->>'card' is null
         or normalize(e.import_meta->>'card',NFKC)=p_notification->>'card')
       and (n.amount=v_amount or e.import_meta->>'stage' is distinct from 'authorization')
   ) then
     -- A final accepted earlier can cover this authorization. The final has
     -- no timestamp, so review the overlap before counting another expense.
     v_manual_candidates:=1;
     v_kind:='review';
     v_reason:='先に届いたビューカード確報との重複を確認してください';
   elsif p_notification->>'provider'='viewcard' and not v_viewcard_flash then
     -- Authorizations already counted as expenses. A final has no
     -- transaction time and may have a different amount, so ambiguous cases
     -- stay in review instead of creating a second counted expense.
     select count(*), count(*) filter (where n.amount=v_amount), count(*) filter (
       where n.amount=v_amount and e.id is not null
         and normalize(coalesce(e.import_meta->>'card',''), NFKC)=p_notification->>'card'
         and not exists (
           select 1 from public.gmail_card_notifications final
           where final.email=p_email and final.provider='viewcard'
             and final.kind='purchase' and final.expense_id=e.id
             and final.message_id<>n.message_id
         )
     ), (array_agg(e.id) filter (where n.amount=v_amount))[1]
     into v_manual_candidates,v_same_amount,v_exact,v_expense
     from public.gmail_card_notifications n
     left join public.expenses e on e.id=n.expense_id
       and e.couple_id=v_couple and e.paid_by=p_user_id
     where n.email=p_email and n.user_id=p_user_id and n.couple_id=v_couple
       and n.provider='viewcard'
       and (n.merchant='ビューカード速報（加盟店未確定）'
         or e.import_meta->>'stage'='authorization' and n.kind='review'
         or n.reason like '速報版（加盟店未特定・未確定）%')
       and (n.used_at at time zone 'Asia/Tokyo')::date=v_day
       and (e.id is null or normalize(coalesce(e.import_meta->>'card',''), NFKC)=p_notification->>'card');
     if v_manual_candidates>0 and not(v_same_amount=1 and v_exact=1) then
       v_expense:=null;
       v_kind:='review';
       v_reason:='ビューカードの登録済み速報と一意に照合できません。日付・金額・利用先を確認してください';
     elsif v_exact=1 then
       update public.expenses
       set description=case when description='ビューカード速報（加盟店未確定）'
             then p_notification->>'merchant' else description end,
           import_meta=coalesce(import_meta,'{}'::jsonb)||jsonb_build_object(
         'viewcard_final_message_id',p_message_id,
         'viewcard_final_merchant',p_notification->>'merchant'
       )
       where id=v_expense;
     end if;
   end if;
   if v_manual_candidates=0 then
     select count(*),count(*) filter(where e.external_provider='moneyforward' and e.expense_date=v_day
       and public.card_merchant_key(e.description)=public.card_merchant_key(p_notification->>'merchant')
       and case p_notification->>'provider'
         when 'jcb' then coalesce(e.import_meta->>'保有金融機関','') ilike '%JCB%'
         when 'smbc' then coalesce(e.import_meta->>'保有金融機関','') like '%三井住友%'
         when 'rakuten' then coalesce(e.import_meta->>'保有金融機関','') like '%楽天%'
         when 'viewcard' then coalesce(e.import_meta->>'保有金融機関','') ~* '(ビューカード|ビックカメラ.*Suica|VIEW.?CARD|JRE CARD)'
         else false end
       and not exists(select 1 from public.gmail_card_notifications n where n.expense_id=e.id)),
       (array_agg(e.id))[1]
     into v_count,v_exact,v_expense from public.expenses e
     where e.couple_id=v_couple and e.paid_by=p_user_id and e.record_kind='transaction'
       and e.external_provider is distinct from 'gmail' and e.amount=v_amount
       and e.expense_date between v_day-1 and v_day+1;
     if v_count>0 and not(v_count=1 and v_exact=1) then
       v_expense:=null; v_kind:='review';
       v_reason:='既存明細との重複の可能性があります。日付・金額・利用先を確認してください';
     end if;
     if v_count=0 then
       insert into public.expenses(couple_id,paid_by,amount,currency,category_id,description,expense_date,expense_type,payment_method,is_fixed,source,is_settlement_target,record_kind,counts_toward_totals,external_provider,external_id,import_meta,notes)
       values(v_couple,p_user_id,v_amount,'JPY',null,p_notification->>'merchant',v_day,'personal','card',false,'auto',false,'transaction',true,'gmail',p_email||':'||p_message_id,
         jsonb_build_object('status','provisional','provider',p_notification->>'provider','card',p_notification->>'card','used_at',v_used_at,'gmail_message_id',p_message_id,'date_precision',coalesce(p_notification->>'datePrecision','minute'))
           || case when v_viewcard_flash then '{"stage":"authorization"}'::jsonb else '{}'::jsonb end,
         'カード利用通知から自動登録（未確定・明細照合前）') returning id into v_expense;
     end if;
   end if;
 end if;
 insert into public.gmail_card_notifications(email,message_id,user_id,couple_id,provider,amount,merchant,used_at,kind,reason,expense_id,parser_version)
 values(p_email,p_message_id,p_user_id,v_couple,p_notification->>'provider',v_amount,p_notification->>'merchant',v_used_at,v_kind,v_reason,v_expense,v_version)
 on conflict(email,message_id) do update set provider=excluded.provider,amount=excluded.amount,
   merchant=excluded.merchant,used_at=excluded.used_at,kind=excluded.kind,reason=excluded.reason,
   expense_id=excluded.expense_id,parser_version=excluded.parser_version;
 return v_expense;
end $$;
revoke all on function public.ingest_gmail_card_notification(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.ingest_gmail_card_notification(uuid,text,text,jsonb) to service_role;
