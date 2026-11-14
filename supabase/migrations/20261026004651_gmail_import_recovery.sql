alter table public.gmail_card_notifications
  add column parser_version integer not null default 0;

create function public.gmail_parse_failure(p_reason text) returns boolean
language sql immutable security invoker set search_path=public as $$
  select coalesce(p_reason in (
    '文字コードを解釈できません',
    '利用日時・金額・利用先の確認が必要です',
    '利用日・金額・利用先の確認が必要です',
    '楽天カードの通知形式を確認してください（自動計上なし）',
    '一部の明細を読み取れません。メール全体の確認が必要です（自動計上なし）',
    '売上到着分のメール全体の確認が必要です（自動計上なし）'
  ),false)
$$;
revoke all on function public.gmail_parse_failure(text) from public,anon,authenticated;
grant execute on function public.gmail_parse_failure(text) to service_role;

create function public.card_merchant_key(p_value text) returns text
language sql immutable security invoker set search_path=public as $$
  select lower(regexp_replace(normalize(coalesce(p_value,''),NFKC),'[[:space:]]+','','g'))
$$;
revoke all on function public.card_merchant_key(text) from public,anon,authenticated;
grant execute on function public.card_merchant_key(text) to service_role;

create or replace function public.ingest_gmail_card_notification(
  p_user_id uuid,p_email text,p_message_id text,p_notification jsonb
) returns uuid language plpgsql security invoker set search_path=public as $$
declare
 v_connection public.gmail_connections%rowtype;
 v_receipt public.gmail_card_notifications%rowtype;
 v_couple uuid; v_expense uuid; v_count integer; v_exact integer;
 v_amount numeric := nullif(p_notification->>'amount','')::numeric;
 v_used_at timestamptz := nullif(p_notification->>'usedAt','')::timestamptz;
 v_day date := (v_used_at at time zone 'Asia/Tokyo')::date;
 v_version integer := coalesce((p_notification->>'parserVersion')::integer,0);
 v_kind text := p_notification->>'kind';
 v_reason text := p_notification->>'reason';
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
   select count(*),count(*) filter(where e.external_provider='moneyforward' and e.expense_date=v_day
     and public.card_merchant_key(e.description)=public.card_merchant_key(p_notification->>'merchant')
     and case p_notification->>'provider'
       when 'jcb' then coalesce(e.import_meta->>'保有金融機関','') ilike '%JCB%'
       when 'smbc' then coalesce(e.import_meta->>'保有金融機関','') like '%三井住友%'
       when 'rakuten' then coalesce(e.import_meta->>'保有金融機関','') like '%楽天%'
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
       jsonb_build_object('status','provisional','provider',p_notification->>'provider','card',p_notification->>'card','used_at',v_used_at,'gmail_message_id',p_message_id,'date_precision',coalesce(p_notification->>'datePrecision','minute')),
       'カード利用通知から自動登録（未確定・明細照合前）') returning id into v_expense;
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

create or replace function public.ingest_gmail_card_notifications(
 p_user_id uuid,p_email text,p_message_id text,p_notifications jsonb
) returns integer language plpgsql security invoker set search_path=public as $$
declare
 v_item jsonb; v_index integer:=0; v_row_id text; v_expense uuid;
 v_root public.gmail_card_notifications%rowtype;
 v_version integer;
begin
 if jsonb_typeof(p_notifications) is distinct from 'array' then raise exception 'invalid_notification_batch'; end if;
 if jsonb_array_length(p_notifications)<1 or jsonb_array_length(p_notifications)>100 then raise exception 'invalid_notification_batch'; end if;
 if p_message_id is null or p_message_id !~ '^[A-Za-z0-9_-]{1,100}$' then raise exception 'invalid_message_id'; end if;
 lock table public.expenses in share row exclusive mode;
 perform 1 from public.gmail_connections c join public.users u on u.id=c.user_id and u.couple_id=c.couple_id
   where c.user_id=p_user_id and c.email=p_email and c.enabled for update of c;
 if not found then raise exception 'gmail_connection_not_found'; end if;
 select * into v_root from public.gmail_card_notifications where email=p_email and message_id=p_message_id for update;
 v_version:=coalesce((p_notifications->0->>'parserVersion')::integer,0);
 if found then
   if v_root.user_id<>p_user_id then raise exception 'notification_owner_changed'; end if;
   -- Preserve the original batch shape on every retry, including deleted rows.
   if v_root.kind<>'review' or v_root.expense_id is not null or not public.gmail_parse_failure(v_root.reason)
     or v_root.parser_version>=v_version then return 0; end if;
 end if;
 for v_item in select value from jsonb_array_elements(p_notifications) loop
   v_index:=v_index+1;
   v_row_id:=case when v_index=1 then p_message_id else p_message_id||'#'||v_index::text end;
   v_expense:=public.ingest_gmail_card_notification(p_user_id,p_email,v_row_id,v_item);
   if v_expense is not null then
     -- A confirmed Money Forward expense keeps its metadata and user edits.
     update public.expenses set import_meta=coalesce(import_meta,'{}'::jsonb)||jsonb_build_object(
       'gmail_message_id',p_message_id,'gmail_transaction_index',v_index,
       'date_precision',coalesce(v_item->>'datePrecision','minute'))
     where id=v_expense and external_provider='gmail' and external_id=p_email||':'||v_row_id;
   end if;
 end loop;
 return v_index;
end $$;
revoke all on function public.ingest_gmail_card_notifications(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.ingest_gmail_card_notifications(uuid,text,text,jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.upsert_moneyforward_expense(p_user_id uuid, p_paid_by uuid, p_amount numeric, p_expense_date date, p_category_name text, p_description text, p_external_id text DEFAULT NULL::text, p_parent_category_name text DEFAULT NULL::text, p_is_settlement_target boolean DEFAULT false, p_payment_method text DEFAULT NULL::text, p_raw_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(expense_id uuid, result_status text, matched_by text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_couple uuid;
  v_category uuid;
  v_existing uuid;
  v_n integer;
  v_batch_same_key_count integer := 1;
  v_existing_desc text;
  v_gmail_count integer;
  v_gmail_exact integer;
  v_category_name text := p_category_name;
  v_parent_category_name text := p_parent_category_name;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'amount_must_be_positive'; end if;
  select couple_id into v_couple from public.users where id=p_user_id;
  if v_couple is null then raise exception 'user_not_found_or_not_in_couple'; end if;
  if not exists(select 1 from public.users where id=p_paid_by and couple_id=v_couple) then raise exception 'payer_not_in_user_couple'; end if;

  -- Food taxonomy rule: supermarket/grocery merchants belong to 食費 > 食材費.
  -- Category is independent from settlement status; personal lunch can still be 外食費 with settlement_target=false.
  if btrim(coalesce(v_category_name,'')) = '食費'
     and coalesce(p_description,'') ~* '(西友|オオゼキ|オーゼキ|東急ストア|肉のハナマサ|まいばすけっと|TAIRAYA|三和 |イオンネクスト|greenbeans|Tokyu Food|スーパー)' then
    v_category_name := '食材費';
    v_parent_category_name := '食費';
  end if;

  lock table public.expenses in share row exclusive mode;

  v_category:=public.resolve_expense_category_id(v_couple,v_category_name,v_parent_category_name);
  v_batch_same_key_count := greatest(coalesce(nullif(p_raw_payload->>'_lifeos_batch_same_key_count','')::integer,1),1);

  perform public.archive_moneyforward_snapshots_for_month(v_couple,p_expense_date);

  if nullif(btrim(p_external_id),'') is not null then
    select id into v_existing
    from public.expenses
    where couple_id=v_couple
      and external_provider='moneyforward'
      and external_id=btrim(p_external_id)
    limit 1;

    if v_existing is not null then
      update public.expenses
      set import_meta=coalesce(import_meta,'{}'::jsonb)
          || coalesce(p_raw_payload,'{}'::jsonb)
          || jsonb_build_object(
              'canonical_transaction_source','moneyforward',
              'last_dedup_rule','external_id'
            )
      where id=v_existing;
      return query select v_existing,'unchanged'::text,'external_id'::text;
      return;
    end if;
  end if;

  -- Match Gmail-first imports before the legacy manual-row matching path.
  select count(*),count(*) filter(where e.expense_date=p_expense_date
    and public.card_merchant_key(e.description)=public.card_merchant_key(p_description)
    and case e.import_meta->>'provider'
      when 'jcb' then coalesce(p_raw_payload->>'保有金融機関','') ilike '%JCB%'
      when 'smbc' then coalesce(p_raw_payload->>'保有金融機関','') like '%三井住友%'
      when 'rakuten' then coalesce(p_raw_payload->>'保有金融機関','') like '%楽天%'
      else false end), (array_agg(e.id))[1]
  into v_gmail_count,v_gmail_exact,v_existing from public.expenses e
  where e.couple_id=v_couple and e.paid_by=p_paid_by and e.record_kind='transaction'
    and e.external_provider='gmail' and e.amount=p_amount
    and e.expense_date between p_expense_date-1 and p_expense_date+1;
  if v_gmail_count>0 then
    if v_gmail_count<>1 or v_gmail_exact<>1 or v_batch_same_key_count>1 then
      raise exception 'gmail_duplicate_candidate_needs_review';
    end if;
    update public.expenses set external_provider='moneyforward',external_id=nullif(btrim(p_external_id),''),
      import_meta=coalesce(import_meta,'{}'::jsonb)||coalesce(p_raw_payload,'{}'::jsonb)||jsonb_build_object(
        'canonical_transaction_source','moneyforward','status','confirmed',
        'last_dedup_rule','gmail_exact_payer_amount_date_merchant_card','user_semantics_preserved',true)
    where id=v_existing;
    return query select v_existing,'linked_existing'::text,'gmail_exact_payer_amount_date_merchant_card'::text;
    return;
  end if;

  select count(*), (array_agg(e.id order by e.created_at))[1]
    into v_n,v_existing
  from public.expenses e
  where e.couple_id=v_couple
    and e.record_kind='transaction'
    and e.paid_by=p_paid_by
    and e.amount=p_amount
    and e.expense_date=p_expense_date
    and (
      e.external_provider is null
      or (e.external_provider='moneyforward' and e.external_id is null)
    );

  if v_n > 1 then
    raise exception 'ambiguous_same_day_duplicate_candidate';
  end if;

  if v_n = 1 then
    if v_batch_same_key_count > 1 then
      raise exception 'same_day_amount_collision_needs_review';
    end if;

    select description into v_existing_desc from public.expenses where id=v_existing;

    update public.expenses
    set external_provider='moneyforward',
        external_id=nullif(btrim(p_external_id),''),
        payment_method=coalesce(payment_method,p_payment_method),
        import_meta=coalesce(import_meta,'{}'::jsonb)
          || coalesce(p_raw_payload,'{}'::jsonb)
          || jsonb_build_object(
              'canonical_transaction_source','moneyforward',
              'user_semantics_preserved',true,
              'last_dedup_rule','same_payer_amount_date_unique',
              'moneyforward_description',p_description,
              'moneyforward_expense_date',p_expense_date,
              'moneyforward_category_name',v_category_name,
              'prelink_description',v_existing_desc
            )
    where id=v_existing;

    return query select v_existing,'linked_existing'::text,'same_payer_amount_date_unique'::text;
    return;
  end if;

  select count(*)
    into v_n
  from public.expenses e
  where e.couple_id=v_couple
    and e.record_kind='transaction'
    and e.paid_by=p_paid_by
    and e.amount=p_amount
    and e.expense_date between p_expense_date-1 and p_expense_date+1
    and e.expense_date <> p_expense_date
    and (
      e.external_provider is null
      or (e.external_provider='moneyforward' and e.external_id is null)
    );

  if v_n > 0 then
    raise exception 'possible_duplicate_date_shift_needs_review';
  end if;

  insert into public.expenses(
    couple_id,paid_by,amount,currency,category_id,description,expense_date,
    expense_type,payment_method,is_fixed,source,is_settlement_target,
    record_kind,counts_toward_totals,external_provider,external_id,import_meta
  )
  values(
    v_couple,p_paid_by,p_amount,'JPY',v_category,nullif(btrim(p_description),''),p_expense_date,
    case when p_is_settlement_target then 'shared' else 'personal' end,
    p_payment_method,false,'moneyforward_csv',p_is_settlement_target,
    'transaction',true,'moneyforward',nullif(btrim(p_external_id),''),
    coalesce(p_raw_payload,'{}'::jsonb)
      || jsonb_build_object(
          'canonical_transaction_source','moneyforward',
          'last_dedup_rule','new_transaction',
          'lifeos_category_name',v_category_name,
          'lifeos_parent_category_name',v_parent_category_name
        )
  )
  returning id into v_existing;

  return query select v_existing,'inserted'::text,'none'::text;
end
$function$

;
