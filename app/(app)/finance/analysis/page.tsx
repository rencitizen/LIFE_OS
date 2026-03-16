'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getLifePlanMonthlyBudget } from '@/lib/budget-utils'
import { formatYen } from '@/lib/finance/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useBudget, useBudgetCategories, useBudgetIncomeCategories, useBudgetMemberLimits } from '@/lib/hooks/use-budgets'
import { useMonthlyExpenseSummary, useYearExpenseHistory } from '@/lib/hooks/use-expenses'
import { useIncomes, useYearIncomeHistory } from '@/lib/hooks/use-incomes'
import { useLifePlanConfig } from '@/lib/hooks/use-life-plan'
import { useFinanceStore } from '@/stores/finance-store'

function diffTone(value: number, inverse = false) {
  const positive = inverse ? value >= 0 : value <= 0
  return positive ? 'text-primary' : 'text-destructive'
}

export default function AnalysisPage() {
  const { couple } = useAuth()
  const { selectedMonth, setSelectedMonth } = useFinanceStore()
  const lifePlanConfig = useLifePlanConfig(couple?.id)
  const { data: monthExpenses } = useMonthlyExpenseSummary(couple?.id, selectedMonth)
  const { data: monthIncomes } = useIncomes(couple?.id, selectedMonth)
  const { data: budget } = useBudget(couple?.id, selectedMonth)
  const { data: budgetCategories } = useBudgetCategories(budget?.id)
  const { data: budgetIncomeCategories } = useBudgetIncomeCategories(budget?.id)
  const { data: budgetMemberLimits } = useBudgetMemberLimits(budget?.id)

  const selectedYear = Number(selectedMonth.slice(0, 4))
  const { data: yearExpenses } = useYearExpenseHistory(couple?.id, selectedYear)
  const { data: yearIncomes } = useYearIncomeHistory(couple?.id, selectedYear)

  const [year, month] = selectedMonth.split('-').map(Number)
  const displayDate = new Date(year, month - 1, 1)
  const lifePlanBudget = getLifePlanMonthlyBudget(lifePlanConfig, selectedMonth)

  const actualIncome = useMemo(
    () => (monthIncomes || []).reduce((sum, row) => sum + Number(row.amount), 0),
    [monthIncomes]
  )
  const plannedIncome = useMemo(
    () => (budgetIncomeCategories || []).reduce((sum, row) => sum + Number(row.planned_amount), 0),
    [budgetIncomeCategories]
  )
  const actualExpense = monthExpenses?.total || 0
  const plannedExpense = useMemo(
    () => (budgetMemberLimits || []).reduce((sum, row) => sum + Number(row.limit_amount), 0) || Number(budget?.total_limit || lifePlanBudget.total),
    [budget?.total_limit, budgetMemberLimits, lifePlanBudget.total]
  )
  const actualBalance = actualIncome - actualExpense
  const plannedBalance = plannedIncome - plannedExpense

  const yearIncome = useMemo(
    () => (yearIncomes || []).reduce((sum, row) => sum + Number(row.amount), 0),
    [yearIncomes]
  )
  const yearExpense = useMemo(
    () => (yearExpenses || []).reduce((sum, row) => sum + Number(row.amount), 0),
    [yearExpenses]
  )

  const categoryRows = useMemo(() => {
    const actualMap = monthExpenses?.byCategory || {}
    const plannedMap = new Map((budgetCategories || []).map((row) => [row.category_id, Number(row.limit_amount) || 0]))
    const keys = new Set<string>([...Object.keys(actualMap), ...plannedMap.keys()])

    return Array.from(keys).map((key) => {
      const actual = actualMap[key]
      const planned = plannedMap.get(key) || 0
      const name = actual?.name || budgetCategories?.find((row) => row.category_id === key)?.expense_categories?.name || '未分類'
      return {
        key,
        name,
        planned,
        actual: actual?.total || 0,
        diff: (actual?.total || 0) - planned,
      }
    }).sort((a, b) => b.actual - a.actual)
  }, [budgetCategories, monthExpenses?.byCategory])

  const navigateMonth = (direction: number) => {
    const nextDate = new Date(year, month - 1 + direction, 1)
    setSelectedMonth(format(nextDate, 'yyyy-MM'))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{format(displayDate, 'yyyy年M月', { locale: ja })}の月次実績</h1>
          <p className="text-sm text-muted-foreground">
            月の PL を `計画 / 実績 / 差異` で確認します。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[120px] text-center text-sm font-medium">
            {format(displayDate, 'yyyy年M月', { locale: ja })}
          </span>
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">収入</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-xs text-muted-foreground">計画 {formatYen(plannedIncome)}</p>
            <p className="text-2xl font-bold text-primary">{formatYen(actualIncome)}</p>
            <p className={`text-sm font-medium ${diffTone(actualIncome - plannedIncome, true)}`}>
              差異 {formatYen(actualIncome - plannedIncome)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">支出</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-xs text-muted-foreground">計画 {formatYen(plannedExpense)}</p>
            <p className="text-2xl font-bold text-[var(--color-expense)]">{formatYen(actualExpense)}</p>
            <p className={`text-sm font-medium ${diffTone(actualExpense - plannedExpense)}`}>
              差異 {formatYen(actualExpense - plannedExpense)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">収支</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-xs text-muted-foreground">計画 {formatYen(plannedBalance)}</p>
            <p className={`text-2xl font-bold ${actualBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatYen(actualBalance)}
            </p>
            <p className={`text-sm font-medium ${actualBalance - plannedBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
              差異 {formatYen(actualBalance - plannedBalance)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">カテゴリ別の差異</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-2 py-2">カテゴリ</th>
                  <th className="px-2 py-2 text-right">計画</th>
                  <th className="px-2 py-2 text-right">実績</th>
                  <th className="px-2 py-2 text-right">差異</th>
                </tr>
              </thead>
              <tbody>
                {categoryRows.map((row) => (
                  <tr key={row.key} className="border-b last:border-b-0">
                    <td className="px-2 py-3">{row.name}</td>
                    <td className="px-2 py-3 text-right">{formatYen(row.planned)}</td>
                    <td className="px-2 py-3 text-right">{formatYen(row.actual)}</td>
                    <td className={`px-2 py-3 text-right font-medium ${diffTone(row.diff)}`}>
                      {formatYen(row.diff)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{selectedYear}年の累計</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">年収実績</p>
            <p className="mt-1 text-xl font-semibold text-primary">{formatYen(yearIncome)}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">年支出実績</p>
            <p className="mt-1 text-xl font-semibold text-[var(--color-expense)]">{formatYen(yearExpense)}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">年収支実績</p>
            <p className={`mt-1 text-xl font-semibold ${yearIncome - yearExpense >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatYen(yearIncome - yearExpense)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
