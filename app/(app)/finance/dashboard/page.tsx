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
    () => [...scopedExpenses].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()).slice(0, 6),
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
    if (monthIncome > 0) notes.push(`月次収支は${monthBalance >= 0 ? '黒字' : '赤字'} ${formatYen(Math.abs(monthBalance))}。`)
    return notes
  }, [monthBalance, monthExpense, monthIncome, previousExpense, settlementRows.length, settlementTarget, topRootCategory])

  const navigateMonth = (direction: number) => {
    setSelectedMonth(format(addMonths(displayDate, direction), 'yyyy-MM'))
    setCategoryPath([])
  }

  const settlementDirection = settlement && settlement.amount > 0
    ? `${displayPerson(settlement.from_user, user, partner)} → ${displayPerson(settlement.to_user, user, partner)}`
    : '精算なし'

  const monthBalanceTone = monthBalance > 0
    ? 'bg-emerald-600 text-white'
    : monthBalance < 0
      ? 'bg-destructive text-destructive-foreground'
      : 'bg-muted text-foreground'

  const yearBalanceTone = yearBalance > 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : yearBalance < 0
      ? 'text-destructive'
      : 'text-foreground'

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary" className="font-semibold">家計</Badge>
            <span className="text-sm font-medium text-muted-foreground">{FINANCE_SCOPE_LABELS[financeScope]}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{format(displayDate, 'yyyy/MM')} の家計</h1>
        </div>
        <div className="flex items-center rounded-xl border-2 bg-card p-1 shadow-sm">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigateMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-[92px] text-center text-sm font-bold">{format(displayDate, 'yyyy/MM')}</span>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigateMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card className="overflow-hidden border-2 shadow-sm">
        <CardHeader className="border-b bg-muted/30 pb-4"><CardTitle className="text-base">今月のサマリー</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="grid md:grid-cols-3">
            <div className="border-b p-6 md:border-b-0 md:border-r md:p-7"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">収入</p><p className="mt-2 text-3xl font-black tracking-tight tabular-nums">{formatYen(monthIncome)}</p><p className="mt-2 text-xs font-medium text-muted-foreground">{formatDelta(monthIncome, previousIncome)}</p></div>
            <div className="border-b p-6 md:border-b-0 md:border-r md:p-7"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">支出</p><p className="mt-2 text-3xl font-black tracking-tight tabular-nums">{formatYen(monthExpense)}</p><p className="mt-2 text-xs font-medium text-muted-foreground">{formatDelta(monthExpense, previousExpense)}</p></div>
            <div className={`p-6 md:p-7 ${monthBalanceTone}`}><p className="text-xs font-bold uppercase tracking-wide opacity-75">収支</p><p className="mt-2 text-3xl font-black tracking-tight tabular-nums">{formatSignedYen(monthBalance)}</p><p className="mt-2 text-xs opacity-75">収入 − 支出</p></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-2 shadow-sm"><CardContent className="p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold">今月の予算</p>{budgetRemaining !== null ? <><p className="mt-1 text-xs text-muted-foreground">あと使える</p><p className={budgetRemaining < 0 ? 'mt-1 text-3xl font-black tabular-nums text-destructive' : 'mt-1 text-3xl font-black tabular-nums'}>{formatYen(budgetRemaining)}</p></> : <><p className="mt-3 text-2xl font-black">未設定</p><p className="mt-1 text-xs text-muted-foreground">{financeScope === 'combined' ? '予算を設定すると残額を表示します。' : '予算は2人表示で確認できます。'}</p></>}</div><Link href="/finance/budgets" className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted">設定</Link></div>{budgetRemaining !== null && <div className="mt-5"><div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${budgetUsedPct}%` }} /></div><div className="mt-2 flex justify-between text-xs font-medium text-muted-foreground"><span>予算 {formatYen(budgetLimit)}</span><span>{budgetUsedPct.toFixed(0)}% 使用</span></div></div>}</CardContent></Card>
        <Card className="border-2 shadow-sm"><CardContent className="p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold">今月の精算</p><p className="mt-3 text-3xl font-black tabular-nums">{formatYen(settlement?.amount || 0)}</p><p className="mt-2 text-sm font-semibold text-muted-foreground">{settlementDirection}</p>{settlement?.expense_count ? <p className="mt-1 text-xs text-muted-foreground">対象 {settlement.expense_count}件</p> : null}</div><Link href="/finance/settlements" className="rounded-xl bg-foreground p-3 text-background" aria-label="精算を確認"><Scale className="h-5 w-5" /></Link></div></CardContent></Card>
      </div>

      <Card className="overflow-hidden"><CardContent className="p-0"><div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0"><div className="flex items-center justify-between p-5"><div><p className="text-xs font-semibold text-muted-foreground">今日の支出</p><p className="mt-1 text-2xl font-black tabular-nums">{formatYen(todayTotal)}</p></div><ReceiptText className="h-5 w-5 text-muted-foreground" /></div><div className="flex items-center justify-between p-5"><div><p className="text-xs font-semibold text-muted-foreground">共有支出</p><p className="mt-1 text-2xl font-black tabular-nums">{formatYen(sharedExpense)}</p></div><WalletCards className="h-5 w-5 text-muted-foreground" /></div><div className="p-5"><p className="text-xs font-semibold text-muted-foreground">個人支出</p><p className="mt-1 text-2xl font-black tabular-nums">{formatYen(personalExpense)}</p></div></div></CardContent></Card>

      {anomalies.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-amber-500/40 bg-amber-500/10 px-4 py-3"><div className="flex items-center gap-2.5"><CircleAlert className="h-5 w-5 text-amber-700" /><div><p className="text-sm font-bold">要確認 {anomalies.length}件</p><p className="text-xs text-muted-foreground">カテゴリまたは精算情報を確認してください。</p></div></div><Link href="/finance/expenses" className="text-xs font-bold text-primary">履歴で確認</Link></div>}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-2 shadow-sm">
          <CardHeader className="border-b pb-4">
            <div className="flex items-start justify-between gap-3">
              <div><CardTitle className="text-lg">支出の内訳</CardTitle><p className="mt-1 text-xs text-muted-foreground">{categoryBreadcrumb ? `${categoryBreadcrumb}${selectedCategoryId && !selectedCategoryHasChildren ? ' / 明細' : ''}` : '項目を押すと内訳を表示'}</p></div>
              {categoryPath.length > 0 && <Button variant="outline" size="sm" onClick={() => setCategoryPath((current) => current.slice(0, -1))}><ChevronLeft className="mr-1 h-3.5 w-3.5" />戻る</Button>}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {selectedCategoryId && !selectedCategoryHasChildren ? (
              selectedCategoryTransactions.length > 0 ? (
                <div className="divide-y">
                  {selectedCategoryTransactions.map((expense) => (
                    <div key={expense.id} className="flex items-start justify-between gap-4 px-4 py-4 md:px-5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold">{expense.description || expense.expense_categories?.name || '支出'}</p>
                          {expense.is_settlement_target && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">精算対象</Badge>}
                          {expense.source === 'chatgpt' && <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"><Bot className="h-3 w-3" />AI</span>}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{expense.expense_date} · {displayPerson(expense.paid_by, user, partner)}支払い</p>
                      </div>
                      <p className="shrink-0 text-base font-black tabular-nums">{formatYen(Number(expense.amount))}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="py-10 text-center text-sm text-muted-foreground">このカテゴリの支出はありません。</p>
            ) : categoryRows.length > 0 ? (
              <div className="divide-y">
                {categoryRows.slice(0, 10).map((row, index) => {
                  const pct = categoryViewTotal > 0 ? (row.amount / categoryViewTotal) * 100 : 0
                  const content = (
                    <div className="p-4 md:p-5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-black text-muted-foreground">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate text-sm font-bold">{row.icon ? `${row.icon} ` : ''}{row.name}</span>
                            <div className="flex shrink-0 items-center gap-1.5"><span className="text-base font-black tabular-nums">{formatYen(row.amount)}</span>{row.id && <ChevronRight className="h-4 w-4 text-muted-foreground" />}</div>
                          </div>
                          <div className="mt-2 flex items-center gap-3"><div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div><span className="w-11 text-right text-xs font-bold text-muted-foreground">{pct.toFixed(0)}%</span></div>
                        </div>
                      </div>
                    </div>
                  )
                  return row.id ? <button key={row.id} type="button" className="block w-full text-left transition-colors hover:bg-muted/40" onClick={() => setCategoryPath((current) => [...current, row.id!])}>{content}</button> : <div key={row.name}>{content}</div>
                })}
              </div>
            ) : <p className="py-10 text-center text-sm text-muted-foreground">支出データがありません。</p>}
          </CardContent>
        </Card>

        <Card className="border-2 shadow-sm"><CardHeader className="border-b pb-4"><CardTitle className="text-lg">今月の要点</CardTitle></CardHeader><CardContent className="space-y-3 p-5">{reviewNotes.length > 0 ? reviewNotes.map((note) => <div key={note} className="rounded-xl bg-muted/50 p-4 text-sm font-medium leading-6">{note}</div>) : <p className="py-6 text-center text-sm text-muted-foreground">レビューできる実績がまだありません。</p>}<p className="text-xs leading-5 text-muted-foreground">さらに深く見るときは、この実績を元にChatGPTへ「今月どうだった？」と聞けば分析できます。</p></CardContent></Card>
      </div>

      <Card className="border-2 shadow-sm"><CardHeader className="border-b pb-4"><CardTitle className="text-lg">{selectedYear}年 累計</CardTitle></CardHeader><CardContent className="grid gap-0 p-0 sm:grid-cols-3"><div className="border-b p-5 sm:border-b-0 sm:border-r"><p className="text-xs font-semibold text-muted-foreground">年間収入</p><p className="mt-1 text-xl font-black tabular-nums">{formatYen(yearIncome)}</p></div><div className="border-b p-5 sm:border-b-0 sm:border-r"><p className="text-xs font-semibold text-muted-foreground">年間支出</p><p className="mt-1 text-xl font-black tabular-nums">{formatYen(yearExpense)}</p></div><div className="p-5"><p className="text-xs font-semibold text-muted-foreground">年間収支</p><p className={`mt-1 text-xl font-black tabular-nums ${yearBalanceTone}`}>{formatSignedYen(yearBalance)}</p></div></CardContent></Card>

      <Card className="border-2 shadow-sm"><CardHeader className="border-b pb-4"><div className="flex items-center justify-between gap-3"><CardTitle className="text-lg">最近の支出</CardTitle><Link href="/finance/expenses" className="text-xs font-bold text-primary">すべて見る</Link></div></CardHeader><CardContent className="p-0">{recentUpdates.length > 0 ? <div className="divide-y">{recentUpdates.map((expense) => <div key={expense.id} className="flex items-center justify-between gap-4 px-4 py-4 md:px-5"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-bold">{expense.description || expense.expense_categories?.name || '支出'}</p>{expense.source === 'chatgpt' && <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"><Bot className="h-3 w-3" />AI</span>}</div><p className="mt-1 text-xs font-medium text-muted-foreground">{expense.expense_date} · {expense.expense_categories?.name || '未分類'}</p></div><p className="shrink-0 text-base font-black tabular-nums">{formatYen(Number(expense.amount))}</p></div>)}</div> : <p className="py-10 text-center text-sm text-muted-foreground">まだ支出はありません。</p>}</CardContent></Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/finance/expenses" className="flex items-center gap-3 rounded-xl border-2 bg-card p-4 font-semibold shadow-sm transition-colors hover:bg-muted/40"><ReceiptText className="h-5 w-5" /><span>支出履歴</span></Link>
        <Link href="/finance/settlements" className="flex items-center gap-3 rounded-xl border-2 bg-card p-4 font-semibold shadow-sm transition-colors hover:bg-muted/40"><Scale className="h-5 w-5" /><span>月次精算</span></Link>
        <Link href="/finance/import" className="flex items-center gap-3 rounded-xl border-2 bg-card p-4 font-semibold shadow-sm transition-colors hover:bg-muted/40"><FileUp className="h-5 w-5" /><span>CSV取込</span></Link>
      </div>
    </div>
  )
}
