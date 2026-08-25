'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { addMonths, format } from 'date-fns'
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileUp,
  ReceiptText,
  Scale,
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
import { useExpenses, useYearExpenseHistory } from '@/lib/hooks/use-expenses'
import { useIncomes, useYearIncomeHistory } from '@/lib/hooks/use-incomes'
import { useMonthlySettlementPreview } from '@/lib/hooks/use-settlements'
import { useFinanceStore } from '@/stores/finance-store'

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

function formatSignedYen(value: number) {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${formatYen(Math.abs(value))}`
}

function formatDelta(value: number, previous: number) {
  if (previous === 0) return value === 0 ? '前月と同じ' : '前月データなし'
  const ratio = ((value - previous) / previous) * 100
  const sign = ratio >= 0 ? '+' : ''
  return `前月比 ${sign}${ratio.toFixed(1)}%`
}

function sumAmount<T extends { amount: number | string }>(rows: T[]) {
  return rows.reduce((sum, row) => sum + Number(row.amount), 0)
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
  const [year, month] = selectedMonth.split('-').map(Number)
  const displayDate = new Date(year, month - 1, 1)
  const previousMonth = format(addMonths(displayDate, -1), 'yyyy-MM')
  const selectedYear = Number(selectedMonth.slice(0, 4))
  const todayKey = getTodayJstDateKey()

  const { data: expenses } = useExpenses(couple?.id, selectedMonth)
  const { data: incomes } = useIncomes(couple?.id, selectedMonth)
  const { data: previousExpenses } = useExpenses(couple?.id, previousMonth)
  const { data: previousIncomes } = useIncomes(couple?.id, previousMonth)
  const { data: yearExpenses } = useYearExpenseHistory(couple?.id, selectedYear)
  const { data: yearIncomes } = useYearIncomeHistory(couple?.id, selectedYear)
  const { data: categories } = useExpenseCategories(couple?.id)
  const { data: budget } = useBudget(couple?.id, selectedMonth)
  const { data: settlement } = useMonthlySettlementPreview(user?.id, selectedMonth)
  const [categoryPath, setCategoryPath] = useState<string[]>([])

  const scopedExpenses = useMemo(
    () => filterByFinanceScope(expenses || [], financeScope, user?.id, partner?.id, (row) => row.paid_by),
    [expenses, financeScope, partner?.id, user?.id]
  )
  const scopedIncomes = useMemo(
    () => filterByFinanceScope(incomes || [], financeScope, user?.id, partner?.id, (row) => row.user_id),
    [financeScope, incomes, partner?.id, user?.id]
  )
  const scopedPreviousExpenses = useMemo(
    () => filterByFinanceScope(previousExpenses || [], financeScope, user?.id, partner?.id, (row) => row.paid_by),
    [financeScope, partner?.id, previousExpenses, user?.id]
  )
  const scopedPreviousIncomes = useMemo(
    () => filterByFinanceScope(previousIncomes || [], financeScope, user?.id, partner?.id, (row) => row.user_id),
    [financeScope, partner?.id, previousIncomes, user?.id]
  )
  const scopedYearExpenses = useMemo(
    () => filterByFinanceScope(yearExpenses || [], financeScope, user?.id, partner?.id, (row) => row.paid_by),
    [financeScope, partner?.id, user?.id, yearExpenses]
  )
  const scopedYearIncomes = useMemo(
    () => filterByFinanceScope(yearIncomes || [], financeScope, user?.id, partner?.id, (row) => row.user_id),
    [financeScope, partner?.id, user?.id, yearIncomes]
  )

  const monthExpense = useMemo(() => sumAmount(scopedExpenses), [scopedExpenses])
  const monthIncome = useMemo(() => sumAmount(scopedIncomes), [scopedIncomes])
  const monthBalance = monthIncome - monthExpense
  const previousExpense = useMemo(() => sumAmount(scopedPreviousExpenses), [scopedPreviousExpenses])
  const previousIncome = useMemo(() => sumAmount(scopedPreviousIncomes), [scopedPreviousIncomes])
  const yearExpense = useMemo(() => sumAmount(scopedYearExpenses), [scopedYearExpenses])
  const yearIncome = useMemo(() => sumAmount(scopedYearIncomes), [scopedYearIncomes])
  const yearBalance = yearIncome - yearExpense

  const todayTotal = useMemo(
    () => scopedExpenses.filter((row) => row.expense_date === todayKey).reduce((sum, row) => sum + Number(row.amount), 0),
    [scopedExpenses, todayKey]
  )
  const sharedExpense = useMemo(
    () => scopedExpenses.filter((row) => row.expense_type === 'shared').reduce((sum, row) => sum + Number(row.amount), 0),
    [scopedExpenses]
  )
  const personalExpense = useMemo(
    () => scopedExpenses.filter((row) => row.expense_type === 'personal').reduce((sum, row) => sum + Number(row.amount), 0),
    [scopedExpenses]
  )
  const settlementRows = useMemo(() => scopedExpenses.filter((row) => row.is_settlement_target), [scopedExpenses])
  const settlementTarget = useMemo(() => sumAmount(settlementRows), [settlementRows])

  const budgetLimit = financeScope === 'combined' ? Number(budget?.total_limit || 0) : 0
  const budgetRemaining = budgetLimit > 0 ? budgetLimit - monthExpense : null
  const budgetUsedPct = budgetLimit > 0 ? clamp((monthExpense / budgetLimit) * 100) : 0

  const anomalies = useMemo(
    () => (expenses || []).filter((row) => !row.category_id || (row.is_settlement_target && (!row.expense_splits || row.expense_splits.length === 0))),
    [expenses]
  )
  const recentUpdates = useMemo(
    () => [...scopedExpenses].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()).slice(0, 4),
    [scopedExpenses]
  )

  const categoryById = useMemo(
    () => new Map((categories || []).map((category) => [category.id, category])),
    [categories]
  )
  const selectedCategoryId = categoryPath[categoryPath.length - 1] || null
  const selectedCategoryHasChildren = useMemo(
    () => Boolean(selectedCategoryId && (categories || []).some((category) => category.parent_category_id === selectedCategoryId)),
    [categories, selectedCategoryId]
  )
  const categoryBreadcrumb = categoryPath.map((id) => categoryById.get(id)?.name).filter(Boolean).join(' / ')

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
          const current = totals.get('uncategorized') || { id: null, name: '未分類', icon: null, amount: 0, hasChildren: false }
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
      const current = totals.get(key) || { id: bucketId, name: bucketName, icon: bucketIcon, amount: 0, hasChildren: bucketHasChildren }
      current.amount += amount
      totals.set(key, current)
    }

    return Array.from(totals.values()).sort((a, b) => b.amount - a.amount)
  }, [categories, categoryById, scopedExpenses, selectedCategoryId])

  const categoryViewTotal = categoryRows.reduce((sum, row) => sum + row.amount, 0)

  const selectedCategoryTransactions = useMemo(() => {
    if (!selectedCategoryId || selectedCategoryHasChildren) return []
    return scopedExpenses
      .filter((expense) => expense.category_id === selectedCategoryId)
      .sort((a, b) => {
        const dateDiff = b.expense_date.localeCompare(a.expense_date)
        return dateDiff !== 0 ? dateDiff : Number(b.amount) - Number(a.amount)
      })
  }, [scopedExpenses, selectedCategoryHasChildren, selectedCategoryId])

  const selectedCategoryTotal = selectedCategoryTransactions.reduce((sum, expense) => sum + Number(expense.amount), 0)

  const topRootCategory = useMemo(() => {
    const totals = new Map<string, number>()
    for (const expense of scopedExpenses) {
      if (!expense.category_id) continue
      let current = categoryById.get(expense.category_id)
      const seen = new Set<string>()
      while (current?.parent_category_id && !seen.has(current.id)) {
        seen.add(current.id)
        current = categoryById.get(current.parent_category_id)
      }
      const name = current?.name || expense.expense_categories?.name || '未分類'
      totals.set(name, (totals.get(name) || 0) + Number(expense.amount))
    }
    return Array.from(totals.entries()).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount)[0] || null
  }, [categoryById, scopedExpenses])

  const reviewNotes = useMemo(() => {
    const notes: string[] = []
    if (previousExpense > 0) {
      const diff = monthExpense - previousExpense
      notes.push(`支出は前月より${formatYen(Math.abs(diff))}${diff >= 0 ? '増加' : '減少'}。`)
    }
    if (topRootCategory) notes.push(`最大カテゴリは「${topRootCategory.name}」で${formatYen(topRootCategory.amount)}。`)
    if (settlementRows.length > 0) notes.push(`精算対象は${settlementRows.length}件、${formatYen(settlementTarget)}。`)
    return notes
  }, [monthExpense, previousExpense, settlementRows.length, settlementTarget, topRootCategory])

  const navigateMonth = (direction: number) => {
    setSelectedMonth(format(addMonths(displayDate, direction), 'yyyy-MM'))
    setCategoryPath([])
  }

  const settlementDirection = settlement && settlement.amount > 0
    ? `${displayPerson(settlement.from_user, user, partner)} → ${displayPerson(settlement.to_user, user, partner)}`
    : '精算なし'

  const monthBalanceTextTone = monthBalance > 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : monthBalance < 0
      ? 'text-destructive'
      : 'text-foreground'

  const yearBalanceTone = yearBalance > 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : yearBalance < 0
      ? 'text-destructive'
      : 'text-foreground'

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-full px-2.5 font-semibold">家計</Badge>
            <span className="truncate text-xs font-medium text-muted-foreground">{FINANCE_SCOPE_LABELS[financeScope]}</span>
          </div>
          <h1 className="mt-2 text-xl font-bold tracking-tight md:text-2xl">{format(displayDate, 'yyyy年M月')}</h1>
        </div>
        <div className="flex shrink-0 items-center rounded-full bg-muted p-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[64px] text-center text-xs font-bold">{format(displayDate, 'yyyy/MM')}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden rounded-3xl border bg-card shadow-none">
        <CardContent className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">今月の支出</p>
              <p className="mt-2 text-4xl font-black tracking-tight tabular-nums md:text-5xl">{formatYen(monthExpense)}</p>
            </div>
            <Link href="/finance/expenses" className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
              履歴を見る
            </Link>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-muted-foreground">
            <span>{formatDelta(monthExpense, previousExpense)}</span>
            <span>収入 {formatYen(monthIncome)}</span>
            <span className={monthBalanceTextTone}>収支 {formatSignedYen(monthBalance)}</span>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-muted/60 px-3 py-3">
              <p className="text-[11px] font-medium text-muted-foreground">共有</p>
              <p className="mt-1 truncate text-base font-bold tabular-nums">{formatYen(sharedExpense)}</p>
            </div>
            <div className="rounded-2xl bg-muted/60 px-3 py-3">
              <p className="text-[11px] font-medium text-muted-foreground">個人</p>
              <p className="mt-1 truncate text-base font-bold tabular-nums">{formatYen(personalExpense)}</p>
            </div>
            <div className="rounded-2xl bg-muted/60 px-3 py-3">
              <p className="text-[11px] font-medium text-muted-foreground">今日</p>
              <p className="mt-1 truncate text-base font-bold tabular-nums">{formatYen(todayTotal)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-3xl border bg-card shadow-none">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-muted-foreground">予算残</p>
              <Link href="/finance/budgets" className="text-[11px] font-semibold text-primary">設定</Link>
            </div>
            {budgetRemaining !== null ? (
              <>
                <p className={budgetRemaining < 0 ? 'mt-2 text-xl font-black tabular-nums text-destructive' : 'mt-2 text-xl font-black tabular-nums'}>{formatYen(budgetRemaining)}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${budgetUsedPct}%` }} />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">{budgetUsedPct.toFixed(0)}% 使用</p>
              </>
            ) : (
              <><p className="mt-2 text-xl font-black">未設定</p><p className="mt-2 text-[11px] text-muted-foreground">月次予算を設定</p></>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border bg-card shadow-none">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-muted-foreground">今月の精算</p>
              <Link href="/finance/settlements" aria-label="精算を確認" className="text-primary"><Scale className="h-4 w-4" /></Link>
            </div>
            <p className="mt-2 text-xl font-black tabular-nums">{formatYen(settlement?.amount || 0)}</p>
            <p className="mt-2 truncate text-[11px] font-medium text-muted-foreground">{settlementDirection}</p>
            {settlement?.expense_count ? <p className="mt-1 text-[11px] text-muted-foreground">対象 {settlement.expense_count}件</p> : null}
          </CardContent>
        </Card>
      </div>

      {anomalies.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-amber-500/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <CircleAlert className="h-4 w-4 shrink-0 text-amber-700" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">要確認 {anomalies.length}件</p>
              <p className="truncate text-xs text-muted-foreground">カテゴリまたは精算情報を確認</p>
            </div>
          </div>
          <Link href="/finance/expenses" className="shrink-0 text-xs font-bold text-primary">確認</Link>
        </div>
      )}

      <Card className="overflow-hidden rounded-3xl border bg-card shadow-none">
        <CardHeader className="border-b px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base">支出の内訳</CardTitle>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {categoryBreadcrumb ? `${categoryBreadcrumb}${selectedCategoryId && !selectedCategoryHasChildren ? ' / 明細' : ''}` : 'タップして内訳を見る'}
              </p>
            </div>
            {categoryPath.length > 0 && (
              <Button variant="ghost" size="sm" className="shrink-0 rounded-full px-2.5" onClick={() => setCategoryPath((current) => current.slice(0, -1))}>
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />戻る
              </Button>
            )}
          </div>
          {selectedCategoryId && !selectedCategoryHasChildren && selectedCategoryTransactions.length > 0 && (
            <div className="mt-3 flex items-baseline justify-between rounded-2xl bg-muted/60 px-3 py-2.5">
              <span className="text-xs font-medium text-muted-foreground">{selectedCategoryTransactions.length}件</span>
              <span className="text-lg font-black tabular-nums">{formatYen(selectedCategoryTotal)}</span>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {selectedCategoryId && !selectedCategoryHasChildren ? (
            selectedCategoryTransactions.length > 0 ? (
              <div className="divide-y">
                {selectedCategoryTransactions.map((expense) => (
                  <div key={expense.id} className="flex items-center gap-3 px-5 py-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-muted text-xs font-bold text-muted-foreground">
                      {expense.expense_date.slice(8, 10)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{expense.description || expense.expense_categories?.name || '支出'}</p>
                        {expense.is_settlement_target && <Badge variant="secondary" className="shrink-0 rounded-full px-1.5 py-0 text-[9px]">精算</Badge>}
                      </div>
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
                        {expense.expense_date.slice(5).replace('-', '/')} · {displayPerson(expense.paid_by, user, partner)}支払い
                        {expense.source === 'chatgpt' ? ' · AI登録' : ''}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-black tabular-nums">{formatYen(Number(expense.amount))}</p>
                  </div>
                ))}
              </div>
            ) : <p className="py-10 text-center text-sm text-muted-foreground">このカテゴリの支出はありません。</p>
          ) : categoryRows.length > 0 ? (
            <div className="divide-y">
              {categoryRows.slice(0, 10).map((row, index) => {
                const pct = categoryViewTotal > 0 ? (row.amount / categoryViewTotal) * 100 : 0
                const content = (
                  <div className="flex items-center gap-3 px-5 py-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-sm font-bold text-muted-foreground">
                      {row.icon || index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold">{row.name}</span>
                        <span className="shrink-0 text-sm font-black tabular-nums">{formatYen(row.amount)}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-9 text-right text-[11px] font-semibold text-muted-foreground">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    {row.id && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  </div>
                )
                return row.id ? (
                  <button key={row.id} type="button" className="block w-full text-left transition-colors hover:bg-muted/40 active:bg-muted/60" onClick={() => setCategoryPath((current) => [...current, row.id!])}>
                    {content}
                  </button>
                ) : <div key={row.name}>{content}</div>
              })}
            </div>
          ) : <p className="py-10 text-center text-sm text-muted-foreground">支出データがありません。</p>}
        </CardContent>
      </Card>

      {reviewNotes.length > 0 && (
        <div className="rounded-3xl bg-muted/45 p-4">
          <p className="text-xs font-bold text-muted-foreground">今月のポイント</p>
          <div className="mt-3 space-y-2">
            {reviewNotes.map((note) => <p key={note} className="text-sm font-medium leading-6">{note}</p>)}
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="rounded-3xl border bg-card shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold">{selectedYear}年 累計</p>
              <span className={`text-sm font-bold tabular-nums ${yearBalanceTone}`}>{formatSignedYen(yearBalance)}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div><p className="text-[11px] text-muted-foreground">収入</p><p className="mt-1 text-base font-bold tabular-nums">{formatYen(yearIncome)}</p></div>
              <div><p className="text-[11px] text-muted-foreground">支出</p><p className="mt-1 text-base font-bold tabular-nums">{formatYen(yearExpense)}</p></div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border bg-card shadow-none">
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-5 py-4">
              <p className="text-sm font-bold">最近の支出</p>
              <Link href="/finance/expenses" className="text-xs font-bold text-primary">すべて</Link>
            </div>
            {recentUpdates.length > 0 ? (
              <div className="divide-y border-t">
                {recentUpdates.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-semibold">{expense.description || expense.expense_categories?.name || '支出'}</p>
                        {expense.source === 'chatgpt' && <Bot className="h-3 w-3 shrink-0 text-muted-foreground" />}
                      </div>
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{expense.expense_date} · {expense.expense_categories?.name || '未分類'}</p>
                    </div>
                    <p className="shrink-0 text-xs font-bold tabular-nums">{formatYen(Number(expense.amount))}</p>
                  </div>
                ))}
              </div>
            ) : <p className="px-5 pb-5 text-xs text-muted-foreground">まだ支出はありません。</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Link href="/finance/expenses" className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-muted/55 px-2 py-3 text-xs font-semibold transition-colors hover:bg-muted">
          <ReceiptText className="h-4 w-4" /><span>履歴</span>
        </Link>
        <Link href="/finance/settlements" className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-muted/55 px-2 py-3 text-xs font-semibold transition-colors hover:bg-muted">
          <Scale className="h-4 w-4" /><span>精算</span>
        </Link>
        <Link href="/finance/import" className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-muted/55 px-2 py-3 text-xs font-semibold transition-colors hover:bg-muted">
          <FileUp className="h-4 w-4" /><span>CSV</span>
        </Link>
      </div>
    </div>
  )
}
