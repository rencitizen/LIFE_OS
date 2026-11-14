import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const db = new PGlite()
const user = '10000000-0000-4000-8000-000000000001'
const couple = '20000000-0000-4000-8000-000000000001'
const purchase = { provider: 'jcb', kind: 'purchase', amount: 5500, merchant: 'FIT PLACE', usedAt: '2026-10-18T00:00:00+09:00', datePrecision: 'day', card: 'JCB', parserVersion: 2 }
const batch = (id: string, rows: unknown[]) => db.query<Record<string, unknown>>('select ingest_gmail_card_notifications($1,$2,$3,$4::jsonb)', [user, 'test@example.com', id, JSON.stringify(rows)])
const mf = (id: string, amount = 5500, description = 'ＦＩＴ　ＰＬＡＣＥ', date = '2026-10-18', raw = {}) => db.query<{expense_id:string,result_status:string}>('select * from upsert_moneyforward_expense($1,$1,$2,$3::date,$4,$5,$6,null,false,$7,$8::jsonb)', [user, amount, date, 'その他', description, id, 'card', JSON.stringify({ '保有金融機関': 'JCBカード', ...raw })])
const count = async () => Number((await db.query<{n:number}>('select count(*)::int n from expenses')).rows[0].n)
beforeAll(async () => {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create table couples(id uuid primary key); create table users(id uuid primary key,couple_id uuid);
 create table expenses(id uuid primary key default gen_random_uuid(),couple_id uuid,paid_by uuid,amount numeric,currency text,category_id uuid,description text,expense_date date,expense_type text,payment_method text,is_fixed boolean,source text,is_settlement_target boolean,record_kind text,counts_toward_totals boolean,external_provider text,external_id text,import_meta jsonb,notes text,created_at timestamptz default now());
 grant usage on schema public to service_role,authenticated,anon; grant all on expenses to service_role; grant select on users to service_role;
 insert into couples values('${couple}'); insert into users values('${user}','${couple}');
 create function resolve_expense_category_id(uuid,text,text) returns uuid language sql as 'select null::uuid';
 create function archive_moneyforward_snapshots_for_month(uuid,date) returns void language sql as 'select';`)
 for (const file of ['20261016064308_gmail_card_notifications.sql','20261019112424_rakuten_card_notifications.sql','20261026004651_gmail_import_recovery.sql','20261114111755_viewcard_gmail_notifications.sql'])
  await db.exec(readFileSync(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'))
 await db.query<Record<string, unknown>>('insert into gmail_connections(user_id,couple_id,email,refresh_token_encrypted) values($1,$2,$3,$4)',[user,couple,'test@example.com','test'])
}, 20000)
afterAll(() => db.close())

describe('safe card notification recovery', () => {
 const viewFinal = { ...purchase, provider: 'viewcard', card: 'ビックカメラSuicaカード', usedAt: '2026-11-14T00:00:00+09:00' }
 it('counts a flash immediately and reuses its expense when the final arrives', async () => {
  const before = await count()
  const final = { ...viewFinal, usedAt: '2026-11-15T00:00:00+09:00' }
  const flash = { ...final, stage: 'authorization', usedAt: '2026-11-15T17:34:46+09:00', merchant: 'ビューカード速報（加盟店未確定）' }
  await batch('view-flash-a', [flash])
  await batch('view-flash-a', [flash])
  expect(await count()).toBe(before + 1)
  await batch('view-final-a', [final])
  expect(await count()).toBe(before + 1)
  expect((await db.query("select description from expenses where external_id='test@example.com:view-flash-a'")).rows[0]).toMatchObject({description:'FIT PLACE'})

  const reverseFinal = { ...final, usedAt: '2026-11-16T00:00:00+09:00' }
  await batch('view-final-b', [reverseFinal])
  await batch('view-flash-b', [{...flash, usedAt:'2026-11-16T17:34:46+09:00'}])
  expect(await count()).toBe(before + 2)
  expect((await db.query("select kind from gmail_card_notifications where message_id='view-flash-b'")).rows[0]).toMatchObject({kind:'review'})
 })
 it('preserves separate same-price flash messages and holds an ambiguous final', async () => {
  const before = await count()
  const final = {...viewFinal, usedAt:'2026-11-17T00:00:00+09:00', amount:10000}
  const flash = {...final, stage:'authorization', merchant:'ビューカード速報（加盟店未確定）'}
  await batch('view-same-price-1', [{...flash, usedAt:'2026-11-17T17:27:10+09:00'}])
  await batch('view-same-price-2', [{...flash, usedAt:'2026-11-17T17:34:46+09:00'}])
  await batch('view-ambiguous-final', [final])
  expect(await count()).toBe(before + 2)
  expect((await db.query("select kind from gmail_card_notifications where message_id='view-ambiguous-final'")).rows[0]).toMatchObject({kind:'review'})
 })
 it('reuses a manually posted flash, preserves user edits and holds ambiguous finals', async () => {
  const ids = []
  for (const amount of [1423, 3300]) {
   const existing = (await db.query<{id:string}>(`insert into expenses(couple_id,paid_by,amount,description,expense_date,external_provider,import_meta)
     values($1,$2,$3,'ユーザー編集','2026-11-14','gmail','{"provider":"viewcard","card":"ビックカメラSuicaカード","stage":"authorization"}') returning id`, [couple,user,amount])).rows[0].id
   ids.push(existing)
   await db.query(`insert into gmail_card_notifications(email,message_id,user_id,couple_id,provider,amount,used_at,kind,reason,expense_id)
     values('test@example.com',$1,$2,$3,'viewcard',$4,'2026-11-14T11:49:54+09:00','review','速報版（加盟店未特定・未確定）。確報待ち',$5)`, [`legacy-view-${amount}`,user,couple,amount,existing])
  }
  const before = await count()
  await batch('legacy-view-1423', [{...viewFinal,amount:1423,stage:'authorization',merchant:'ビューカード速報（加盟店未確定）'}])
  await batch('view-linked', [{...viewFinal,amount:1423}])
  await batch('view-linked', [{...viewFinal,amount:1423}])
  await batch('view-claimed', [{...viewFinal,amount:1423}])
  await batch('view-adjusted', [{...viewFinal,amount:3200}])
  expect(await count()).toBe(before)
  expect((await db.query("select expense_id,kind from gmail_card_notifications where message_id='view-linked'")).rows[0]).toMatchObject({expense_id:ids[0],kind:'purchase'})
  expect((await db.query("select kind from gmail_card_notifications where message_id in ('view-adjusted','view-claimed')")).rows).toEqual([{kind:'review'},{kind:'review'}])
  expect((await db.query('select description,import_meta from expenses where id=$1',[ids[0]])).rows[0]).toMatchObject({description:'ユーザー編集',import_meta:{viewcard_final_merchant:'FIT PLACE'}})
  await db.query('delete from expenses where id=$1',[ids[1]])
  await batch('view-deleted-legacy', [{...viewFinal,amount:3300}])
  expect(await count()).toBe(before - 1)
 })
 it('links MF-first exact matches without changing confirmed metadata or creating an expense', async () => {
  const existing = (await mf('mf-first')).rows[0].expense_id
  const before = await count()
  await batch('mail-mf-first',[purchase])
  expect(await count()).toBe(before)
  expect((await db.query<Record<string, unknown>>('select expense_id from gmail_card_notifications where message_id=$1',['mail-mf-first'])).rows[0].expense_id).toBe(existing)
  expect((await db.query<{import_meta:Record<string,unknown>}>('select import_meta from expenses where id=$1',[existing])).rows[0].import_meta).not.toHaveProperty('gmail_message_id')
 })
 it('recovers every row of a legacy parse failure exactly once', async () => {
  await batch('legacy-multi',[{...purchase,amount:null,merchant:null,usedAt:null,kind:'review',reason:'利用日時・金額・利用先の確認が必要です',parserVersion:0}])
  const before = await count()
  await batch('legacy-multi',[{...purchase,amount:3278,usedAt:'2026-10-19T00:00:00+09:00'},{...purchase,amount:799,usedAt:'2026-10-20T00:00:00+09:00'}])
  await batch('legacy-multi',[{...purchase,amount:3278},{...purchase,amount:799},purchase])
  expect(await count()).toBe(before+2)
  expect((await db.query<Record<string, unknown>>("select * from gmail_card_notifications where message_id like 'legacy-multi%'")).rows).toHaveLength(2)
 })
 it('does not recreate a deleted purchase or add rows when a retry changes the batch shape', async () => {
  await batch('deleted',[{...purchase,amount:801}])
  await db.exec("delete from expenses where external_id='test@example.com:deleted'")
  const before = await count()
  await batch('deleted',[{...purchase,amount:801},purchase])
  expect(await count()).toBe(before)
  expect((await db.query<Record<string, unknown>>("select expense_id from gmail_card_notifications where message_id='deleted'")).rows[0].expense_id).toBeNull()
 })
 it('leaves flash and cancellation receipts in review even after a parser version upgrade', async () => {
  for (const [id,reason] of [['flash','速報版です。利用先を含む通常版の到着後に支出へ反映します'],['cancel','取消・返金の照合が必要です']]) {
   await batch(id,[{...purchase,kind:'review',reason,parserVersion:0}]); await batch(id,[purchase])
   expect((await db.query<Record<string, unknown>>('select kind from gmail_card_notifications where message_id=$1',[id])).rows[0].kind).toBe('review')
  }
 })
 it('keeps equal-price distinct Gmail purchases separate', async () => {
  const before = await count()
  await batch('equal-price',[{...purchase,amount:802},{...purchase,amount:802}])
  expect(await count()).toBe(before+2)
 })
 it('holds MF ambiguity, renamed merchants, card mismatch and date shifts without extra expenses', async () => {
  await mf('ambiguous-1',803); await mf('ambiguous-2',803)
  await mf('renamed',804,'別の店舗'); await mf('card-mismatch',805,'FIT PLACE','2026-10-18',{'保有金融機関':'楽天カード'})
  await mf('date-shift',806,'FIT PLACE','2026-10-19')
  const before = await count()
  for(const amount of [803,804,805,806]) {
   await batch(`ambiguous-${amount}`,[{...purchase,amount}])
   expect((await db.query<Record<string, unknown>>('select kind from gmail_card_notifications where message_id=$1',[`ambiguous-${amount}`])).rows[0].kind).toBe('review')
  }
  expect(await count()).toBe(before)
 })
 it('links Gmail-first imports while preserving user edits and receipt identity', async () => {
  await batch('gmail-first',[{...purchase,amount:807}])
  const before = await count()
  await db.exec("update expenses set is_settlement_target=true,expense_type='shared' where external_id='test@example.com:gmail-first'")
  const result = (await mf('confirmed-gmail',807)).rows[0]
  expect(result.result_status).toBe('linked_existing')
  expect(await count()).toBe(before)
  expect((await db.query<Record<string, unknown>>('select is_settlement_target,external_provider from expenses where id=$1',[result.expense_id])).rows[0]).toMatchObject({is_settlement_target:true,external_provider:'moneyforward'})
  expect((await db.query<Record<string, unknown>>("select expense_id from gmail_card_notifications where message_id='gmail-first'")).rows[0].expense_id).toBe(result.expense_id)
  await mf('confirmed-gmail',807); expect(await count()).toBe(before)
 })
 it('rejects ambiguous Gmail-first MF matching instead of duplicating', async () => {
  await batch('gmail-ambiguous',[{...purchase,amount:808},{...purchase,amount:808}])
  const before = await count()
  await expect(mf('ambiguous-mf',808)).rejects.toThrow('gmail_duplicate_candidate_needs_review')
  expect(await count()).toBe(before)
 })
 it('rolls back all row upgrades when a later row fails validation', async () => {
  await batch('retry-atomic',[{...purchase,kind:'review',reason:'利用日時・金額・利用先の確認が必要です',parserVersion:0}])
  const before=await count()
  await expect(batch('retry-atomic',[{...purchase,amount:809},{...purchase,amount:0}])).rejects.toThrow('incomplete_purchase_notification')
  expect(await count()).toBe(before)
  expect((await db.query<Record<string, unknown>>("select kind,parser_version from gmail_card_notifications where message_id='retry-atomic'")).rows[0]).toMatchObject({kind:'review',parser_version:0})
 })
 it('denies ordinary users and supports the backend role', async () => {
  await db.exec('set role authenticated')
  try { await expect(batch('denied',[purchase])).rejects.toThrow('permission denied') } finally { await db.exec('reset role') }
  await db.exec('set role service_role')
  try { await batch('allowed',[{...purchase,amount:810}]) } finally { await db.exec('reset role') }
 })
})
