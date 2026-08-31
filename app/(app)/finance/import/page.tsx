'use client'

import { useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatYen } from '@/lib/finance/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import {
  useImportMoneyForward,
  useMoneyForwardImportRuns,
  type MoneyForwardImportResult,
  type MoneyForwardImportRow,
  type MoneyForwardIncomeImportRow,
} from '@/lib/hooks/use-moneyforward-import'

const KNOWN_TOP_LEVEL = new Set([
  '食費', '日用品', '交通費', '自動車', '健康・医療', '趣味・娯楽', '衣服・美容', '水道・光熱費',
  '通信費', '住宅', '税・社会保障', '教養・教育', '特別な支出', 'その他', '酒・たばこ', '未分類',
  '交際費', '現金・カード',
])

type ParsedCsv = {
  rows: MoneyForwardImportRow[]
  incomeRows: MoneyForwardIncomeImportRow[]
  skipped: number
  totalAmount: number
  incomeTotalAmount: number
  fileName: string
}

function parseCsvText(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''))
      if (row.some((value) => value.length > 0)) rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  row.push(field.replace(/\r$/, ''))
  if (row.some((value) => value.length > 0)) rows.push(row)
  return rows
}

function truthyFlag(value: string | undefined) {
  const normalized = (value || '').trim().toLowerCase()
  return ['1', 'true', 'yes', '対象', '計算対象'].includes(normalized)
}

function falseyFlag(value: string | undefined) {
  const normalized = (value || '').trim().toLowerCase()
  return ['0', 'false', 'no', '対象外', '計算対象外'].includes(normalized)
}

function normalizeDate(value: string) {
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/)
  if (!match) return ''
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

function normalizeAmount(value: string) {
  const numeric = Number(value.replace(/[¥￥,\s]/g, ''))
  return Number.isFinite(numeric) ? numeric : NaN
}

function mapCategory(parent: string, child: string) {
  const major = parent.trim()
  const minor = child.trim()
  const combined = `${major} ${minor}`

  if (major === '外食') return { category_name: '外食費', parent_category_name: '食費' }

  if (major === '食費') {
    if (/カフェ|喫茶|コーヒー|珈琲/.test(minor)) {
      return { category_name: 'カフェ', parent_category_name: '食費' }
    }
    if (/飲み|飲酒|居酒屋|酒場|バー|宴会/.test(minor)) {
      return { category_name: '飲み会', parent_category_name: '交際費' }
    }
    if (/食料品|食材|食品|スーパー/.test(minor)) {
      return { category_name: '食材費', parent_category_name: '食費' }
    }
    if (/外食|朝ご飯|朝食|昼ご飯|昼食|晩ご飯|夕食|ランチ|ディナー|レストラン/.test(combined)) {
      return { category_name: '外食費', parent_category_name: '食費' }
    }
    return { category_name: '食費', parent_category_name: null }
  }

  if (major === '交際費') {
    if (/飲み|飲酒|居酒屋|酒場|バー|宴会/.test(minor)) {
      return { category_name: '飲み会', parent_category_name: '交際費' }
    }
    return { category_name: '交際費', parent_category_name: null }
  }

  if (KNOWN_TOP_LEVEL.has(major)) return { category_name: major, parent_category_name: null }
  return { category_name: 'その他', parent_category_name: null }
}

function inferPaymentMethod(account: string) {
  if (/現金/.test(account)) return 'cash' as const
  if (/カード|credit|visa|master|jcb|amex|american express/i.test(account)) return 'card' as const
  return null
}

function inferIncomeType(major: string, minor: string, description: string): MoneyForwardIncomeImportRow['income_type'] {
  const combined = `${major} ${minor} ${description}`
  if (/賞与|ボーナス/.test(combined)) return 'bonus'
  if (/給与|給料|給料振込|salary/i.test(combined)) return 'salary'
  if (/副業|業務委託|freelance/i.test(combined)) return 'freelance'
  return 'other'
}

async function decodeCsv(file: File) {
  const buffer = await file.arrayBuffer()
  let text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  if (text.includes('\uFFFD')) {
    try {
      text = new TextDecoder('shift_jis', { fatal: false }).decode(buffer)
    } catch {
      // Keep UTF-8 and let the header validation below surface malformed input.
    }
  }
  return text.replace(/^\uFEFF/, '')
}

async function parseMoneyForwardFile(file: File): Promise<ParsedCsv> {
  const text = await decodeCsv(file)
  const grid = parseCsvText(text)
  if (grid.length < 2) throw new Error('CSVに明細行がありません')

  const headers = grid[0].map((value) => value.trim())
  const required = ['日付', '内容', '金額（円）', '大項目', '中項目']
  const missing = required.filter((name) => !headers.includes(name))
  if (missing.length > 0) throw new Error(`MoneyForward CSVの列が不足しています: ${missing.join('、')}`)

  const index = (name: string) => headers.indexOf(name)
  const rows: MoneyForwardImportRow[] = []
  const incomeRows: MoneyForwardIncomeImportRow[] = []
  let skipped = 0
  let totalAmount = 0
  let incomeTotalAmount = 0

  for (const columns of grid.slice(1)) {
    const get = (name: string) => {
      const i = index(name)
      return i >= 0 ? (columns[i] || '').trim() : ''
    }

    const calculationFlag = get('計算対象')
    const transferFlag = get('振替')
    if ((calculationFlag && falseyFlag(calculationFlag)) || truthyFlag(transferFlag)) {
      skipped += 1
      continue
    }

    const signedAmount = normalizeAmount(get('金額（円）'))
    const transactionDate = normalizeDate(get('日付'))
    if (!Number.isFinite(signedAmount) || signedAmount === 0 || !transactionDate) {
      skipped += 1
      continue
    }

    const description = get('内容') || get('メモ') || 'MoneyForward'
    const rawPayload = Object.fromEntries(headers.map((header, i) => [header, columns[i] || '']))
    const externalId = get('ID') || null

    if (signedAmount < 0) {
      const mapped = mapCategory(get('大項目'), get('中項目'))
      const amount = Math.abs(signedAmount)

      rows.push({
        expense_date: transactionDate,
        amount,
        description,
        category_name: mapped.category_name,
        parent_category_name: mapped.parent_category_name,
        external_id: externalId,
        payment_method: inferPaymentMethod(get('保有金融機関')),
        is_settlement_target: false,
        raw_payload: rawPayload,
      })
      totalAmount += amount
      continue
    }

    incomeRows.push({
      income_date: transactionDate,
      amount: signedAmount,
      description,
      income_type: inferIncomeType(get('大項目'), get('中項目'), description),
      external_id: externalId,
      raw_payload: rawPayload,
    })
    incomeTotalAmount += signedAmount
  }

  return {
    rows,
    incomeRows,
    skipped,
    totalAmount,
    incomeTotalAmount,
    fileName: file.name,
  }
}

export default function MoneyForwardImportPage() {
  const { user, partner, couple } = useAuth()
  const [parsed, setParsed] = useState<ParsedCsv | null>(null)
  const [paidBy, setPaidBy] = useState<string>('')
  const [result, setResult] = useState<MoneyForwardImportResult | null>(null)
  const importMutation = useImportMoneyForward()
  const { data: runs } = useMoneyForwardImportRuns(couple?.id)

  const payerOptions = useMemo(
    () => [user, partner].filter((member): member is NonNullable<typeof member> => Boolean(member)),
    [partner, user]
  )

  const handleFile = async (file: File | null) => {
    setResult(null)
    if (!file) {
      setParsed(null)
      return
    }

    try {
      const next = await parseMoneyForwardFile(file)
      setParsed(next)
      if (!paidBy && user?.id) setPaidBy(user.id)
      if (next.rows.length === 0 && next.incomeRows.length === 0) {
        toast.error('取り込み対象の明細がありません')
      }
    } catch (error) {
      setParsed(null)
      toast.error(error instanceof Error ? error.message : 'CSVを解析できませんでした')
    }
  }

  const handleImport = async () => {
    if (!user?.id || !parsed || !paidBy) return
    try {
      const next = await importMutation.mutateAsync({
        userId: user.id,
        paidBy,
        rows: parsed.rows,
        incomeRows: parsed.incomeRows,
        fileName: parsed.fileName,
      })
      setResult(next)

      const failed = next.failed_count + next.income_failed_count
      if (failed > 0) toast.warning(`${failed}件は確認が必要です`)
      else toast.success('MoneyForwardの収支明細を取り込みました')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '取り込みに失敗しました')
    }
  }

  const hasTransactions = Boolean(parsed && (parsed.rows.length > 0 || parsed.incomeRows.length > 0))

  return (
    <div className="space-y-5 pb-8">
      <section className="rounded-[28px] bg-[#071d42] px-5 py-6 text-white shadow-sm">
        <div className="flex items-center gap-2">
          <Badge className="border-0 bg-white/10 text-white hover:bg-white/10">MoneyForward</Badge>
          <span className="text-xs font-semibold text-white/60">差分同期</span>
        </div>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-white">CSV明細取込</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
          支出と収入を同じCSVから同期します。振替は除外し、既存明細はIDまたは金額・月で重複を防ぎます。
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. CSVを選択</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mf-csv">MoneyForward CSV</Label>
            <Input
              id="mf-csv"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => handleFile(event.target.files?.[0] || null)}
            />
          </div>

          <div className="space-y-2">
            <Label>所有者 / 支払者</Label>
            <Select value={paidBy} onValueChange={(value) => setPaidBy(value || '')}>
              <SelectTrigger className="max-w-xs"><SelectValue placeholder="メンバーを選択" /></SelectTrigger>
              <SelectContent>
                {payerOptions.map((member) => (
                  <SelectItem key={member.id} value={member.id}>{member.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              支出は支払者、収入は同じメンバーの収入として登録します。
            </p>
          </div>
        </CardContent>
      </Card>

      {parsed && (
        <Card>
          <CardHeader><CardTitle className="text-base">2. 取込プレビュー</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-rose-500/8 p-4">
                <div className="flex items-center gap-2 text-rose-600">
                  <ArrowUpFromLine className="h-4 w-4" />
                  <p className="text-xs font-bold">支出</p>
                </div>
                <p className="mt-2 text-xl font-black">{parsed.rows.length}件</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatYen(parsed.totalAmount)}</p>
              </div>

              <div className="rounded-2xl bg-blue-500/8 p-4">
                <div className="flex items-center gap-2 text-blue-600">
                  <ArrowDownToLine className="h-4 w-4" />
                  <p className="text-xs font-bold">収入</p>
                </div>
                <p className="mt-2 text-xl font-black">{parsed.incomeRows.length}件</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatYen(parsed.incomeTotalAmount)}</p>
              </div>

              <div className="rounded-2xl bg-muted/60 p-4">
                <p className="text-xs font-bold text-muted-foreground">全取込対象</p>
                <p className="mt-2 text-xl font-black">{parsed.rows.length + parsed.incomeRows.length}件</p>
              </div>

              <div className="rounded-2xl bg-muted/60 p-4">
                <p className="text-xs font-bold text-muted-foreground">除外</p>
                <p className="mt-2 text-xl font-black">{parsed.skipped}件</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" /> {parsed.fileName}
            </div>

            <Button
              onClick={handleImport}
              disabled={!paidBy || !hasTransactions || importMutation.isPending}
            >
              {importMutation.isPending
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Upload className="mr-2 h-4 w-4" />}
              差分を取り込む
            </Button>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader><CardTitle className="text-base">取込結果</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-black text-muted-foreground">支出</p>
              <div className="grid gap-2 sm:grid-cols-4">
                <div className="rounded-2xl bg-muted/45 p-3"><p className="text-xs text-muted-foreground">新規</p><p className="text-lg font-black">{result.inserted_count}件</p></div>
                <div className="rounded-2xl bg-muted/45 p-3"><p className="text-xs text-muted-foreground">既存と統合</p><p className="text-lg font-black">{result.linked_existing_count}件</p></div>
                <div className="rounded-2xl bg-muted/45 p-3"><p className="text-xs text-muted-foreground">変更なし</p><p className="text-lg font-black">{result.unchanged_count}件</p></div>
                <div className="rounded-2xl bg-muted/45 p-3"><p className="text-xs text-muted-foreground">要確認</p><p className="text-lg font-black">{result.failed_count}件</p></div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-black text-muted-foreground">収入</p>
              <div className="grid gap-2 sm:grid-cols-4">
                <div className="rounded-2xl bg-blue-500/8 p-3"><p className="text-xs text-muted-foreground">新規</p><p className="text-lg font-black">{result.income_inserted_count}件</p></div>
                <div className="rounded-2xl bg-blue-500/8 p-3"><p className="text-xs text-muted-foreground">既存と統合</p><p className="text-lg font-black">{result.income_linked_existing_count}件</p></div>
                <div className="rounded-2xl bg-blue-500/8 p-3"><p className="text-xs text-muted-foreground">変更なし</p><p className="text-lg font-black">{result.income_unchanged_count}件</p></div>
                <div className="rounded-2xl bg-blue-500/8 p-3"><p className="text-xs text-muted-foreground">要確認</p><p className="text-lg font-black">{result.income_failed_count}件</p></div>
              </div>
            </div>

            {[...result.errors, ...result.income_errors].length > 0 && (
              <div className="space-y-2 rounded-2xl border p-4">
                <p className="text-sm font-bold">確認が必要な行</p>
                {[...result.errors, ...result.income_errors].slice(0, 20).map((error, index) => (
                  <p key={`${error.row}-${index}`} className="text-xs text-muted-foreground">
                    行 {error.row ?? '—'}: {error.description || error.external_id || '明細'} — {error.message || '取込エラー'}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">最近の支出取込</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(runs || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">まだ取込履歴はありません。</p>
          ) : (
            (runs || []).map((run) => (
              <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3 text-sm">
                <div>
                  <p className="font-bold">{run.file_name || 'MoneyForward CSV'}</p>
                  <p className="text-xs text-muted-foreground">{new Date(run.created_at).toLocaleString('ja-JP')}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>新規 {run.inserted_count} / 統合 {run.linked_existing_count} / 変更なし {run.unchanged_count}</p>
                  {run.failed_count > 0 && <p className="text-destructive">要確認 {run.failed_count}件</p>}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
