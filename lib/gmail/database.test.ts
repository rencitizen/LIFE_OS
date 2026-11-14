import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const db = new PGlite()
const user = '10000000-0000-4000-8000-000000000001'
const couple = '20000000-0000-4000-8000-000000000001'
const purchase = {
  provider: 'jcb',
  kind: 'purchase',
  amount: 626,
  merchant: 'テスト店舗',
  usedAt: '2026-10-14T17:25:00+09:00',
  card: 'JCB',
}
const ingest = (id: string, payload = purchase) =>
  db.query<{ ingest_gmail_card_notification: string | null }>(
    'select public.ingest_gmail_card_notification($1,$2,$3,$4::jsonb)',
    [user, 'test@example.com', id, JSON.stringify(payload)]
  )

beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table couples(id uuid primary key);
    create table users(id uuid primary key, couple_id uuid references couples(id));
    create table expenses(id uuid primary key default gen_random_uuid(), couple_id uuid,paid_by uuid,amount numeric,currency text,category_id uuid,description text,expense_date date,expense_type text,payment_method text,is_fixed boolean,source text,is_settlement_target boolean,record_kind text,counts_toward_totals boolean,external_provider text,external_id text,import_meta jsonb,notes text);
    grant usage on schema public to service_role,authenticated,anon;
    grant all on expenses to service_role; grant select on users to service_role;
    insert into couples values('${couple}'); insert into users values('${user}','${couple}');
  `)
  await db.exec(
    readFileSync(
      new URL(
        '../../supabase/migrations/20261016064308_gmail_card_notifications.sql',
        import.meta.url
      ),
      'utf8'
    )
  )
  await db.exec(
    readFileSync(
      new URL(
        '../../supabase/migrations/20261019112424_rakuten_card_notifications.sql',
        import.meta.url
      ),
      'utf8'
    )
  )
  await db.query(
    'insert into gmail_connections(user_id,couple_id,email,refresh_token_encrypted) values($1,$2,$3,$4)',
    [user, couple, 'test@example.com', 'encrypted-test-token']
  )
}, 20_000)
afterAll(() => db.close())

describe('Gmail notification persistence', () => {
  it('atomically creates one provisional expense and deduplicates retries', async () => {
    const first = await ingest('purchase-one')
    const retry = await ingest('purchase-one')
    expect(retry.rows[0].ingest_gmail_card_notification).toBe(
      first.rows[0].ingest_gmail_card_notification
    )
    const rows = await db.query<{
      amount: string
      expense_date: string
      import_meta: { status: string }
    }>('select amount,expense_date::text,import_meta from expenses')
    expect(rows.rows).toHaveLength(1)
    expect(rows.rows[0]).toMatchObject({
      expense_date: '2026-10-14',
      import_meta: { status: 'provisional' },
    })
  })
  it('keeps two distinct notifications even when amount/date/merchant match', async () => {
    const first = await ingest('same-amount-a')
    const second = await ingest('same-amount-b')
    expect(first.rows[0].ingest_gmail_card_notification).not.toBe(
      second.rows[0].ingest_gmail_card_notification
    )
  })
  it('keeps investment and review notifications out of expense totals', async () => {
    expect(
      (await ingest('investment', { ...purchase, kind: 'investment' })).rows[0]
        .ingest_gmail_card_notification
    ).toBeNull()
    expect(
      (await ingest('review', { ...purchase, kind: 'review' })).rows[0]
        .ingest_gmail_card_notification
    ).toBeNull()
  })
  it('rolls back the notification receipt when inserting an expense fails', async () => {
    await expect(
      ingest('invalid-purchase', { ...purchase, amount: 0 })
    ).rejects.toThrow('incomplete_purchase_notification')
    expect(
      (
        await db.query(
          "select * from gmail_card_notifications where message_id='invalid-purchase'"
        )
      ).rows
    ).toHaveLength(0)
    expect(
      (await ingest('invalid-purchase')).rows[0].ingest_gmail_card_notification
    ).toBeTruthy()
  })
  it('prevents ordinary signed-in users from reading tokens or invoking the ingestion function', async () => {
    await db.exec('set role authenticated')
    try {
      await expect(db.query('select * from gmail_connections')).rejects.toThrow(
        'permission denied'
      )
      await expect(ingest('unauthorized')).rejects.toThrow('permission denied')
    } finally {
      await db.exec('reset role')
    }
  })
  it('supports service-role ingestion while rejecting disabled connections and changed memberships', async () => {
    await db.exec('set role service_role')
    try {
      expect(
        (await ingest('service-role-purchase')).rows[0]
          .ingest_gmail_card_notification
      ).toBeTruthy()
    } finally {
      await db.exec('reset role')
    }
    await db.exec('update gmail_connections set enabled=false')
    await expect(ingest('disabled')).rejects.toThrow(
      'gmail_connection_not_found'
    )
    await db.exec(
      'update gmail_connections set enabled=true; update users set couple_id=null'
    )
    await expect(ingest('membership-changed')).rejects.toThrow(
      'gmail_owner_membership_changed'
    )
  })
})

describe('Rakuten multi-transaction ingestion', () => {
  const batch = (id: string, rows: unknown[]) =>
    db.query(
      'select public.ingest_gmail_card_notifications($1,$2,$3,$4::jsonb)',
      [user, 'test@example.com', id, JSON.stringify(rows)]
    )
  const rakuten = {
    ...purchase,
    provider: 'rakuten',
    usedAt: '2026-10-18T00:00:00+09:00',
    card: '楽天カード',
    datePrecision: 'day',
  }
  beforeAll(async () => {
    await db.query('update users set couple_id=$1 where id=$2', [couple, user])
  })
  it('stores every row exactly once, including equal-price purchases', async () => {
    await batch('rakuten_multi', [rakuten, rakuten])
    await batch('rakuten_multi', [rakuten, rakuten])
    const rows = await db.query<{
      import_meta: { gmail_message_id: string; date_precision: string }
    }>(
      "select import_meta from expenses where external_id like '%:rakuten_multi%'"
    )
    expect(rows.rows).toHaveLength(2)
    expect(
      rows.rows.every(
        (r) =>
          r.import_meta.gmail_message_id === 'rakuten_multi' &&
          r.import_meta.date_precision === 'day'
      )
    ).toBe(true)
  })
  it('does not count the flash notice again when the normal email arrives', async () => {
    await batch('rakuten_flash', [
      { ...rakuten, merchant: null, kind: 'review' },
    ])
    await batch('rakuten_normal', [rakuten])
    const rows = await db.query(
      "select * from expenses where external_id like '%:rakuten_flash%' or external_id like '%:rakuten_normal%'"
    )
    expect(rows.rows).toHaveLength(1)
  })
  it('rolls back all rows when one purchase fails, then permits a clean retry', async () => {
    await expect(
      batch('rakuten_atomic', [rakuten, { ...rakuten, amount: 0 }])
    ).rejects.toThrow('incomplete_purchase_notification')
    expect(
      (
        await db.query(
          "select * from gmail_card_notifications where message_id like 'rakuten_atomic%'"
        )
      ).rows
    ).toHaveLength(0)
    await batch('rakuten_atomic', [rakuten, rakuten])
    expect(
      (
        await db.query(
          "select * from gmail_card_notifications where message_id like 'rakuten_atomic%'"
        )
      ).rows
    ).toHaveLength(2)
  })
  it('accepts service ingestion but denies client access to the batch function', async () => {
    await db.exec('set role service_role')
    try {
      await batch('rakuten_service', [rakuten])
    } finally {
      await db.exec('reset role')
    }
    await db.exec('set role authenticated')
    try {
      await expect(batch('rakuten_client', [rakuten])).rejects.toThrow(
        'permission denied'
      )
    } finally {
      await db.exec('reset role')
    }
  })
  it('rejects malformed or oversized batches and ambiguous synthetic IDs', async () => {
    await expect(batch('rakuten_empty', [])).rejects.toThrow(
      'invalid_notification_batch'
    )
    await expect(
      batch('rakuten_large', Array(101).fill(rakuten))
    ).rejects.toThrow('invalid_notification_batch')
    await expect(batch('rakuten#2', [rakuten])).rejects.toThrow(
      'invalid_message_id'
    )
  })
})
