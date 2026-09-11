'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { addMonths, format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FINANCE_SCOPE_LABELS, filterByFinanceScope } from '@/lib/finance/scope'
import { formatYen } from '@/lib/finance/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useExpenseCategories } from '@/lib/hooks/use-categories'
import { useExpenses } from '@/lib/hooks/use-expenses'
import { useFinancePlanItems } from '@/lib/hooks/use-finance-plan'
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
  amount: number
  hasChildren: boolean
}

export default function FinanceDashboardPage() {
  const { couple, user, partner } = useAuth()
  const { selectedMonth, setSelectedMonth, financeScope } = useFinanceStore()
  const [year, month] = selectedMonth.split('-').map(Number)
  const displayDate = new Date(year, month - 1, 1)

  const { data: expenses } = useExpenses(couple?.id, selectedMonth)
  const { data: incomes } = useIncomes(couple?.id, selectedMonth)
  const { data: categories } = useExpenseCategories(couple?.id)
  const { data: settlement } = useMonthlySettlementPreview(user?.id, selectedMonth)
  const { data: financePlanItems } = useFinancePlanItems(couple?.id)

  const [categoryPath, setCategoryPath] = useState<string[]>([])

  const scopedExpenses = useMemo(
    () => filterByFinanceScope(expenses || [], financeScope, user?.id, partner?.id, (row) => row.paid_by),
    [expenses, financeScope, partner?.id, user?.id]
  )

  const scopedIncomes = useMemo(
    () => filterByFinanceScope(incomes || [], financeScope, user?.id, partner?.id, (row) => row.user_id),
    [financeScope, incomes, partner?.id, user?.id]
  )

  const monthExpense = useMemo(() => sumAmount(scopedExpenses), [scopedExpenses])
  const monthIncome = useMemo(() => sumAmount(scopedIncomes), [scopedIncomes])
  const monthBalance = monthIncome - monthExpense

  const settlementRows = useMemo(
    () => scopedExpenses.filter((row) => row.is_settlement_target),
    [scopedExpenses]
  )
  const settlementTarget = useMemo(() => sumAmount(settlementRows), [settlementRows])

  const monthlyInvestmentTotal = useMemo(
    () => (financePlanItems || [])
      .filter((item) => item.category === '資産形成' && item.status === 'active')
      .reduce((sum, item) => sum + Number(item.target_amount || 0), 0),
    [financePlanItems]
  )

  const categoryById = useMemo(
    () => new Map((categories || []).map((category) => [category.id, category])),
    [categories]
  )

  const selectedCategoryId = categoryPath[categoryPath.length - 1] || null
  const selectedCategoryHasChildren = useMemo(
    () => Boolean(
      selectedCategoryId
      && (categories || []).some((category) => category.parent_category_id === selectedCategoryId)
    ),
    [categories, selectedCategoryId]
  )

  const categoryRows = useMemo<CategoryViewRow[]>(() => {
    const categoryList = categories || []
    const totals = new Map<string, CategoryViewRow>()

    const hasChildren = (categoryId: string) =>
      categoryList.some((category) => category.parent_category_id === categoryId)

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
      let bucketHasChildren = false

      if (!selectedCategoryId) {
        bucketId = rootCategoryId(categoryId)
        const category = categoryById.get(bucketId)
        bucketName = category?.name || expense.expense_categories?.name || 'その他'
        bucketHasChildren = hasChildren(bucketId)
      } else {
        if (!isDescendantOrSelf(categoryId, selectedCategoryId)) continue

        if (categoryId === selectedCategoryId) {
          const selected = categoryById.get(selectedCategoryId)
          bucketName = `${selected?.name || 'カテゴリ'}（直下）`
        } else {
          bucketId = directChildBelow(categoryId, selectedCategoryId)
          const category = bucketId ? categoryById.get(bucketId) : null
          bucketName = category?.name || 'その他'
          bucketHasChildren = Boolean(bucketId && hasChildren(bucketId))
        }
      }

      const key = bucketId || `direct:${selectedCategoryId || 'root'}`
      const current = totals.get(key) || {
        id: bucketId,
        name: bucketName,
        amount: 0,
        hasChildren: bucketHasChildren,
      }
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

  const navigateMonth = (direction: number) => {
    setSelectedMonth(format(addMonths(displayDate, direction), 'yyyy-MM'))
    setCategoryPath([])
  }

  const settlementDirection = settlement && settlement.amount > 0
    ? `${displayPerson(settlement.from_user, user, partner)} → ${displayPerson(settlement.to_user, user, partner)}`
    : null

  return (
    <div className="mx-auto max-w-4xl pb-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{FINANCE_SCOPE_LABELS[financeScope]}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{format(displayDate, 'yyyy年M月')}</h1>
        </div>

        <div className="flex items-center gap-1 rounded-full bg-black/[0.04] p-1 dark:bg-white/[0.06]">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => navigateMonth(-1)}
            aria-label="前月"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[60px] text-center text-xs font-medium tabular-nums">
            {format(displayDate, 'yyyy/MM')}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => navigateMonth(1)}
            aria-label="翌月"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <section className="border-b border-black/[0.06] py-10 dark:border-white/[0.08]">
        <p className="text-sm font-medium text-muted-foreground">今月の収支</p>
        <p className="mt-2 text-4xl font-semibold tracking-[-0.04em] tabular-nums md:text-5xl">
          {monthIncome > 0 ? formatSignedYen(monthBalance) : '—'}
        </p>
        {monthIncome === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">収入データが入ると収支を表示します。</p>
        ) : null}

        <div className="mt-8 grid grid-cols-3 gap-5">
          <div>
            <p className="text-xs text-muted-foreground">収入</p>
            <p className="mt-1 text-base font-semibold tabular-nums md:text-lg">
              {monthIncome > 0 ? formatYen(monthIncome) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">支出</p>
            <p className="mt-1 text-base font-semibold tabular-nums md:text-lg">{formatYen(monthExpense)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">積立</p>
            <p className="mt-1 text-base font-semibold tabular-nums md:text-lg">
              {monthlyInvestmentTotal > 0 ? formatYen(monthlyInvestmentTotal) : '—'}
            </p>
          </div>
        </div>
      </section>

      <section className="py-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">支出の内訳</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedCategoryId
                ? categoryById.get(selectedCategoryId)?.name || 'カテゴリ'
                : `${categoryRows.length}カテゴリ`}
            </p>
          </div>

          {selectedCategoryId ? (
            <button
              type="button"
              className="text-sm font-medium text-primary"
              onClick={() => setCategoryPath((current) => current.slice(0, -1))}
            >
              戻る
            </button>
          ) : (
            <Link href="/finance/expenses" className="text-sm font-medium text-primary">明細</Link>
          )}
        </div>

        {selectedCategoryId && !selectedCategoryHasChildren ? (
          selectedCategoryTransactions.length > 0 ? (
            <div className="divide-y divide-black/[0.05] border-y border-black/[0.06] dark:divide-white/[0.07] dark:border-white/[0.08]">
              {selectedCategoryTransactions.slice(0, 10).map((expense) => (
                <div key={expense.id} className="flex items-center gap-4 py-3.5">
                  <span className="w-8 shrink-0 text-xs tabular-nums text-muted-foreground">
                    {expense.expense_date.slice(8, 10)}日
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {expense.description || expense.expense_categories?.name || '支出'}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {displayPerson(expense.paid_by, user, partner)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">{formatYen(Number(expense.amount))}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="border-y py-8 text-sm text-muted-foreground">このカテゴリの支出はありません。</p>
          )
        ) : categoryRows.length > 0 ? (
          <div className="divide-y divide-black/[0.05] border-y border-black/[0.06] dark:divide-white/[0.07] dark:border-white/[0.08]">
            {categoryRows.slice(0, 8).map((row) => {
              const pct = categoryViewTotal > 0 ? (row.amount / categoryViewTotal) * 100 : 0
              const content = (
                <div className="py-3.5">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="truncate text-sm font-medium">{row.name}</p>
                    <div className="flex shrink-0 items-baseline gap-3">
                      <span className="text-xs tabular-nums text-muted-foreground">{pct.toFixed(0)}%</span>
                      <span className="min-w-[88px] text-right text-sm font-semibold tabular-nums">{formatYen(row.amount)}</span>
                    </div>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/[0.07]">
                    <div
                      className="h-full rounded-full bg-foreground/70"
                      style={{ width: `${clamp(pct)}%` }}
                    />
                  </div>
                </div>
              )

              return row.id ? (
                <button
                  key={row.id}
                  type="button"
                  className="block w-full text-left transition-opacity hover:opacity-70"
                  onClick={() => setCategoryPath((current) => [...current, row.id!])}
                >
                  {content}
                </button>
              ) : (
                <div key={row.name}>{content}</div>
              )
            })}
          </div>
        ) : (
          <p className="border-y py-8 text-sm text-muted-foreground">支出データがありません。</p>
        )}
      </section>

      <section className="border-t border-black/[0.06] py-8 dark:border-white/[0.08]">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">精算</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              精算対象 {settlementRows.length}件 · {formatYen(settlementTarget)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold tabular-nums">
              {settlement?.amount ? formatYen(settlement.amount) : 'なし'}
            </p>
            {settlementDirection ? <p className="mt-1 text-xs text-muted-foreground">{settlementDirection}</p> : null}
          </div>
        </div>
        <Link href="/finance/settlements" className="mt-4 inline-block text-sm font-medium text-primary">精算の詳細</Link>
      </section>

      <nav className="grid grid-cols-3 border-t border-black/[0.06] pt-5 text-sm dark:border-white/[0.08]">
        <Link href="/finance/expenses" className="font-medium text-muted-foreground transition-colors hover:text-foreground">明細を見る</Link>
        <Link href="/finance/plan" className="text-center font-medium text-muted-foreground transition-colors hover:text-foreground">計画を見る</Link>
        <Link href="/finance/import" className="text-right font-medium text-muted-foreground transition-colors hover:text-foreground">CSV取込</Link>
      </nav>
    </div>
  )
}
