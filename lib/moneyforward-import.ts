export const MONEYFORWARD_IMPORT_PROMPT = `マネーフォワードの家計画面スクリーンショットから、
カテゴリ別の金額だけ抽出してください。

取得する項目

- category（カテゴリ名）
- amount（カテゴリ金額）

明細や店舗名は不要です。
カテゴリごとの金額のみ抽出してください。

JSON形式で出力してください。

例

[
  {
    "category": "食費",
    "amount": 47303
  },
  {
    "category": "趣味娯楽",
    "amount": 32930
  }
]

金額は数値のみで、
円記号とカンマは除去してください。`

export interface MoneyforwardImportRow {
  category: string
  amount: number
}

export function normalizeMoneyforwardRows(rows: unknown): MoneyforwardImportRow[] {
  const rawRows = Array.isArray(rows)
    ? rows
    : (
      typeof rows === 'object'
      && rows !== null
      && 'items' in rows
      && Array.isArray(rows.items)
    ) ? rows.items : []

  return rawRows
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const category = typeof row.category === 'string' ? row.category.trim() : ''
      const amountValue = typeof row.amount === 'number' ? row.amount : Number(String(row.amount || '').replace(/[^\d.-]/g, ''))
      if (!category || !Number.isFinite(amountValue) || amountValue <= 0) return null
      return {
        category,
        amount: Math.round(amountValue),
      }
    })
    .filter((row): row is MoneyforwardImportRow => Boolean(row))
}

export function parseOpenAIJsonPayload(content: string) {
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}
