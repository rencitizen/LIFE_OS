export interface MailPart {
  mimeType?: string
  headers?: { name: string; value: string }[]
  body?: { data?: string }
  parts?: MailPart[]
}

export interface GmailMessage {
  id: string
  internalDate: string
  payload: MailPart
}

export const CARD_PARSER_VERSION = 2
export const RETRYABLE_PARSE_REASONS = [
  '文字コードを解釈できません',
  '利用日時・金額・利用先の確認が必要です',
  '利用日・金額・利用先の確認が必要です',
  '楽天カードの通知形式を確認してください（自動計上なし）',
  '一部の明細を読み取れません。メール全体の確認が必要です（自動計上なし）',
  '売上到着分のメール全体の確認が必要です（自動計上なし）',
] as const

export type CardProvider = 'jcb' | 'smbc' | 'rakuten' | 'viewcard'

export const VIEWCARD_SENDER = 'viewcard@mail.viewsnet.jp'
export const CARD_SENDERS = [
  'mail@qa.jcb.co.jp',
  'statement@vpass.ne.jp',
  'info@mail.rakuten-card.co.jp',
  VIEWCARD_SENDER,
] as const

const VIEWCARD_SUBJECT = /^(?:(?:◆速報版◆|◆確報版◆|【速報版】|【確報版】)\s*)?ビューカードご利用情報のお知らせ\(本人会員利用\)$/
export const cardMailQuery = (connectedAt: string) =>
  `after:${Math.floor(new Date(connectedAt).getTime() / 1000)} {${CARD_SENDERS.map((sender) => `from:${sender}`).join(' ')}}`

export type CardNotification = {
  provider: CardProvider
  stage?: 'authorization'
  datePrecision?: 'day' | 'minute'
  amount: number | null
  merchant: string | null
  usedAt: string | null
  card: string | null
  kind: 'purchase' | 'investment' | 'review'
  reason: string | null
}

export function header(part: MailPart, name: string) {
  return (
    part.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())
      ?.value ?? ''
  )
}

// Gmail's body.data has already had Content-Transfer-Encoding removed. Decode the
// original charset, rather than decoding ISO-2022-JP bytes as UTF-8 (the connector does).
export function decodeBody(part: MailPart): string {
  const charset =
    header(part, 'content-type').match(
      /charset\s*=\s*["']?([^;"'\s]+)/i
    )?.[1] ?? 'utf-8'
  let own = ''
  if (part.body?.data) {
    const bytes = Buffer.from(part.body.data, 'base64url')
    try {
      own = new TextDecoder(charset, { fatal: true }).decode(bytes)
    } catch {
      // Some Gmail payloads contain UTF-8 despite an ISO-2022-JP MIME header.
      // Only accept a valid UTF-8 fallback, never replacement characters.
      own = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    }
  }
  if (part.mimeType === 'text/plain') return own
  const plain = (part.parts ?? [])
    .filter((p) => p.mimeType === 'text/plain' || p.parts?.length)
    .map(decodeBody)
    .filter(Boolean)
  if (plain.length) return plain.join('\n')
  if (!own && part.parts?.length) return part.parts.map(decodeBody).join('\n')
  const html = own
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/\r?\n/g, ' ')
    .replace(/<\/(?:td|th)\s*>/gi, '\t')
    .replace(/<\/(?:tr|p|div|li|h[1-6])\s*>|<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
}

function dateTime(text: string) {
  const match = text.match(
    /(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\s+(\d{1,2}):(\d{2})/
  )
  if (!match) return null
  const [, y, m, d, h, min] = match
  const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${min}:00+09:00`
  const date = new Date(iso)
  if (
    Number.isNaN(date.getTime()) ||
    h.length > 2 ||
    Number(h) > 23 ||
    Number(min) > 59
  )
    return null
  if (
    new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(
      date
    ) !== iso.slice(0, 10)
  )
    return null
  return iso
}

export function notificationProvider(
  message: GmailMessage
): CardProvider | null {
  const from =
    header(message.payload, 'from').match(/<([^>]+)>/)?.[1] ??
    header(message.payload, 'from').trim()
  const provider =
    from.toLowerCase() === 'mail@qa.jcb.co.jp'
      ? 'jcb'
      : from.toLowerCase() === 'statement@vpass.ne.jp'
        ? 'smbc'
        : from.toLowerCase() === 'info@mail.rakuten-card.co.jp'
          ? 'rakuten'
          : from.toLowerCase() === VIEWCARD_SENDER
            ? 'viewcard'
            : null
  const subject = header(message.payload, 'subject').normalize('NFKC')
  if (
    !provider ||
    !(provider === 'viewcard'
      ? VIEWCARD_SUBJECT.test(subject.trim())
      : provider === 'rakuten'
      ? /^(?:【速報版】)?(?:楽天)?カード(?:ご)?利用(?:の)?(?:お知らせ(?:メール)?|(?:取消|キャンセル|返金)のお知らせ)(?:\([^)]*\))?(?:[ -]*\d{4}\/\d{1,2}\/\d{1,2}(?: \d{1,2}:\d{2})?)?$/.test(
          subject.trim()
        )
      : provider === 'jcb'
        ? subject.includes('ショッピングご利用のお知らせ') ||
          /(?:利用|ショッピング).*(?:取消|キャンセル|返金)/.test(subject)
        : subject.includes('ご利用のお知らせ') ||
          /利用.*(?:取消|キャンセル|返金)/.test(subject))
  )
    return null

  // Only accept authentication results added by Google's receiving mail server.
  const auth =
    message.payload.headers?.find(
      (h) =>
        h.name.toLowerCase() === 'authentication-results' &&
        /^mx\.google\.com;/i.test(h.value)
    )?.value ?? ''
  const domain =
    provider === 'jcb'
      ? 'qa.jcb.co.jp'
      : provider === 'smbc'
        ? 'vpass.ne.jp'
        : provider === 'viewcard'
          ? 'mail.viewsnet.jp'
          : 'mail.rakuten-card.co.jp'
  if (
    !/\bdmarc=pass\b/i.test(auth) ||
    !new RegExp(
      `header\\.from=${domain.replaceAll('.', '\\.')}[;\\s]`,
      'i'
    ).test(`${auth} `)
  )
    return null
  return provider
}

function parseViewCard(message: GmailMessage): CardNotification {
  const review: CardNotification = {
    provider: 'viewcard', card: null, usedAt: null, amount: null, merchant: null,
    kind: 'review', reason: 'ビューカードの通知形式を確認してください（自動計上なし）',
  }
  let body: string
  try {
    body = decodeBody(message.payload).normalize('NFKC').replace(/\r/g, '')
  } catch {
    return { ...review, reason: '文字コードを解釈できません' }
  }
  const field = (label: string) => {
    const rows = [...body.matchAll(new RegExp(
      `^[^\\S\\n]*(?:[・●]\\s*)?(?:ご)?${label}[^\\S\\n]*(?::[^\\S\\n]*|\\t+)([^\\n]+)`,
      'gm'
    ))]
    return rows.length === 1 ? rows[0][1].trim() : ''
  }
  const flash = /速報版/.test(header(message.payload, 'subject'))
  const card = field('利用カード') || null
  const date = (flash ? field('利用日時') : field('利用日') || field('利用日時'))
    .replace(/年|月/g, '/').replace(/日\s*/g, ' ').trim()
  const parts = date.match(/^(\d{4}[/-]\d{1,2}[/-]\d{1,2})(?:\s+(\d{1,2}:\d{2})(?::([0-5]\d))?)?$/)
  const datePrecision = parts?.[2] ? 'minute' : 'day'
  const minute = parts && (!flash || parts[2])
    ? dateTime(`${parts[1]} ${parts[2] ?? '00:00'}`)
    : null
  const usedAt = minute && parts?.[3] ? minute.replace(/:00\+09:00$/, `:${parts[3]}+09:00`) : minute
  const amountText = field('利用金額').match(/^(?:[¥￥]\s*)?(\d+|\d{1,3}(?:,\d{3})+)\s*円?$/)
  const value = amountText ? Number(amountText[1].replaceAll(',', '')) : 0
  const amount = Number.isSafeInteger(value) && value > 0 && value < 10_000_000_000 ? value : null
  const merchant = field('利用加盟店(?:名(?:称)?)?')
  const details = { ...review, card, usedAt, amount, datePrecision } as const
  if (!card || !usedAt || amount === null || !merchant) return details
  if (flash) return {
    ...details, stage: 'authorization', kind: 'purchase',
    merchant: 'ビューカード速報（加盟店未確定）', reason: null,
  }
  if (/^(?:国内加盟店|海外加盟店|不明|未確定|未特定)$/.test(merchant)
      || /取消|キャンセル|返金/.test(merchant)) return details
  const investment = /証券.*(?:投信|積立)|投信積立/.test(merchant)
  return { ...details, merchant, kind: investment ? 'investment' : 'purchase', reason: null }
}

function parseLegacyNotification(
  message: GmailMessage
): CardNotification | null {
  const provider = notificationProvider(message)
  if (!provider) return null
  const subject = header(message.payload, 'subject').normalize('NFKC')

  let body: string
  try {
    body = decodeBody(message.payload).normalize('NFKC').replace(/\r/g, '')
  } catch {
    return {
      provider,
      amount: null,
      merchant: null,
      usedAt: null,
      card: null,
      kind: 'review',
      reason: '文字コードを解釈できません',
    }
  }
  const amountMatch = body.match(
    /(?:ご利用金額|利用金額)[\s】:\n]*([\d,]+)\s*円/
  )
  const amount = amountMatch ? Number(amountMatch[1].replaceAll(',', '')) : null
  const usedAt = dateTime(
    body.match(/(?:ご利用日時|◇利用日)[^\d]*([\d/\- :]+)/)?.[1] ?? ''
  )
  let merchant =
    body.match(/(?:【ご利用先】|◇利用先[:：])\s*([^\n]+)/)?.[1]?.trim() ?? null
  if (!merchant && provider === 'smbc') {
    const lines = body
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    const index = lines.findIndex(
      (line) => /ご利用日時/.test(line) && /\d{4}[/-]/.test(line)
    )
    if (index >= 0)
      merchant =
        lines
          .slice(index + 1)
          .find(
            (line) =>
              !/^[\d,]+\s*円$/.test(line) &&
              !/ご利用金額|本メール|ご利用情報|https?:/.test(line)
          ) ?? null
  }
  const card =
    body.match(/(?:カード名称|ご利用カード)\s*[:：]\s*([^\n]+)/)?.[1]?.trim() ??
    (provider === 'smbc'
      ? (body.match(/([^\n。]+)についてカードの利用内容/)?.[1]?.trim() ?? null)
      : null)
  // Boilerplate mentions cancellation even in normal notifications. Only classify
  // cancellation when the subject or the actual transaction fields say so.
  const cancellation = /取消|キャンセル|返金/.test(
    `${subject} ${merchant ?? ''}`
  )
  const investment = /証券.*(?:投信|積立)|投信積立/.test(merchant ?? '')
  const valid =
    amount !== null &&
    Number.isSafeInteger(amount) &&
    amount > 0 &&
    amount < 10_000_000_000 &&
    usedAt &&
    merchant
  return {
    provider,
    amount,
    merchant,
    usedAt,
    card,
    kind:
      cancellation || !valid
        ? 'review'
        : investment
          ? 'investment'
          : 'purchase',
    reason: cancellation
      ? '取消・返金の照合が必要です'
      : !valid
        ? '利用日時・金額・利用先の確認が必要です'
        : null,
  }
}

const rakutenDate =
  /(\d{4})[\/年-](\d{1,2})[\/月-](\d{1,2})日?(?:\s+(\d{1,2}):(\d{2}))?/

function rakutenReview(reason: string): CardNotification {
  return {
    provider: 'rakuten',
    amount: null,
    usedAt: null,
    merchant: null,
    card: '楽天カード',
    kind: 'review',
    reason,
  }
}

function parseRakuten(message: GmailMessage): CardNotification[] {
  const subject = header(message.payload, 'subject').normalize('NFKC')
  let body: string
  try {
    body = decodeBody(message.payload).normalize('NFKC').replace(/\r/g, '')
  } catch {
    return [rakutenReview('文字コードを解釈できません')]
  }
  const flash = subject.includes('速報版')
  const cancelled = /取消|キャンセル|返金/.test(subject)
  type Fields = { date: string; amount: string; merchant: string }
  const fields: Fields[] = []
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  // HTML tables retain cell boundaries. Never confuse a payment total or card
  // number with a transaction amount, or collapse several transactions into one.
  const headerIndex = lines.findIndex(
    (line) =>
      /(?:ご)?利用日/.test(line) &&
      /(?:ご)?利用金額/.test(line) &&
      line.includes('\t')
  )
  if (headerIndex >= 0) {
    const columns = lines[headerIndex].split('\t').map((cell) => cell.trim())
    const dateCol = columns.findIndex((cell) =>
      /^(?:ご)?利用日(?:時)?$/.test(cell)
    )
    const amountCol = columns.findIndex((cell) =>
      /^(?:ご)?利用金額$/.test(cell)
    )
    const merchantCol = columns.findIndex((cell) =>
      /^(?:ご)?利用先$/.test(cell)
    )
    if (dateCol >= 0 && amountCol >= 0) {
      for (const line of lines.slice(headerIndex + 1)) {
        const cells = line.split('\t').map((cell) => cell.trim())
        if (
          !/^\d{4}[\/年-]\d{1,2}[\/月-]\d{1,2}/.test(cells[dateCol] ?? '') &&
          !/^[\d,]+\s*円$/.test(cells[amountCol] ?? '')
        )
          continue
        if (/合計|総額/.test(cells[dateCol] ?? '')) continue
        fields.push({
          date: cells[dateCol],
          amount: cells[amountCol] ?? '',
          merchant: merchantCol >= 0 ? (cells[merchantCol] ?? '') : '',
        })
      }
    }
  } else {
    // Plain-text notifications repeat labeled transaction fields for each use.
    const starts = [
      ...body.matchAll(/(?:ご)?利用日(?:時)?\s*[:：】]?\s*(?=\d{4}[\/年-])/g),
    ]
    for (let index = 0; index < starts.length; index++) {
      const block = body.slice(starts[index].index, starts[index + 1]?.index)
      const amounts = [
        ...block.matchAll(/(?:ご)?利用金額\s*[:：】]?\s*([\d,]+)\s*円/g),
      ]
      fields.push({
        date: block.match(rakutenDate)?.[0] ?? '',
        amount: amounts.length === 1 ? amounts[0][1] + '円' : '',
        merchant:
          block.match(/(?:ご)?利用先\s*[:：】]?\s*([^\n]+)/)?.[1]?.trim() ?? '',
      })
    }
  }
  if (!fields.length || fields.length > 100)
    return [
      rakutenReview('楽天カードの通知形式を確認してください（自動計上なし）'),
    ]
  const parsed = fields.map((field): CardNotification => {
    const match = field.date.match(rakutenDate)
    const usedAt = match
      ? dateTime(
          `${match[1]}/${match[2]}/${match[3]} ${match[4] ?? '00'}:${match[5] ?? '00'}`
        )
      : null
    const amountMatch = field.amount.match(
      /^(\d+|[1-9]\d{0,2}(?:,\d{3})+)\s*円$/
    )
    const amount = amountMatch
      ? Number(amountMatch[1].replaceAll(',', ''))
      : null
    const merchant =
      field.merchant &&
      !/^(?:[【■●◆]\s*)?(?:(?:ご)?利用(?:日|先|金額|者)|支払方法|本メール|https?:)/.test(
        field.merchant
      )
        ? field.merchant
        : null
    const valid =
      usedAt &&
      amount !== null &&
      Number.isSafeInteger(amount) &&
      amount > 0 &&
      amount < 10_000_000_000 &&
      merchant
    const investment = /証券.*(?:投信|積立)|投信積立/.test(merchant ?? '')
    const cancellation =
      cancelled || /取消|キャンセル|返金/.test(merchant ?? '')
    return {
      provider: 'rakuten',
      card: '楽天カード',
      usedAt,
      datePrecision: match?.[4] ? 'minute' : 'day',
      amount,
      merchant,
      kind:
        flash || cancellation || !valid
          ? 'review'
          : investment
            ? 'investment'
            : 'purchase',
      reason: flash
        ? '速報版です。利用先を含む通常版の到着後に支出へ反映します'
        : cancellation
          ? '取消・返金の照合が必要です'
          : !valid
            ? '利用日・金額・利用先の確認が必要です'
            : null,
    }
  })
  // If any normal-format row is incomplete, keep the whole email for review.
  // Partial imports would hide omissions when the message is marked processed.
  if (
    !flash &&
    parsed.some((row) => !row.usedAt || row.amount === null || !row.merchant)
  )
    return [
      rakutenReview(
        '一部の明細を読み取れません。メール全体の確認が必要です（自動計上なし）'
      ),
    ]
  return parsed
}

// JCB sales-arrival mail contains one or more day-only transactions.
// Parse every block before claiming the email; never silently keep only row one.
function parseJcbSalesArrival(message: GmailMessage): CardNotification[] {
  let body: string
  try {
    body = decodeBody(message.payload).normalize('NFKC').replace(/\r/g, '')
  } catch {
    return [{ provider: 'jcb', amount: null, merchant: null, usedAt: null,
      card: null, kind: 'review', reason: '文字コードを解釈できません' }]
  }
  const blocks = body.split(/◆ご利用\d+/).slice(1)
  const card = body.match(/カード名称\s*[:：]\s*([^\n]+)/)?.[1]?.trim() ?? null
  const rows = blocks.map((block): CardNotification => {
    const day = block.match(/【ご利用日】\s*(\d{4}\/\d{1,2}\/\d{1,2})(?=\s|$)/)?.[1]
    const amounts = [...block.matchAll(/【ご利用金額】\s*([\d,]+)\s*円/g)]
    const amount = amounts.length === 1 ? Number(amounts[0][1].replaceAll(',', '')) : null
    const merchant = block.match(/【ご利用先】[^\S\n]*([^\n]+)/)?.[1]?.trim() ?? null
    const usedAt = day ? dateTime(`${day} 00:00`) : null
    const valid = usedAt && merchant && amount !== null && Number.isSafeInteger(amount) && amount > 0 && amount < 10_000_000_000
    const cancellation = /取消|キャンセル|返金/.test(`${header(message.payload, 'subject')} ${merchant ?? ''}`)
    return { provider: 'jcb', card, usedAt, datePrecision: 'day', amount, merchant,
      kind: !valid || cancellation ? 'review' : /証券.*(?:投信|積立)|投信積立/.test(merchant ?? '') ? 'investment' : 'purchase',
      reason: cancellation ? '取消・返金の照合が必要です' : !valid ? '利用日・金額・利用先の確認が必要です' : null }
  })
  if (!rows.length || rows.length > 100 || rows.some(row => row.kind === 'review'))
    return [{ provider: 'jcb', amount: null, merchant: null, usedAt: null,
      card, kind: 'review', reason: '売上到着分のメール全体の確認が必要です（自動計上なし）' }]
  return rows
}

export function parseCardNotifications(
  message: GmailMessage
): CardNotification[] {
  const provider = notificationProvider(message)
  if (!provider) return []
  if (provider === 'viewcard') return [parseViewCard(message)]
  if (provider === 'rakuten') return parseRakuten(message)
  if (provider === 'jcb' && header(message.payload, 'subject').normalize('NFKC').includes('(売上到着分)'))
    return parseJcbSalesArrival(message)
  const notification = parseLegacyNotification(message)
  return notification ? [notification] : []
}

/** Single-record callers must never silently import only the first table row. */
export function parseCardNotification(
  message: GmailMessage
): CardNotification | null {
  const rows = parseCardNotifications(message)
  return rows.length > 1
    ? { ...rows[0], amount: null, merchant: null, usedAt: null, kind: 'review', reason: '複数明細の通知です。一括取り込みで処理してください' }
    : (rows[0] ?? null)
}
