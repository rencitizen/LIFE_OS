'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { addMonths, format } from 'date-fns'
import {
  ArrowRight,
  Bot,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileUp,
  ReceiptText,
  Scale,
  Sparkles,
  WalletCards,
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
import { useIncomes } from '@/lib/hooks/use-incomes'
import { useMonthlySettlementPreview } from '@/lib/hooks/use-settlements'
import { useFinanceStore } from '@/stores/finance-store'

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

function formatSignedYen(value: number) {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${formatYen(Math.abs(value))}`
}

function displayPerson(
  id: string | null,
  user?: { id: string; display_name: string } | null,
  partner?: { id: string; display_name: string } | null
) {
  if (!id) return '—'
  if (user?.id === id) return user.display_name
  if (partner?.id === id) return partner.display_name
  return 'メンバー'
}

type CategoryViewRow = {
  id: string | null
  name: string
  icon: string | null
  amount: number
  hasChildren: boolean
}

export default function FinanceDashboardPage() {
  const { couple, user, partner } = useAuth()
  const { selectedMonth, setSelectedMonth, financeScope } = useFinanceStore()
  const { data: expenses } = useExpenses(couple?.id, selectedMonth)
  const { data: incomes } = useIncomes(couple?.id, selectedMonth)
  const { data: categories } = useExpenseCategories(couple?.id)
  const { data: budget } = useBudget(couple?.id, selectedMonth)
  const { data: settlement } = useMonthlySettlementPreview(user?.id, selectedMonth)
  const [categoryPath, setCategoryPath] = useState<string[]>([])

  const [year, month] = selectedMonth.split('-').map(Number)
  const displayDate = new Date(year, month - 1, 1)
  const todayKey = getTodayJstDateKey()

  const scopedExpenses = useMemo(
    () => filterByFinanceScope(expenses || [], financeScope, user?.id, partner?.id, (row) => row.paid_by),
    [expenses, financeScope, partner?.id, user?.id]
  )

  const scopedIncomes = useMemo(
    () => filterByFinanceScope(incomes || [], financeScope, user?.id, partner?.id, (row) => row.user_id),
    [financeScope, incomes, partner?.id, user?.id]
  )

  const monthExpense = useMemo(
    () => scopedExpenses.reduce((sum, row) => sum + Number(row.amount), 0),
    [scopedExpenses]
  )

  const monthIncome = useMemo(
    () => scopedIncomes.reduce((sum, row) => sum + Number(row.amount), 0),
    [scopedIncomes]
  )

  const monthBalance = monthIncome - monthExpense

  const todayTotal = useMemo(
    () => scopedExpenses
      .filter((row) => row.expense_date === todayKey)
      .reduce((sum, row) => sum + Number(row.amount), 0),
    [scopedExpenses, todayKey]
  )

  const sharedExpense = useMemo(
    () => scopedExpenses
      .filter((row) => row.expense_type === 'shared')
      .reduce((sum, row) => sum + Number(row.amount), 0),
    [scopedExpenses]
  )

  const personalExpense = useMemo(
    () => scopedExpenses
      .filter((row) => row.expense_type === 'personal')
      .reduce((sum, row) => sum + Number(row.amount), 0),
    [scopedExpenses]
  )

  const budgetLimit = financeScope === 'combined' ? Number(budget?.total_limit || 0) : 0
  const budgetRemaining = budgetLimit > 0 ? budgetLimit - monthExpense : null
  const budgetUsedPct = budgetLimit > 0 ? clamp((monthExpense / budgetLimit) * 100) : 0

  const anomalies = useMemo(
    () => (expenses || []).filter((row) =>
      !row.category_id || (row.is_settlement_target && (!row.expense_splits || row.expense_splits.length === 0))
    ),
    [expenses]
  )

  const recentUpdates = useMemo(
    () => [...scopedExpenses]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 6),
    [scopedExpenses]
  )

  const categoryById = useMemo(
    () => new Map((categories || []).map((category) => [category.id, category])),
    [categories]
  )
  const selectedCategoryId = categoryPath[categoryPath.length - 1] || null
  const categoryBreadcrumb = categoryPath
    .map((id) => categoryById.get(id)?.name)
    .filter(Boolean)
    .join(' / ')

  const categoryRows = useMemo<CategoryViewRow[]>(() => {
    const categoryList = categories || []
    const totals = new Map<string, CategoryViewRow>()

    const hasChildren = (categoryId: string) => categoryList.some((category) => category.parent_category_id === categoryId)

    const rootCategoryId = (categoryId: string) => {
      let current = categoryById.get(categoryId)
      const seen = new Set<string>()
      while (current?.parent_category_id && !seen.has(current.id)) {
        seen.add(current.id)
        current = categoryById.get(current.parent_category_id)
      }
      return current?.id || categoryId
    }

    const directChildBelow = (categoryId: string, ancestorId: string) => {
      let current = categoryById.get(categoryId)
      const seen = new Set<string>()
      while (current && !seen.has(current.id)) {
        seen.add(current.id)
        if (current.parent_category_id === ancestorId) return current.id
        if (!current.parent_category_id) return null
        current = categoryById.get(current.parent_category_id)
      }
      return null
    }

    const isDescendantOrSelf = (categoryId: string, ancestorId: string) => {
      if (categoryId === ancestorId) return true
      let current = categoryById.get(categoryId)
      const seen = new Set<string>()
      while (current?.parent_category_id && !seen.has(current.id)) {
        seen.add(current.id)
        if (current.parent_category_id === ancestorId) return true
        current = categoryById.get(current.parent_category_id)
      }
      return false
    }

    for (const expense of scopedExpenses) {
      const categoryId = expense.category_id
      const amount = Number(expense.amount)

      if (!categoryId || !categoryById.has(categoryId)) {
        if (!selectedCategoryId) {
          const current = totals.get('uncategorized') || {
            id: null,
            name: '未分類',
            icon: null,
            amount: 0,
            hasChildren: false,
          }
          current.amount += amount
          totals.set('uncategorized', current)
        }
        continue
      }

      let bucketId: string | null = null
      let bucketName = ''
      let bucketIcon: string | null = null
      let bucketHasChildren = false

      if (!selectedCategoryId) {
        bucketId = rootCategoryId(categoryId)
        const category = categoryById.get(bucketId)
        bucketName = category?.name || expense.expense_categories?.name || 'その他'
        bucketIcon = category?.icon || null
        bucketHasChildren = hasChildren(bucketId)
      } else {
        if (!isDescendantOrSelf(categoryId, selectedCategoryId)) continue

        if (categoryId === selectedCategoryId) {
          const selected = categoryById.get(selectedCategoryId)
          bucketId = null
          bucketName = `${selected?.name || 'カテゴリ'}（直下）`
          bucketIcon = selected?.icon || null
        } else {
          bucketId = directChildBelow(categoryId, selectedCategoryId)
          const category = bucketId ? categoryById.get(bucketId) : null
          bucketName = category?.name || 'その他'
          bucketIcon = category?.icon || null
          bucketHasChildren = Boolean(bucketId && hasChildren(bucketId))
        }
      }

      const key = bucketId || `direct:${selectedCategoryId || 'root'}`
      const current = totals.get(key) || {
        id: bucketId,
        name: bucketName,
        icon: bucketIcon,
        amount: 0,
        hasChildren: bucketHasChildren,
      }
      current.amount += amount
      totals.set(key, current)
    }

    return Array.from(totals.values()).sort((a, b) => b.amount - a.amount)
  }, [categories, categoryById, scopedExpenses, selectedCategoryId])

  const categoryViewTotal = categoryRows.reduce((sum, row) => sum + row.amount, 0)

  const navigateMonth = (direction: number) => {
    setSelectedMonth(format(addMonths(displayDate, direction), 'yyyy-MM'))
    setCategoryPath([])
  }

  const settlementDirection = settlement && settlement.amount > 0
    ? `${displayPerson(settlement.from_user, user, partner)} → ${displayPerson(settlement.to_user, user, partner)}`
    : '精算なし'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline">家計</Badge>
            <span className="text-sm text-muted-foreground">{FINANCE_SCOPE_LABELS[financeScope]}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{format(displayDate, 'yyyy/MM')} の家計</h1>
          <p className="mt-1 text-sm text-muted-foreground">収支、予算、精算、支出の内訳をここでまとめて確認します。</p>
        </div>

        <div className="flex items-center rounded-lg border bg-background p-0.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[84px] text-center text-sm font-semibold">{format(displayDate, 'yyyy/MM')}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card tone="blue" className="overflow-hidden">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">今月の収支</p>
                <p className="mt-2 text-4xl font-bold tracking-tight md:text-5xl">{formatSignedYen(monthBalance)}</p>
                <p className="mt-2 text-xs text-muted-foreground">登録済み収入 − 支出</p>
              </div>
              <Link href="/finance/analysis" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                月次レビュー <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border bg-background/70 p-4">
                <p className="text-xs text-muted-foreground">収入</p>
                <p className="mt-1 text-xl font-bold text-[var(--color-income)]">{formatYen(monthIncome)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{scopedIncomes.length}件を反映</p>
              </div>
              <div className="rounded-xl border bg-background/70 p-4">
                <p className="text-xs text-muted-foreground">支出</p>
                <p className="mt-1 text-xl font-bold text-[var(--color-expense)]">{formatYen(monthExpense)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{scopedExpenses.length}件を反映</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">今月の予算</CardTitle>
              <Link href="/finance/budgets" className="text-xs font-medium text-primary">設定</Link>
            </div>
          </CardHeader>
          <CardContent>
            {budgetRemaining !== null ? (
              <>
                <p className="text-xs text-muted-foreground">あと使える</p>
                <p className={budgetRemaining < 0 ? 'mt-1 text-3xl font-bold text-destructive' : 'mt-1 text-3xl font-bold'}>
                  {formatYen(budgetRemaining)}
                </p>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${budgetUsedPct}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>予算 {formatYen(budgetLimit)}</span>
                  <span>{budgetUsedPct.toFixed(0)}%</span>
                </div>
              </>
            ) : (
              <div className="py-2">
                <p className="text-xl font-semibold">予算未設定</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {financeScope === 'combined'
                    ? '月次予算を設定すると、残り金額と消化率がここに表示されます。'
                    : '予算は2人分の家計表示で確認できます。'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="text-xs text-muted-foreground">今日の支出</p>
              <p className="mt-1 text-xl font-bold">{formatYen(todayTotal)}</p>
            </div>
            <ReceiptText className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="text-xs text-muted-foreground">共有支出</p>
              <p className="mt-1 text-xl font-bold">{formatYen(sharedExpense)}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">個人 {formatYen(personalExpense)}</p>
            </div>
            <WalletCards className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="text-xs text-muted-foreground">今月の精算</p>
              <p className="mt-1 text-xl font-bold">{formatYen(settlement?.amount || 0)}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{settlementDirection}</p>
            </div>
            <Link href="/finance/settlements" aria-label="精算を確認" className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Scale className="h-5 w-5" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {anomalies.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <CircleAlert className="h-4 w-4 text-amber-700" />
            <div>
              <p className="text-sm font-semibold">要確認 {anomalies.length}件</p>
              <p className="text-xs text-muted-foreground">カテゴリ未設定、または精算情報が不足しています。</p>
            </div>
          </div>
          <Link href="/finance/expenses" className="text-xs font-medium text-primary">履歴で確認</Link>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">支出の内訳</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">{categoryBreadcrumb || 'カテゴリを押すと内訳を掘り下げられます'}</p>
              </div>
              <div className="flex items-center gap-2">
                {categoryPath.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setCategoryPath((current) => current.slice(0, -1))}>
                    <ChevronLeft className="mr-1 h-3.5 w-3.5" />戻る
                  </Button>
                )}
                <Link href="/finance/analysis" className="text-xs font-medium text-primary">レビュー</Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {categoryRows.length > 0 ? (
              <div className="space-y-4">
                {categoryRows.slice(0, 7).map((row) => {
                  const pct = categoryViewTotal > 0 ? (row.amount / categoryViewTotal) * 100 : 0
                  const content = (
                    <>
                      <div className="flex items-center justify-between gap-4">
                        <span className="min-w-0 truncate text-sm font-medium">{row.icon ? `${row.icon} ` : ''}{row.name}</span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{formatYen(row.amount)}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-10 text-right text-[11px] text-muted-foreground">{pct.toFixed(0)}%</span>
                      </div>
                    </>
                  )

                  if (row.id && row.hasChildren) {
                    return (
                      <button
                        key={row.id}
                        type="button"
                        className="block w-full rounded-lg p-1 text-left transition-colors hover:bg-muted/50"
                        onClick={() => setCategoryPath((current) => [...current, row.id!])}
                      >
                        {content}
                      </button>
                    )
                  }

                  return <div key={row.id || row.name} className="p-1">{content}</div>
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">支出データがありません。</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">最近の支出</CardTitle>
              <Link href="/finance/expenses" className="text-xs font-medium text-primary">すべて見る</Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentUpdates.length > 0 ? (
              <div className="divide-y">
                {recentUpdates.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{expense.description || expense.expense_categories?.name || '支出'}</p>
                        {expense.source === 'chatgpt' && (
                          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                            <Bot className="h-3 w-3" />AI
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {expense.expense_date} · {expense.expense_categories?.name || '未分類'}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">{formatYen(Number(expense.amount))}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">まだ支出はありません。</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">家計の操作</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Link href="/finance/expenses" className="group rounded-xl border p-4 transition-colors hover:bg-muted/50">
            <ReceiptText className="h-5 w-5 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">支出履歴</p>
            <p className="mt-1 text-xs text-muted-foreground">明細の確認・修正</p>
          </Link>
          <Link href="/finance/settlements" className="group rounded-xl border p-4 transition-colors hover:bg-muted/50">
            <Scale className="h-5 w-5 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">月次精算</p>
            <p className="mt-1 text-xs text-muted-foreground">2人の立替を精算</p>
          </Link>
          <Link href="/finance/analysis" className="group rounded-xl border p-4 transition-colors hover:bg-muted/50">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">月次レビュー</p>
            <p className="mt-1 text-xs text-muted-foreground">前月比較と支出分析</p>
          </Link>
          <Link href="/finance/import" className="group rounded-xl border p-4 transition-colors hover:bg-muted/50">
            <FileUp className="h-5 w-5 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">CSV取込</p>
            <p className="mt-1 text-xs text-muted-foreground">過去明細を追加</p>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
