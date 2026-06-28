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
            <Badge variant="outline">分析</Badge>
            <span className="text-sm text-muted-foreground">{FINANCE_SCOPE_LABELS[financeScope]}</span>
          </div>
          <h1 className="text-2xl font-bold">{format(displayDate, 'yyyy/MM')} の分析</h1>
          <p className="text-sm text-muted-foreground">選択中の家計範囲について、月次と年次の内訳を確認できます。</p>
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
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">収入</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[var(--color-income)]">{formatYen(actualIncome)}</p>
          </CardContent>
        </Card>
        <Card tone="navy">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">支出</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[var(--color-expense)]">{formatYen(actualExpense)}</p>
          </CardContent>
        </Card>
        <Card tone="blue">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">収支</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[var(--color-balance)]">{formatSignedYen(actualBalance)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card tone="navy">
          <CardHeader>
            <CardTitle className="text-base">支出カテゴリ上位</CardTitle>
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
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, row.ratio)}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">この範囲の支出カテゴリはまだありません。</p>
            )}
          </CardContent>
        </Card>

        <Card tone="mint">
          <CardHeader>
            <CardTitle className="text-base">見方のメモ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-xl border p-4">
              <p className="font-medium">まず収支を見る</p>
              <p className="mt-1 text-muted-foreground">月次収支で、この範囲が黒字か赤字かを確認します。</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="font-medium">次にカテゴリ比率を見る</p>
              <p className="mt-1 text-muted-foreground">上位カテゴリで支出が集中している場所を確認できます。</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="font-medium">年次合計で流れを見る</p>
              <p className="mt-1 text-muted-foreground">下の年次サマリーで、今月が長期的な傾向の一部か確認できます。</p>
            </div>
          </CardContent>
        </Card>
      </div>

        <Card tone="cyan">
        <CardHeader>
          <CardTitle className="text-base">{selectedYear}年 合計</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">年間収入</p>
            <p className="mt-1 text-xl font-semibold text-[var(--color-income)]">{formatYen(yearIncome)}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">年間支出</p>
            <p className="mt-1 text-xl font-semibold text-[var(--color-expense)]">{formatYen(yearExpense)}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">年間収支</p>
            <p className="mt-1 text-xl font-semibold text-[var(--color-balance)]">
              {formatSignedYen(yearBalance)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
