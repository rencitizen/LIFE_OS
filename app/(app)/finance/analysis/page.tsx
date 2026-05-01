'use client'

import { useMemo } from 'react'
import { addMonths, format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FINANCE_SCOPE_LABELS, filterByFinanceScope } from '@/lib/finance/scope'
import { formatYen } from '@/lib/finance/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useExpenses, useYearExpenseHistory } from '@/lib/hooks/use-expenses'
import { useIncomes, useYearIncomeHistory } from '@/lib/hooks/use-incomes'
import { useFinanceStore } from '@/stores/finance-store'

function formatSignedYen(value: number) {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${formatYen(Math.abs(value))}`
}

function sumAmount<T extends { amount: number | string }>(rows: T[]) {
  return rows.reduce((sum, row) => sum + Number(row.amount), 0)
}

export default function AnalysisPage() {
  const { user, partner, couple } = useAuth()
  const { selectedMonth, setSelectedMonth, financeScope } = useFinanceStore()
  const { data: expenseRows } = useExpenses(couple?.id, selectedMonth)
  const { data: monthIncomes } = useIncomes(couple?.id, selectedMonth)

  const selectedYear = Number(selectedMonth.slice(0, 4))
  const { data: yearExpenses } = useYearExpenseHistory(couple?.id, selectedYear)
  const { data: yearIncomes } = useYearIncomeHistory(couple?.id, selectedYear)

  const [year, month] = selectedMonth.split('-').map(Number)
  const displayDate = new Date(year, month - 1, 1)

  const scopedMonthIncomes = useMemo(
    () => filterByFinanceScope(monthIncomes || [], financeScope, user?.id, partner?.id, (row) => row.user_id),
    [financeScope, monthIncomes, partner?.id, user?.id]
  )
  const scopedExpenseRows = useMemo(
    () => filterByFinanceScope(expenseRows || [], financeScope, user?.id, partner?.id, (row) => row.paid_by),
    [expenseRows, financeScope, partner?.id, user?.id]
  )
  const scopedYearIncomes = useMemo(
    () => filterByFinanceScope(yearIncomes || [], financeScope, user?.id, partner?.id, (row) => row.user_id),
    [financeScope, partner?.id, user?.id, yearIncomes]
  )
  const scopedYearExpenses = useMemo(
    () => filterByFinanceScope(yearExpenses || [], financeScope, user?.id, partner?.id, (row) => row.paid_by),
    [financeScope, partner?.id, user?.id, yearExpenses]
  )

  const actualIncome = useMemo(() => sumAmount(scopedMonthIncomes), [scopedMonthIncomes])
  const actualExpense = useMemo(() => sumAmount(scopedExpenseRows), [scopedExpenseRows])
  const actualBalance = actualIncome - actualExpense

  const yearIncome = useMemo(() => sumAmount(scopedYearIncomes), [scopedYearIncomes])
  const yearExpense = useMemo(() => sumAmount(scopedYearExpenses), [scopedYearExpenses])
  const yearBalance = yearIncome - yearExpense

  const topCategoryRows = useMemo(() => {
    const totals = new Map<string, number>()

    for (const row of scopedExpenseRows) {
      const name = row.expense_categories?.name || 'Uncategorized'
      totals.set(name, (totals.get(name) || 0) + Number(row.amount))
    }

    const totalExpense = Array.from(totals.values()).reduce((sum, value) => sum + value, 0)

    return Array.from(totals.entries())
      .map(([name, total]) => ({
        name,
        total,
        ratio: totalExpense > 0 ? (total / totalExpense) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
  }, [scopedExpenseRows])

  const navigateMonth = (direction: number) => {
    const nextDate = addMonths(displayDate, direction)
    setSelectedMonth(format(nextDate, 'yyyy-MM'))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline">Analysis</Badge>
            <span className="text-sm text-muted-foreground">{FINANCE_SCOPE_LABELS[financeScope]}</span>
          </div>
          <h1 className="text-2xl font-bold">{format(displayDate, 'yyyy/MM')} analysis</h1>
          <p className="text-sm text-muted-foreground">Focused monthly and yearly breakdown for the selected finance scope.</p>
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
        <Card tone="mint">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Income</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatYen(actualIncome)}</p>
          </CardContent>
        </Card>
        <Card tone="blue">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Expense</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatYen(actualExpense)}</p>
          </CardContent>
        </Card>
        <Card tone="navy">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${actualBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatSignedYen(actualBalance)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card tone="cyan">
          <CardHeader>
            <CardTitle className="text-base">Top expense categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topCategoryRows.length > 0 ? (
              topCategoryRows.map((row) => (
                <div key={row.name} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{row.name}</span>
                    <span className="shrink-0 font-medium">{formatYen(row.total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-slate-700" style={{ width: `${Math.min(100, row.ratio)}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No expense categories yet for this scope.</p>
            )}
          </CardContent>
        </Card>

        <Card tone="mint">
          <CardHeader>
            <CardTitle className="text-base">Reading notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-xl border p-4">
              <p className="font-medium">Start with balance</p>
              <p className="mt-1 text-muted-foreground">Use the monthly balance to judge whether this scope landed positive or negative.</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="font-medium">Then inspect category weight</p>
              <p className="mt-1 text-muted-foreground">The top category list shows where this scope is concentrating most of its spending.</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="font-medium">Use yearly totals for context</p>
              <p className="mt-1 text-muted-foreground">The year summary below tells you whether the current month is part of a longer trend.</p>
            </div>
          </CardContent>
        </Card>
      </div>

        <Card tone="cyan">
        <CardHeader>
          <CardTitle className="text-base">{selectedYear} totals</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">Year income</p>
            <p className="mt-1 text-xl font-semibold">{formatYen(yearIncome)}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">Year expense</p>
            <p className="mt-1 text-xl font-semibold">{formatYen(yearExpense)}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">Year balance</p>
            <p className={`mt-1 text-xl font-semibold ${yearBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatSignedYen(yearBalance)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
