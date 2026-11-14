import { describe, expect, it } from 'vitest'
import {
  cardMailQuery,
  decodeBody,
  parseCardNotification,
  parseCardNotifications,
  type GmailMessage,
} from './notifications'

function mail(
  body: string,
  provider: 'jcb' | 'smbc' | 'rakuten' = 'jcb'
): GmailMessage {
  const from =
    provider === 'jcb'
      ? 'mail@qa.jcb.co.jp'
      : provider === 'smbc'
        ? 'statement@vpass.ne.jp'
        : 'info@mail.rakuten-card.co.jp'
  return {
    id: 'message-1',
    internalDate: '1791966349000',
    payload: {
      mimeType: 'text/plain',
      headers: [
        { name: 'From', value: `Card <${from}>` },
        {
          name: 'Subject',
          value:
            provider === 'jcb'
              ? 'JCBカード／ショッピングご利用のお知らせ'
              : provider === 'smbc'
                ? 'ご利用のお知らせ【三井住友カード】'
                : 'カード利用のお知らせ(本人ご利用分)',
        },
        {
          name: 'Authentication-Results',
          value: `mx.google.com; dmarc=pass (p=REJECT) header.from=${from.split('@')[1]};`,
        },
        { name: 'Content-Type', value: 'text/plain; charset=utf-8' },
      ],
      body: { data: Buffer.from(body).toString('base64url') },
    },
  }
}

describe('card notification parsing', () => {
  it('parses SMBC labeled plain text instead of depending on the HTML alternative', () => {
    expect(parseCardNotifications(mail('ご利用カード：三井住友ゴールドＶＩＳＡ（ＮＬ）\n◇利用日：2026/10/25 18:55\n◇利用先：ローソン\n◇利用取引：買物\n◇利用金額：746円', 'smbc'))).toMatchObject([
      { usedAt: '2026-10-25T18:55:00+09:00', merchant: 'ローソン', amount: 746, kind: 'purchase', card: '三井住友ゴールドVISA(NL)' },
    ])
  })
  it('parses every JCB sales-arrival row using day precision', () => {
    const message = mail('カード名称：ＪＡＬ・ＪＣＢカード\n◆ご利用１\n【ご利用日】2026/10/18\n【ご利用金額】5,500円\n【ご利用先】ＦＩＴ　ＰＬＡＣＥ\n◆ご利用２\n【ご利用日】2026/10/19\n【ご利用金額】3,278円\n【ご利用先】ＦＩＴ　ＰＬＡＣＥ')
    message.payload.headers![1].value = '（売上到着分）JCBカード/ショッピングご利用のお知らせ'
    expect(parseCardNotifications(message)).toMatchObject([
      { amount: 5500, usedAt: '2026-10-18T00:00:00+09:00', datePrecision: 'day', kind: 'purchase' },
      { amount: 3278, usedAt: '2026-10-19T00:00:00+09:00', datePrecision: 'day', kind: 'purchase' },
    ])
    expect(parseCardNotification(message)).toMatchObject({ provider: 'jcb', kind: 'review' })
    message.payload.body!.data = Buffer.from('◆ご利用１\n【ご利用日】2026/02/30\n【ご利用金額】1円\n【ご利用先】店舗').toString('base64url')
    expect(parseCardNotifications(message)).toMatchObject([{ kind: 'review' }])
  })
  const purchase =
    'カード名称 ： ＪＡＬ・ＪＣＢカード\n【ご利用日時(日本時間)】 2026/10/14 17:25\n【ご利用金額】 626円\n【ご利用先】 ニクノハナマサ オオモリテン\n利用をキャンセルされた場合も本メールを送る場合があります'
  it('extracts a JCB purchase, ignoring cancellation boilerplate', () => {
    expect(parseCardNotification(mail(purchase))).toMatchObject({
      provider: 'jcb',
      amount: 626,
      usedAt: '2026-10-14T17:25:00+09:00',
      merchant: 'ニクノハナマサ オオモリテン',
      kind: 'purchase',
    })
  })
  it('decodes the original ISO-2022-JP bytes and separates SMBC investment contributions', () => {
    const message = mail('', 'smbc')
    message.payload.headers![3].value = 'text/plain; charset="iso-2022-jp"'
    message.payload.body!.data =
      'GyRCJDRNeE1RRnw7fiEnGyhCMjAyNi8xMC8xNCAwMToyOAobJEIjUyNCI0k-Wjd0RWo_LkBRTiklNSE8JVMlOSFKTWI3bkdjSVVKLCFLIUpHY0oqIUsbKEIKGyRCJDRNeE1RNmIzWyEnGyhCMTAwLDAwMBskQjFfGyhC'
    expect(parseCardNotification(message)).toMatchObject({
      provider: 'smbc',
      amount: 100_000,
      kind: 'investment',
      usedAt: '2026-10-14T01:28:00+09:00',
    })
  })
  it('prefers the plain part instead of importing both MIME alternatives', () => {
    const message = mail(purchase)
    const plain = message.payload
    message.payload = {
      mimeType: 'multipart/alternative',
      headers: plain.headers,
      parts: [
        plain,
        {
          mimeType: 'text/html',
          body: { data: Buffer.from('<p>OTHER</p>').toString('base64url') },
        },
      ],
    }
    expect(decodeBody(message.payload)).toBe(purchase)
  })
  it('rejects an untrusted sender and failed sender authentication', () => {
    const message = mail(purchase)
    message.payload.headers![0].value = 'mail@qa.jcb.co.jp.attacker.test'
    expect(parseCardNotification(message)).toBeNull()
    message.payload.headers![0].value = 'mail@qa.jcb.co.jp'
    message.payload.headers![2].value =
      'mx.google.com; dmarc=fail header.from=qa.jcb.co.jp;'
    expect(parseCardNotification(message)).toBeNull()
  })
  it('does not accept a forged Authentication-Results field from another server', () => {
    const message = mail(purchase)
    message.payload.headers![2].value =
      'attacker.test; dmarc=pass header.from=qa.jcb.co.jp;'
    expect(parseCardNotification(message)).toBeNull()
  })
  it('puts missing transaction dates in review rather than using the email arrival date', () => {
    expect(
      parseCardNotification(mail(purchase.replace('2026/10/14 17:25', '不明')))
    ).toMatchObject({ usedAt: null, kind: 'review' })
  })
  it('puts invalid dates and non-positive amounts in review', () => {
    expect(
      parseCardNotification(mail(purchase.replace('2026/10/14', '2026/02/30')))
        ?.kind
    ).toBe('review')
    expect(
      parseCardNotification(mail(purchase.replace('626円', '0円')))?.kind
    ).toBe('review')
  })
  it('never treats a cancellation as a new purchase', () => {
    const message = mail(purchase)
    message.payload.headers![1].value += '（取消）'
    expect(parseCardNotification(message)?.kind).toBe('review')
  })
  it('excludes V Point Pay and general card promotional mail', () => {
    const message = mail(purchase)
    message.payload.headers![0].value = 'info@prepaid.smbc-card.com'
    expect(parseCardNotification(message)).toBeNull()
    message.payload.headers![0].value = 'mail@qa.jcb.co.jp'
    message.payload.headers![1].value = 'キャンペーンのお知らせ'
    expect(parseCardNotification(message)).toBeNull()
  })
})

describe('View Card notifications', () => {
  const title = 'ビューカードご利用情報のお知らせ（本人会員利用）'
  const labels = 'ご利用カード　：ビックカメラSuicaカード\r\n・ 利用者　：本人会員\r\n'
  function viewCard(body: string, subject = `◆確報版◆${title}`) {
    const message = mail(body)
    message.payload.headers = [
      { name: 'From', value: '株式会社ビューカード <viewcard@mail.viewsnet.jp>' },
      { name: 'Subject', value: subject },
      { name: 'Authentication-Results', value: 'mx.google.com; dkim=pass header.i=@mail.viewsnet.jp; dmarc=pass (p=REJECT) header.from=mail.viewsnet.jp' },
    ]
    return message
  }
  it('recognizes the real flash labels and preserves seconds for a provisional expense', () => {
    const body = labels + '・ 利用日時　：2026/11/14 11:49:54\r\n・ 利用種別　：オンライン\r\n・ 利用金額　：1,423円\r\n・ 利用加盟店　：国内加盟店'
    expect(parseCardNotifications(viewCard(body, `◆速報版◆${title}`))).toMatchObject([
      { provider: 'viewcard', kind: 'purchase', stage: 'authorization', card: 'ビックカメラSuicaカード', usedAt: '2026-11-14T11:49:54+09:00', merchant: 'ビューカード速報（加盟店未確定）', amount: 1423 },
    ])
    expect(cardMailQuery('2026-11-01T00:00:00Z')).toContain('from:viewcard@mail.viewsnet.jp')
  })
  it('reads the final date, merchant and amount as a purchase', () => {
    const body = labels + '・ ご利用日：2026年11月14日\n・ ご利用加盟店名称：テスト店舗\n・ ご利用金額：１，４２３円'
    expect(parseCardNotifications(viewCard(body))).toMatchObject([
      { provider: 'viewcard', kind: 'purchase', usedAt: '2026-11-14T00:00:00+09:00', datePrecision: 'day', merchant: 'テスト店舗', amount: 1423 },
    ])
  })
  it('holds invalid or ambiguous finals and rejects unauthenticated messages', () => {
    const body = labels + '・ 利用日：2026/11/31\n・ 利用加盟店：テスト店舗\n・ 利用金額：100円'
    expect(parseCardNotifications(viewCard(body))[0].kind).toBe('review')
    const message = viewCard(body.replace('11/31', '11/14') + '\n・ 利用金額：200円')
    expect(parseCardNotifications(message)[0].kind).toBe('review')
    message.payload.headers![2].value = 'mx.google.com; dmarc=fail header.from=mail.viewsnet.jp'
    expect(parseCardNotifications(message)).toEqual([])
  })
})

describe('Rakuten card notifications', () => {
  const plain =
    '■利用日：2026/10/18\n■利用先：スーパーマーケット\n■利用者：本人\n■支払方法：1回払い\n■利用金額：1,234円\nキャンセル後に通知される場合があります'
  const html =
    '<table><tr><th>ご利用日</th><th>ご利用先</th><th>ご利用者</th><th>お支払方法</th><th>ご利用金額</th></tr><tr><td>2026/10/18</td><td>スーパーマーケット</td><td>本人</td><td>1回払い</td><td>1,234円</td></tr><tr><td>2026/10/19</td><td>カフェ</td><td>本人</td><td>1回払い</td><td>500円</td></tr></table>'
  it('extracts a normal notification with a date, without inventing an actual time', () => {
    expect(parseCardNotifications(mail(plain, 'rakuten'))).toMatchObject([
      {
        provider: 'rakuten',
        amount: 1234,
        merchant: 'スーパーマーケット',
        usedAt: '2026-10-18T00:00:00+09:00',
        datePrecision: 'day',
        kind: 'purchase',
      },
    ])
  })
  it('parses all labeled plain-text transactions without combining amounts', () => {
    expect(
      parseCardNotifications(
        mail(plain + '\n' + plain.replace('1,234円', '700円'), 'rakuten')
      ).map((row) => row.amount)
    ).toEqual([1234, 700])
  })
  it('parses HTML table rows and ignores a non-transaction total', () => {
    const message = mail(
      html.replace(
        '</table>',
        '<tr><td>合計</td><td></td><td></td><td></td><td>1,734円</td></tr></table>'
      ),
      'rakuten'
    )
    message.payload.mimeType = 'text/html'
    expect(
      parseCardNotifications(message).map((row) => [
        row.amount,
        row.merchant,
        row.kind,
      ])
    ).toEqual([
      [1234, 'スーパーマーケット', 'purchase'],
      [500, 'カフェ', 'purchase'],
    ])
    expect(parseCardNotification(message)?.kind).toBe('review')
  })
  it('preserves formatted table boundaries inside a multipart HTML-only email', () => {
    const message = mail('', 'rakuten')
    message.payload.mimeType = 'multipart/alternative'
    message.payload.body = {}
    message.payload.parts = [
      {
        mimeType: 'text/html',
        headers: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }],
        body: {
          data: Buffer.from(html.replaceAll('><', '>\n  <')).toString(
            'base64url'
          ),
        },
      },
    ]
    expect(parseCardNotifications(message).map((row) => row.amount)).toEqual([
      1234, 500,
    ])
    expect(
      parseCardNotifications(
        mail(plain.replace('1,234円', '1,2円'), 'rakuten')
      )[0].kind
    ).toBe('review')
  })
  it('puts a flash notification in review even if transaction fields are present', () => {
    const message = mail(plain, 'rakuten')
    message.payload.headers![1].value =
      '【速報版】カード利用のお知らせ(本人ご利用分)'
    expect(parseCardNotifications(message)[0]).toMatchObject({
      kind: 'review',
      amount: 1234,
      reason: expect.stringContaining('速報版'),
    })
  })
  it('accepts a flash notice without a merchant, but never books it as a purchase', () => {
    const message = mail(
      plain.replace('■利用先：スーパーマーケット\n', ''),
      'rakuten'
    )
    message.payload.headers![1].value = '【速報版】カード利用のお知らせ'
    expect(parseCardNotifications(message)[0]).toMatchObject({
      kind: 'review',
      merchant: null,
      amount: 1234,
    })
  })
  it('does not book cancellations or investment contributions as living costs', () => {
    const message = mail(plain, 'rakuten')
    message.payload.headers![1].value = 'カード利用取消のお知らせ'
    expect(parseCardNotifications(message)[0].kind).toBe('review')
    expect(
      parseCardNotifications(
        mail(
          plain.replace('スーパーマーケット', '楽天証券 投信積立'),
          'rakuten'
        )
      )[0].kind
    ).toBe('investment')
  })
  it('keeps the entire email in review when a table row is incomplete', () => {
    const message = mail(html.replace('2026/10/19', '不明'), 'rakuten')
    message.payload.mimeType = 'text/html'
    expect(parseCardNotifications(message)).toMatchObject([
      { kind: 'review', amount: null },
    ])
    expect(
      parseCardNotifications(
        mail(plain.replace('■利用先：スーパーマーケット\n', ''), 'rakuten')
      )[0].kind
    ).toBe('review')
  })
  it('keeps invalid dates, zero amounts and unfamiliar formats for review', () => {
    expect(
      parseCardNotifications(
        mail(plain.replace('2026/10/18', '2026/02/30'), 'rakuten')
      )[0].kind
    ).toBe('review')
    expect(
      parseCardNotifications(
        mail(plain.replace('1,234円', '0円'), 'rakuten')
      )[0].kind
    ).toBe('review')
    expect(
      parseCardNotifications(mail('新しい通知形式です', 'rakuten'))[0].kind
    ).toBe('review')
  })
  it('rejects fake senders, unrelated subjects and failed Google authentication', () => {
    const message = mail(plain, 'rakuten')
    message.payload.headers![0].value =
      'info@mail.rakuten-card.co.jp.attacker.test'
    expect(parseCardNotifications(message)).toEqual([])
    message.payload.headers![0].value = 'info@mail.rakuten-card.co.jp'
    message.payload.headers![2].value =
      'mx.google.com; dmarc=fail header.from=mail.rakuten-card.co.jp;'
    expect(parseCardNotifications(message)).toEqual([])
    message.payload.headers![2].value =
      'attacker.test; dmarc=pass header.from=mail.rakuten-card.co.jp;'
    expect(parseCardNotifications(message)).toEqual([])
    message.payload.headers![2].value =
      'mx.google.com; dmarc=pass header.from=mail.rakuten-card.co.jp;'
    message.payload.headers![1].value = '楽天カード キャンペーンのお知らせ'
    expect(parseCardNotifications(message)).toEqual([])
  })
  it('excludes registration-change emails that share the notification prefix', () => {
    const message = mail(plain, 'rakuten')
    message.payload.headers![1].value =
      'カード利用お知らせメール登録内容変更のお知らせ'
    expect(parseCardNotifications(message)).toEqual([])
  })
  it('decodes valid UTF-8 payloads with an incorrect ISO-2022-JP header', () => {
    const message = mail(plain, 'rakuten')
    message.payload.headers![3].value = 'text/plain; charset=ISO-2022-JP'
    expect(parseCardNotifications(message)[0]).toMatchObject({
      kind: 'purchase',
      merchant: 'スーパーマーケット',
      amount: 1234,
    })
  })
  it('includes Rakuten in recovery searches without expanding to all mail', () => {
    expect(cardMailQuery('2026-10-19T00:00:00Z')).toContain(
      'from:info@mail.rakuten-card.co.jp'
    )
    expect(cardMailQuery('2026-10-19T00:00:00Z')).toContain(
      'from:mail@qa.jcb.co.jp'
    )
  })
})
