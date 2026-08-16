'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { addMonths, format } from 'date-fns'
import { ChevronLeft, ChevronRight, Wallet } from 'lucide-react'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UI_ACCENT_COLORS } from '@/lib/finance/constants'
import { FINANCE_SCOPE_LABELS, filterByFinanceScope } from '@/lib/finance/scope'
import { formatYen } from '@/lib/finance/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useExpenseCategories } from '@/lib/hooks/use-categories'
import { useExpenses } from '@/lib/hooks/use-expenses'
import { useIncomes } from '@/lib/hooks/use-incomes'
import { useFinanceStore } from '@/stores/finance-store'

const PIE_COLORS = ['#0F2747', '#1E4D8C', '#00A86B', '#5BCF6A', '#F2A900', '#FFC83D', '#E4EBF2']

type ExpensePieRow = {
  categoryId: string | null
  name: string
  value: number
  hasChildren: boolean
}

function formatSignedYen(value: number) {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${formatYen(Math.abs(value))}`
}

function formatTooltipCurrency(value: number | string | ReadonlyArray<number | string> | undefined) {
  const normalized = Array.isArray(value) ? value[0] : value
  return formatYen(Number(normalized || 0))
}

export default function FinanceDashboardPage() {
  const { couple, user, partner } = useAuth()
  const { selectedMonth, setSelectedMonth, financeScope } = useFinanceStore()
  const { data: expenseRows } = useExpenses(couple?.id, selectedMonth)
  const { data: categories } = useExpenseCategories(couple?.id)
  const { data: monthIncomes } = useIncomes(couple?.id, selectedMonth)
  const [expenseCategoryPath, setExpenseCategoryPath] = useState<string[]>([])

  const [year, month] = selectedMonth.split('-').map(Number)
  const displayDate = new Date(year, month - 1, 1)

  const scopedExpenseRows = useMemo(
    () => filterByFinanceScope(expenseRows || [], financeScope, user?.id, partner?.id, (row) => row.paid_by),
    [expenseRows, financeScope, partner?.id, user?.id]
  )
  const scopedIncomes = useMemo(
    () => filterByFinanceScope(monthIncomes || [], financeScope, user?.id, partner?.id, (row) => row.user_id),
    [financeScope, monthIncomes, partner?.id, user?.id]
  )

  const actualIncome = useMemo(
    () => scopedIncomes.reduce((sum, row) => sum + Number(row.amount), 0),
    [scopedIncomes]
  )
  const actualExpense = useMemo(
    () => scopedExpenseRows.reduce((sum, row) => sum + Number(row.amount), 0),
    [scopedExpenseRows]
  )
  const actualBalance = actualIncome - actualExpense
  const relationLineExpensePct = actualIncome > 0 ? Math.min(100, Math.max(0, (actualExpense / actualIncome) * 100)) : 0
  const relationLineBalancePct = actualIncome > 0 ? Math.min(100, Math.max(0, (actualBalance / actualIncome) * 100)) : 0

  const categoryById = useMemo(
    () => new Map((categories || []).map((category) => [category.id, category])),
    [categories]
  )

  const selectedExpenseCategoryId = expenseCategoryPath[expenseCategoryPath.length - 1] || null

  const expenseCategoryBreadcrumb = useMemo(
    () => expenseCategoryPath.map((id) => categoryById.get(id)?.name).filter(Boolean).join(' / '),
    [categoryById, expenseCategoryPath]
  )

  const expensePieData = useMemo<ExpensePieRow[]>(() => {
    const totals = new Map<string, ExpensePieRow>()
    const categoryList = categories || []

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

    for (const row of scopedExpenseRows) {
      const amount = Number(row.amount)
      const rowCategoryId = row.category_id

      if (!rowCategoryId || !categoryById.has(rowCategoryId)) {
        if (!selectedExpenseCategoryId) {
          const current = totals.get('uncategorized') || {
            categoryId: null,
            name: '未分類',
            value: 0,
            hasChildren: false,
          }
          current.value += amount
          totals.set('uncategorized', current)
        }
        continue
      }

      let bucketId: string | null = null
      let bucketName = ''
      let bucketHasChildren = false

      if (!selectedExpenseCategoryId) {
        bucketId = rootCategoryId(rowCategoryId)
        const bucketCategory = categoryById.get(bucketId)
        bucketName = bucketCategory?.name || row.expense_categories?.name || '未分類'
        bucketHasChildren = Boolean(bucketCategory && hasChildren(bucketCategory.id))
      } else {
        if (!isDescendantOrSelf(rowCategoryId, selectedExpenseCategoryId)) continue

        if (rowCategoryId === selectedExpenseCategoryId) {
          bucketId = null
          bucketName = `${categoryById.get(selectedExpenseCategoryId)?.name || 'カテゴリ'}（直下）`
        } else {
          bucketId = directChildBelow(rowCategoryId, selectedExpenseCategoryId)
          const bucketCategory = bucketId ? categoryById.get(bucketId) : null
          bucketName = bucketCategory?.name || 'その他'
          bucketHasChildren = Boolean(bucketCategory && hasChildren(bucketCategory.id))
        }
      }

      const key = bucketId || `direct:${selectedExpenseCategoryId || 'root'}`
      const current = totals.get(key) || {
        categoryId: bucketId,
        name: bucketName,
        value: 0,
        hasChildren: bucketHasChildren,
      }
      current.value += amount
      totals.set(key, current)
    }

    return Array.from(totals.values()).sort((a, b) => b.value - a.value)
  }, [categories, categoryById, scopedExpenseRows, selectedExpenseCategoryId])

  const drillIntoCategory = (row: ExpensePieRow) => {
    if (!row.categoryId || !row.hasChildren) return
    setExpenseCategoryPath((current) => [...current, row.categoryId!])
  }

  const navigateMonth = (direction: number) => {
    const nextDate = addMonths(displayDate, direction)
    setSelectedMonth(format(nextDate, 'yyyy-MM'))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">月次概要</h1>
          <p className="text-sm text-muted-foreground">
            {FINANCE_SCOPE_LABELS[financeScope]}の収入、支出、月次収支を確認できます。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[120px] text-center text-sm font-medium">{format(displayDate, 'yyyy/MM')}</span>
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card tone="cyan">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">収入</CardTitle>
            <Wallet className="h-4 w-4 text-[var(--color-income)]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--color-income)]">{formatYen(actualIncome)}</div>
            <p className="mt-1 text-xs text-muted-foreground">{scopedIncomes.length} 件の収入</p>
          </CardContent>
        </Card>

        <Card tone="navy">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">支出</CardTitle>
            <Wallet className="h-4 w-4 text-[var(--color-expense)]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--color-expense)]">{formatYen(actualExpense)}</div>
            <p className="mt-1 text-xs text-muted-foreground">{scopedExpenseRows.length} 件の支出</p>
          </CardContent>
        </Card>

        <Card tone="blue">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">収支</CardTitle>
            <Wallet className="h-4 w-4 text-[var(--color-balance)]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--color-balance)]">{formatSignedYen(actualBalance)}</div>
            <p className="mt-1 text-xs text-muted-foreground">選択月の差額</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <Card tone="cyan">
          <CardHeader>
            <CardTitle className="text-base">収支の線分図</CardTitle>
          </CardHeader>
          <CardContent>
            {actualIncome > 0 || actualExpense > 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  収入 - 支出 = 収支 の関係を、1本の線分で表しています。
                </p>
                <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                  <div className="relative h-20">
                    <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border" />
                    <div className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--color-expense)]" style={{ width: `${relationLineExpensePct}%` }} />
                    <div
                      className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--color-balance)]"
                      style={{ left: `${relationLineExpensePct}%`, width: `${relationLineBalancePct}%` }}
                    />
                    <div
                      className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-[var(--color-expense)]"
                      style={{ left: `${relationLineExpensePct}%` }}
                    />
                    <div
                      className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-[var(--color-balance)]"
                      style={{ left: '100%' }}
                    />
                    <div className="absolute left-0 top-0 -translate-y-1 text-[10px] font-medium text-[var(--color-income)]">
                      収入
                    </div>
                    <div className="absolute top-0 -translate-y-1 -translate-x-1/2 text-[10px] font-medium text-[var(--color-expense)]" style={{ left: `${relationLineExpensePct}%` }}>
                      支出点
                    </div>
                    <div className="absolute right-0 top-0 -translate-y-1 text-[10px] font-medium text-[var(--color-balance)]">
                      収支点
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-[var(--color-income)]">収入 {formatYen(actualIncome)}</span>
                    <span className="text-[var(--color-expense)]">支出 {formatYen(actualExpense)}</span>
                    <span className="text-[var(--color-balance)]">収支 {formatSignedYen(actualBalance)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                    <div className="rounded-md border bg-background px-3 py-2">
                      <span className="block font-medium text-[var(--color-income)]">収入</span>
                      <span>{formatYen(actualIncome)}</span>
                    </div>
                    <div className="rounded-md border bg-background px-3 py-2">
                      <span className="block font-medium text-[var(--color-expense)]">支出</span>
                      <span>{formatYen(actualExpense)}</span>
                    </div>
                    <div className="rounded-md border bg-background px-3 py-2">
                      <span className="block font-medium text-[var(--color-balance)]">収支</span>
                      <span>{formatSignedYen(actualBalance)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">収入または支出を追加すると収支の線分図が表示されます。</p>
            )}
          </CardContent>
        </Card>

        <Card tone="cyan">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">支出構成</CardTitle>
              {expenseCategoryPath.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpenseCategoryPath((current) => current.slice(0, -1))}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  戻る
                </Button>
              )}
            </div>
            {expenseCategoryBreadcrumb && (
              <p className="text-xs text-muted-foreground">{expenseCategoryBreadcrumb}</p>
            )}
          </CardHeader>
          <CardContent>
            {expensePieData.length > 0 ? (
              <div className="space-y-4">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expensePieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={64}
                        outerRadius={96}
                        paddingAngle={2}
                      >
                        {expensePieData.map((entry, index) => (
                          <Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={formatTooltipCurrency} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2">
                  {expensePieData.slice(0, 8).map((row, index) => (
                    <button
                      key={`${row.categoryId || row.name}-${index}`}
                      type="button"
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${
                        row.hasChildren ? 'hover:bg-muted/40' : 'cursor-default'
                      }`}
                      onClick={() => drillIntoCategory(row)}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                        />
                        <span className="truncate">{row.name}</span>
                        {row.hasChildren && <span className="text-xs text-muted-foreground">詳細</span>}
                      </div>
                      <span className="shrink-0 font-medium">{formatYen(row.value)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">この階層に表示できる支出はありません。</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/finance/expenses" className="rounded-xl border bg-background p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm">
          <p className="text-sm font-medium">収入・支出を開く</p>
          <p className="mt-1 text-xs text-muted-foreground">月次の収入・支出を確認、編集します。</p>
        </Link>
        <Link href="/finance/analysis" className="rounded-xl border bg-accent p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm">
          <p className="text-sm font-medium">分析を開く</p>
          <p className="mt-1 text-xs text-muted-foreground">カテゴリや前年比の詳細を確認します。</p>
        </Link>
        <Link href="/finance/life-plan" className="rounded-xl border bg-primary p-4 text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-sm">
          <p className="text-sm font-medium">5年計画を開く</p>
          <p className="mt-1 text-xs text-muted-foreground">将来の収入・資産推移を確認します。</p>
        </Link>
      </div>
    </div>
  )
}
