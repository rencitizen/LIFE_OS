'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { addMonths, format } from 'date-fns'
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ReceiptText,
  Scale,
  Wallet,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FINANCE_SCOPE_LABELS, filterByFinanceScope } from '@/lib/finance/scope'
import { formatYen } from '@/lib/finance/utils'
import { getTodayJstDateKey } from '@/lib/date-utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useBudget } from '@/lib/hooks/use-budgets'
import { useExpenseCategories } from '@/lib/hooks/use-categories'
import { useExpenses } from '@/lib/hooks/use-expenses'
import { useMonthlySettlementPreview } from '@/lib/hooks/use-settlements'
import { useFinanceStore } from '@/stores/finance-store'

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

function displayPerson(id: string | null, user?: { id: string; display_name: string } | null, partner?: { id: string; display_name: string } | null) {
  if (!id) return '—'
  if (user?.id === id) return user.display_name
  if (partner?.id === id) return partner.display_name
  return 'メンバー'
}

export default function FinanceDashboardPage() {
  const { couple, user, partner } = useAuth()
  const { selectedMonth, setSelectedMonth, financeScope } = useFinanceStore()
  const { data: expenses } = useExpenses(couple?.id, selectedMonth)
  const { data: categories } = useExpenseCategories(couple?.id)
  const { data: budget } = useBudget(couple?.id, selectedMonth)
  const { data: settlement } = useMonthlySettlementPreview(user?.id, selectedMonth)

  const [year, month] = selectedMonth.split('-').map(Number)
  const displayDate = new Date(year, month - 1, 1)
  const todayKey = getTodayJstDateKey()

  const scopedExpenses = useMemo(
    () => filterByFinanceScope(expenses || [], financeScope, user?.id, partner?.id, (row) => row.paid_by),
    [expenses, financeScope, partner?.id, user?.id]
  )

  const monthTotal = useMemo(
    () => scopedExpenses.reduce((sum, row) => sum + Number(row.amount), 0),
    [scopedExpenses]
  )

  const todayTotal = useMemo(
    () => scopedExpenses
      .filter((row) => row.expense_date === todayKey)
      .reduce((sum, row) => sum + Number(row.amount), 0),
    [scopedExpenses, todayKey]
  )

  const budgetLimit = financeScope === 'combined' ? Number(budget?.total_limit || 0) : 0
  const budgetRemaining = budgetLimit > 0 ? budgetLimit - monthTotal : null
  const budgetUsedPct = budgetLimit > 0 ? clamp((monthTotal / budgetLimit) * 100) : 0

  const anomalies = useMemo(
    () => (expenses || []).filter((row) =>
      !row.category_id || (row.is_settlement_target && (!row.expense_splits || row.expense_splits.length === 0))
    ),
    [expenses]
  )

  const recentUpdates = useMemo(
    () => [...(expenses || [])]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6),
    [expenses]
  )

  const categoryById = useMemo(
    () => new Map((categories || []).map((category) => [category.id, category])),
    [categories]
  )

  const rootCategoryId = (categoryId: string) => {
    let current = categoryById.get(categoryId)
    const seen = new Set<string>()
    while (current?.parent_category_id && !seen.has(current.id)) {
      seen.add(current.id)
      current = categoryById.get(current.parent_category_id)
    }
    return current?.id || categoryId
  }

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, { id: string; name: string; icon: string | null; amount: number }>()
    for (const row of scopedExpenses) {
      const id = row.category_id
      if (!id) continue
      const rootId = rootCategoryId(id)
      const category = categoryById.get(rootId)
      const current = totals.get(rootId) || {
        id: rootId,
        name: category?.name || row.expense_categories?.name || 'その他',
        icon: category?.icon || null,
        amount: 0,
      }
      current.amount += Number(row.amount)
      totals.set(rootId, current)
    }
    return Array.from(totals.values()).sort((a, b) => b.amount - a.amount)
  }, [categoryById, scopedExpenses])

  const navigateMonth = (direction: number) => {
    setSelectedMonth(format(addMonths(displayDate, direction), 'yyyy-MM'))
  }

  const settlementDirection = settlement && settlement.amount > 0
    ? `${displayPerson(settlement.from_user, user, partner)} → ${displayPerson(settlement.to_user, user, partner)}`
    : '精算なし'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">今の家計</h1>
            <Badge variant="outline" className="gap-1">
              <Bot className="h-3 w-3" />
              ChatGPT連携
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {FINANCE_SCOPE_LABELS[financeScope]}の現在地。入力ではなく、確認と判断のための画面です。
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border bg-card px-1 py-1">
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[92px] text-center text-sm font-semibold">{format(displayDate, 'yyyy/MM')}</span>
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card tone="navy">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">今月の支出</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatYen(monthTotal)}</div>
            <p className="mt-1 text-xs text-muted-foreground">{scopedExpenses.length}件をリアルタイム集計</p>
          </CardContent>
        </Card>

        <Card tone="cyan">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">あと使える額</CardTitle>
            <Scale className="h-4 w-4 text-[var(--color-info)]" />
          </CardHeader>
          <CardContent>
            {budgetRemaining !== null ? (
              <>
                <div className={budgetRemaining < 0 ? 'text-3xl font-bold text-destructive' : 'text-3xl font-bold'}>
                  {formatYen(budgetRemaining)}
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${budgetUsedPct}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">予算 {formatYen(budgetLimit)} の {budgetUsedPct.toFixed(0)}% 使用</p>
              </>
            ) : (
              <>
                <div className="text-xl font-semibold">予算未設定</div>
                <p className="mt-1 text-xs text-muted-foreground">2人合計表示で月次予算を設定すると表示されます</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card tone="blue">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">今日の支出</CardTitle>
            <ReceiptText className="h-4 w-4 text-[var(--color-expense)]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatYen(todayTotal)}</div>
            <p className="mt-1 text-xs text-muted-foreground">{todayKey}</p>
          </CardContent>
        </Card>

        <Card tone="cyan">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">今月の精算</CardTitle>
            <Scale className="h-4 w-4 text-[var(--color-info)]" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold text-muted-foreground">{settlementDirection}</div>
            <div className="mt-1 text-3xl font-bold">{formatYen(settlement?.amount || 0)}</div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{settlement?.expense_count || 0}件 / 対象 {formatYen(settlement?.gross_amount || 0)}</span>
              <Link href="/finance/settlements" className="inline-flex items-center gap-1 font-medium text-primary">
                詳細 <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {anomalies.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-500/10 p-2 text-amber-700">
                <CircleAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">要確認 {anomalies.length}件</p>
                <p className="text-sm text-muted-foreground">カテゴリ未設定、または精算split不足のデータがあります。</p>
              </div>
            </div>
            <Link href="/finance/expenses">
              <Button variant="outline" size="sm">履歴で確認</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>今月の支出内訳</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">親カテゴリへ集約した現在の構成</p>
            </div>
            <Link href="/finance/analysis" className="text-sm font-medium text-primary">分析を見る</Link>
          </CardHeader>
          <CardContent>
            {categoryTotals.length > 0 ? (
              <div className="space-y-4">
                {categoryTotals.slice(0, 8).map((row) => {
                  const pct = monthTotal > 0 ? (row.amount / monthTotal) * 100 : 0
                  return (
                    <div key={row.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2 font-medium">
                          <span>{row.icon || '•'}</span>
                          <span className="truncate">{row.name}</span>
                        </span>
                        <span className="shrink-0 font-semibold">{formatYen(row.amount)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${clamp(pct)}%` }} />
                      </div>
                      <p className="text-right text-[11px] text-muted-foreground">{pct.toFixed(0)}%</p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">この月の支出はまだありません。</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>最近の更新</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">ChatGPTや手入力から反映された直近の記録</p>
            </div>
            <Link href="/finance/expenses" className="text-sm font-medium text-primary">すべて見る</Link>
          </CardHeader>
          <CardContent>
            {recentUpdates.length > 0 ? (
              <div className="divide-y">
                {recentUpdates.map((row) => {
                  const isAi = row.source === 'chatgpt'
                  const partnerShare = row.expense_splits?.find((split) => split.user_id === partner?.id)
                  return (
                    <div key={row.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold">{row.description || row.expense_categories?.name || '支出'}</p>
                          {isAi && (
                            <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]">
                              <Bot className="h-3 w-3" /> AI
                            </Badge>
                          )}
                          {row.is_settlement_target && (
                            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">精算対象</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.expense_date} · {row.expense_categories?.name || '未分類'} · {displayPerson(row.paid_by, user, partner)}支払い
                        </p>
                        {row.is_settlement_target && partnerShare && (
                          <p className="mt-1 text-xs text-muted-foreground">{partner?.display_name || 'パートナー'}負担 {formatYen(Number(partnerShare.amount || 0))}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold">{formatYen(Number(row.amount))}</p>
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3" /> 反映済み
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">まだ更新はありません。</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
