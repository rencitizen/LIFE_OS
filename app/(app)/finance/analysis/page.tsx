'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getLifePlanMonthlyBudget } from '@/lib/budget-utils'
import { formatYen } from '@/lib/finance/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useBudget, useBudgetCategories, useBudgetMemberLimits } from '@/lib/hooks/use-budgets'
import { useExpenses, useYearExpenseHistory } from '@/lib/hooks/use-expenses'
import { useIncomes, useYearIncomeHistory } from '@/lib/hooks/use-incomes'
import { useLifePlanConfig } from '@/lib/hooks/use-life-plan'
import { useFinanceStore } from '@/stores/finance-store'

type CategoryView = 'combined' | 'mine' | 'partner' | 'shared' | 'mine_personal' | 'partner_personal'

type CategoryRow = {
  key: string
  name: string
  actual: number
  ratio: number
}

function formatSignedYen(value: number) {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${formatYen(Math.abs(value))}`
}

function sumAmount<T extends { amount: number | string }>(rows: T[]) {
  return rows.reduce((sum, row) => sum + Number(row.amount), 0)
}

function getTone(value: number, smallerIsBetter = false) {
  const positive = smallerIsBetter ? value <= 0 : value >= 0
  return positive ? 'text-primary' : 'text-destructive'
}

function buildCategoryRows(
  rows: Array<{
    amount: number | string
    category_id: string | null
    expense_categories: { name: string | null } | null
  }>,
  budgetCategories: ReturnType<typeof useBudgetCategories>['data']
) {
  const actualMap = new Map<string, { name: string; actual: number }>()

  for (const row of rows) {
    const key = row.category_id || 'uncategorized'
    const current = actualMap.get(key)
    actualMap.set(key, {
      name: row.expense_categories?.name || current?.name || '未分類',
      actual: (current?.actual || 0) + Number(row.amount),
    })
  }

  const totalActual = Array.from(actualMap.values()).reduce((sum, row) => sum + row.actual, 0)

  return Array.from(actualMap.entries())
    .map(([key, value]) => {
      const fallbackName =
        budgetCategories?.find((row) => row.category_id === key)?.expense_categories?.name || value.name

      return {
        key,
        name: fallbackName,
        actual: value.actual,
        ratio: totalActual > 0 ? (value.actual / totalActual) * 100 : 0,
      }
    })
    .sort((a, b) => b.actual - a.actual)
}

function ScopeCard({
  label,
  income,
  expense,
  balance,
  helper,
}: {
  label: string
  income?: number
  expense: number
  balance?: number
  helper?: string
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-sm font-medium">{label}</p>
      {helper && <p className="mt-1 text-xs text-muted-foreground">{helper}</p>}
      <div className="mt-3 space-y-2 text-sm">
        {typeof income === 'number' && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">収入</span>
            <span>{formatYen(income)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">支出</span>
          <span>{formatYen(expense)}</span>
        </div>
        {typeof balance === 'number' && (
          <div className="flex items-center justify-between border-t pt-2 font-medium">
            <span>収支</span>
            <span className={balance >= 0 ? 'text-primary' : 'text-destructive'}>{formatSignedYen(balance)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AnalysisPage() {
  const { user, partner, couple } = useAuth()
  const { livingMode, selectedMonth, setSelectedMonth } = useFinanceStore()
  const lifePlanConfig = useLifePlanConfig(couple?.id)
  const { data: expenseRows } = useExpenses(couple?.id, selectedMonth)
  const { data: monthIncomes } = useIncomes(couple?.id, selectedMonth)
  const { data: budget } = useBudget(couple?.id, selectedMonth)
  const { data: budgetCategories } = useBudgetCategories(budget?.id)
  const { data: budgetMemberLimits } = useBudgetMemberLimits(budget?.id)

  const selectedYear = Number(selectedMonth.slice(0, 4))
  const { data: yearExpenses } = useYearExpenseHistory(couple?.id, selectedYear)
  const { data: yearIncomes } = useYearIncomeHistory(couple?.id, selectedYear)

  const [year, month] = selectedMonth.split('-').map(Number)
  const displayDate = new Date(year, month - 1, 1)
  const lifePlanBudget = getLifePlanMonthlyBudget(lifePlanConfig, selectedMonth)
  const userLabel = user?.display_name || '自分'
  const partnerLabel = partner?.display_name || '相手'

  const selectedYearPlan = useMemo(() => {
    const household = lifePlanConfig.incomeData.find((row) => row.year === selectedYear)
    if (!household) return null

    return {
      income: Math.round((household.ren.net + household.hikaru.net) / 12),
      expense: Math.round(lifePlanBudget.total),
    }
  }, [lifePlanConfig.incomeData, lifePlanBudget.total, selectedYear])

  const actualIncome = useMemo(() => sumAmount(monthIncomes || []), [monthIncomes])
  const actualExpense = useMemo(() => sumAmount(expenseRows || []), [expenseRows])
  const actualBalance = actualIncome - actualExpense
  const plannedIncome = selectedYearPlan?.income || 0
  const plannedExpense = Number(budget?.total_limit) || selectedYearPlan?.expense || 0
  const plannedBalance = plannedIncome - plannedExpense

  const incomeByOwner = useMemo(() => {
    const mine = (monthIncomes || []).filter((row) => row.user_id === user?.id).reduce((sum, row) => sum + Number(row.amount), 0)
    const partnerTotal = (monthIncomes || [])
      .filter((row) => row.user_id === partner?.id)
      .reduce((sum, row) => sum + Number(row.amount), 0)
    return { mine, partner: partnerTotal }
  }, [monthIncomes, partner?.id, user?.id])

  const mineExpenses = useMemo(() => (expenseRows || []).filter((row) => row.paid_by === user?.id), [expenseRows, user?.id])
  const partnerExpenses = useMemo(
    () => (expenseRows || []).filter((row) => row.paid_by === partner?.id),
    [expenseRows, partner?.id]
  )
  const sharedExpenses = useMemo(
    () => (expenseRows || []).filter((row) => row.expense_type === 'shared'),
    [expenseRows]
  )
  const minePersonalExpenses = useMemo(
    () => (expenseRows || []).filter((row) => row.paid_by === user?.id && row.expense_type === 'personal'),
    [expenseRows, user?.id]
  )
  const partnerPersonalExpenses = useMemo(
    () => (expenseRows || []).filter((row) => row.paid_by === partner?.id && row.expense_type === 'personal'),
    [expenseRows, partner?.id]
  )

  const memberBudgetMap = useMemo(
    () => new Map((budgetMemberLimits || []).map((row) => [row.user_id, Number(row.limit_amount) || 0])),
    [budgetMemberLimits]
  )

  const monthExpenseViews = useMemo(
    () => ({
      combined: expenseRows || [],
      mine: mineExpenses,
      partner: partnerExpenses,
      shared: sharedExpenses,
      mine_personal: minePersonalExpenses,
      partner_personal: partnerPersonalExpenses,
    }),
    [expenseRows, mineExpenses, minePersonalExpenses, partnerExpenses, partnerPersonalExpenses, sharedExpenses]
  )

  const categoryView: CategoryView = livingMode === 'before_cohabiting' ? 'combined' : 'shared'
  const activeCategoryRows = useMemo(() => buildCategoryRows(monthExpenseViews[categoryView], budgetCategories), [budgetCategories, categoryView, monthExpenseViews])
  const topCategoryRows = activeCategoryRows.slice(0, 6)

  const yearIncome = useMemo(() => sumAmount(yearIncomes || []), [yearIncomes])
  const yearExpense = useMemo(() => sumAmount(yearExpenses || []), [yearExpenses])
  const yearBalance = yearIncome - yearExpense

  const navigateMonth = (direction: number) => {
    const nextDate = new Date(year, month - 1 + direction, 1)
    setSelectedMonth(format(nextDate, 'yyyy-MM'))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline">月次レビュー</Badge>
            <span className="text-sm text-muted-foreground">数字を絞って、月末の確認だけに集中する画面です</span>
          </div>
          <h1 className="text-2xl font-bold">{format(displayDate, 'yyyy年M月', { locale: ja })} の月次実績</h1>
          <p className="text-sm text-muted-foreground">収入・支出・収支の差異と、上位カテゴリだけを見やすく出しています。</p>
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
        {[
          { label: '収入', actual: actualIncome, planned: plannedIncome, diff: actualIncome - plannedIncome, smallerIsBetter: false },
          { label: '支出', actual: actualExpense, planned: plannedExpense, diff: actualExpense - plannedExpense, smallerIsBetter: true },
          { label: '収支', actual: actualBalance, planned: plannedBalance, diff: actualBalance - plannedBalance, smallerIsBetter: false },
        ].map((row) => (
          <Card key={row.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{row.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-xs text-muted-foreground">計画 {formatYen(row.planned)}</p>
              <p className="text-2xl font-bold">{formatYen(row.actual)}</p>
              <p className={`text-sm font-medium ${getTone(row.diff, row.smallerIsBetter)}`}>
                差異 {formatSignedYen(row.diff)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">支出の内訳は上位だけ確認</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topCategoryRows.length > 0 ? (
              topCategoryRows.map((row) => (
                <div key={row.key} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{row.name}</span>
                    <span className="shrink-0 font-medium">{formatYen(row.actual)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-slate-700" style={{ width: `${Math.min(100, row.ratio)}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">この月の支出はまだありません。</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">今月の見方</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-xl border p-4">
              <p className="font-medium">まず収支差異を見る</p>
              <p className="mt-1 text-muted-foreground">計画との差が大きい月だけ、詳細ページやカテゴリを深掘りすれば十分です。</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="font-medium">次に上位カテゴリを見る</p>
              <p className="mt-1 text-muted-foreground">カテゴリ一覧を全部読むのではなく、大きい支出だけ見れば原因を掴みやすいです。</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="font-medium">最後に入力漏れを確認する</p>
              <p className="mt-1 text-muted-foreground">月末まとめ入力なら、リアルタイム精度より件数と月末の着地だけを重視した方が楽です。</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{livingMode === 'before_cohabiting' ? '個人別の月次結果' : '共有と個人の月次結果'}</CardTitle>
        </CardHeader>
        <CardContent className={`grid gap-4 ${livingMode === 'before_cohabiting' ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
          {livingMode === 'before_cohabiting' ? (
            <>
              <ScopeCard
                label={userLabel}
                income={incomeByOwner.mine}
                expense={sumAmount(mineExpenses)}
                balance={incomeByOwner.mine - sumAmount(mineExpenses)}
                helper={`予算目安 ${formatYen(memberBudgetMap.get(user?.id || '') || 0)}`}
              />
              <ScopeCard
                label={partnerLabel}
                income={incomeByOwner.partner}
                expense={sumAmount(partnerExpenses)}
                balance={incomeByOwner.partner - sumAmount(partnerExpenses)}
                helper={`予算目安 ${formatYen(memberBudgetMap.get(partner?.id || '') || 0)}`}
              />
              <ScopeCard
                label="二人合計"
                income={actualIncome}
                expense={actualExpense}
                balance={actualBalance}
                helper={`全体予算 ${formatYen(plannedExpense)}`}
              />
            </>
          ) : (
            <>
              <ScopeCard label="二人合計" income={actualIncome} expense={actualExpense} balance={actualBalance} />
              <ScopeCard label="共有支出" expense={sumAmount(sharedExpenses)} />
              <ScopeCard label={`${userLabel} 個人`} income={incomeByOwner.mine} expense={sumAmount(minePersonalExpenses)} balance={incomeByOwner.mine - sumAmount(minePersonalExpenses)} />
              <ScopeCard label={`${partnerLabel} 個人`} income={incomeByOwner.partner} expense={sumAmount(partnerPersonalExpenses)} balance={incomeByOwner.partner - sumAmount(partnerPersonalExpenses)} />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{selectedYear}年の累計</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">年累計 収入</p>
            <p className="mt-1 text-xl font-semibold">{formatYen(yearIncome)}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">年累計 支出</p>
            <p className="mt-1 text-xl font-semibold">{formatYen(yearExpense)}</p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">年累計 収支</p>
            <p className={`mt-1 text-xl font-semibold ${yearBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatSignedYen(yearBalance)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
