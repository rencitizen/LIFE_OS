'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getLifePlanMonthlyBudget } from '@/lib/budget-utils'
import { formatYen } from '@/lib/finance/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import {
  useBudget,
  useBudgetCategories,
  useBudgetIncomeCategories,
  useBudgetMemberLimits,
} from '@/lib/hooks/use-budgets'
import { useExpenses, useYearExpenseHistory } from '@/lib/hooks/use-expenses'
import { useIncomes, useYearIncomeHistory } from '@/lib/hooks/use-incomes'
import { useLifePlanConfig } from '@/lib/hooks/use-life-plan'
import { useFinanceStore } from '@/stores/finance-store'

type CategoryView = 'combined' | 'mine' | 'partner' | 'shared' | 'mine_personal' | 'partner_personal'

type CategoryRow = {
  key: string
  name: string
  planned: number
  actual: number
  diff: number
  ratio: number
}

function diffTone(value: number, inverse = false) {
  const positive = inverse ? value >= 0 : value <= 0
  return positive ? 'text-primary' : 'text-destructive'
}

function balanceTone(value: number) {
  return value >= 0 ? 'text-[#22C55E]' : 'text-destructive'
}

function formatSignedYen(value: number) {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${formatYen(Math.abs(value))}`
}

function sumAmount<T extends { amount: number | string }>(rows: T[]) {
  return rows.reduce((sum, row) => sum + Number(row.amount), 0)
}

function buildCategoryRows(
  rows: Array<{
    amount: number | string
    category_id: string | null
    expense_categories: { name: string | null } | null
  }>,
  budgetCategories: ReturnType<typeof useBudgetCategories>['data'],
  includeBudget: boolean
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

  const plannedMap = includeBudget
    ? new Map((budgetCategories || []).map((row) => [row.category_id, Number(row.limit_amount) || 0]))
    : new Map<string, number>()
  const keys = new Set<string>([...actualMap.keys(), ...plannedMap.keys()])
  const totalActual = Array.from(actualMap.values()).reduce((sum, row) => sum + row.actual, 0)

  return Array.from(keys)
    .map((key) => {
      const actual = actualMap.get(key)
      const planned = plannedMap.get(key) || 0
      const fallbackName =
        budgetCategories?.find((row) => row.category_id === key)?.expense_categories?.name || '未分類'

      return {
        key,
        name: actual?.name || fallbackName,
        planned,
        actual: actual?.actual || 0,
        diff: (actual?.actual || 0) - planned,
        ratio: totalActual > 0 ? ((actual?.actual || 0) / totalActual) * 100 : 0,
      }
    })
    .sort((a, b) => b.actual - a.actual)
}

function ScopeCard({
  label,
  income,
  expense,
  balance,
  plannedExpense,
}: {
  label: string
  income?: number
  expense: number
  balance?: number
  plannedExpense?: number
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        {typeof plannedExpense === 'number' && (
          <Badge variant="outline">予算 {formatYen(plannedExpense)}</Badge>
        )}
      </div>
      <div className="mt-3 space-y-2 text-sm">
        {typeof income === 'number' && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">収入</span>
            <span className="font-medium text-primary">{formatYen(income)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">支出</span>
          <span className="font-medium text-[var(--color-expense)]">{formatYen(expense)}</span>
        </div>
        {typeof balance === 'number' && (
          <div className="flex items-center justify-between border-t pt-2">
            <span className="text-muted-foreground">収支</span>
            <span className={`font-semibold ${balance >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatSignedYen(balance)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AnalysisPage() {
  const { user, partner, couple } = useAuth()
  const { livingMode, selectedMonth, setSelectedMonth } = useFinanceStore()
  const [categoryView, setCategoryView] = useState<CategoryView>('combined')

  const lifePlanConfig = useLifePlanConfig(couple?.id)
  const { data: expenseRows } = useExpenses(couple?.id, selectedMonth)
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

  const userLabel = user?.display_name || '自分'
  const partnerLabel = partner?.display_name || '相手'

  const validViews = useMemo<CategoryView[]>(
    () =>
      livingMode === 'before_cohabiting'
        ? ['combined', 'mine', 'partner']
        : ['combined', 'shared', 'mine_personal', 'partner_personal'],
    [livingMode]
  )

  useEffect(() => {
    if (!validViews.includes(categoryView)) {
      setCategoryView('combined')
    }
  }, [categoryView, validViews])

  const actualIncome = useMemo(() => sumAmount(monthIncomes || []), [monthIncomes])
  const plannedIncome = useMemo(
    () => (budgetIncomeCategories || []).reduce((sum, row) => sum + Number(row.planned_amount), 0),
    [budgetIncomeCategories]
  )
  const plannedExpense = useMemo(
    () =>
      (budgetMemberLimits || []).reduce((sum, row) => sum + Number(row.limit_amount), 0) ||
      Number(budget?.total_limit || lifePlanBudget.total),
    [budget?.total_limit, budgetMemberLimits, lifePlanBudget.total]
  )

  const memberBudgetMap = useMemo(
    () => new Map((budgetMemberLimits || []).map((row) => [row.user_id, Number(row.limit_amount) || 0])),
    [budgetMemberLimits]
  )

  const mineExpenses = useMemo(
    () => (expenseRows || []).filter((row) => row.paid_by === user?.id),
    [expenseRows, user?.id]
  )
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

  const actualExpense = sumAmount(monthExpenseViews.combined)
  const actualBalance = actualIncome - actualExpense
  const plannedBalance = plannedIncome - plannedExpense

  const incomeByOwner = useMemo(() => {
    const mine = (monthIncomes || [])
      .filter((row) => row.user_id === user?.id)
      .reduce((sum, row) => sum + Number(row.amount), 0)
    const partnerTotal = (monthIncomes || [])
      .filter((row) => row.user_id === partner?.id)
      .reduce((sum, row) => sum + Number(row.amount), 0)
    return { mine, partner: partnerTotal }
  }, [monthIncomes, partner?.id, user?.id])

  const yearIncome = useMemo(() => sumAmount(yearIncomes || []), [yearIncomes])
  const yearExpense = useMemo(() => sumAmount(yearExpenses || []), [yearExpenses])

  const activeCategoryRows = useMemo(() => {
    const includeBudget = categoryView === 'combined'
    return buildCategoryRows(monthExpenseViews[categoryView], budgetCategories, includeBudget)
  }, [budgetCategories, categoryView, monthExpenseViews])

  const activeViewTotal = useMemo(
    () => activeCategoryRows.reduce((sum, row) => sum + row.actual, 0),
    [activeCategoryRows]
  )

  const categoryViewOptions = useMemo(
    () =>
      livingMode === 'before_cohabiting'
        ? [
            { value: 'combined' as const, label: '2人合算' },
            { value: 'mine' as const, label: userLabel },
            { value: 'partner' as const, label: partnerLabel },
          ]
        : [
            { value: 'combined' as const, label: '世帯合算' },
            { value: 'shared' as const, label: '共通費' },
            { value: 'mine_personal' as const, label: `${userLabel} 個人` },
            { value: 'partner_personal' as const, label: `${partnerLabel} 個人` },
          ],
    [livingMode, partnerLabel, userLabel]
  )

  const navigateMonth = (direction: number) => {
    const nextDate = new Date(year, month - 1 + direction, 1)
    setSelectedMonth(format(nextDate, 'yyyy-MM'))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline">{livingMode === 'before_cohabiting' ? '同棲前' : '同棲後'}</Badge>
            <span className="text-sm text-muted-foreground">月の PL を計画・実績・差異で確認します</span>
          </div>
          <h1 className="text-2xl font-bold">{format(displayDate, 'yyyy年M月', { locale: ja })}の月次実績</h1>
          <p className="text-sm text-muted-foreground">
            同棲前は個人別、同棲後は世帯と個人支出を分けて見られます。
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
            <p className={`text-2xl font-bold ${balanceTone(actualBalance)}`}>
              {formatSignedYen(actualBalance)}
            </p>
            <p className={`text-sm font-medium ${actualBalance - plannedBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
              差異 {formatYen(actualBalance - plannedBalance)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {livingMode === 'before_cohabiting' ? '個人別の月次収支' : '世帯と個人支出の見え方'}
          </CardTitle>
        </CardHeader>
        <CardContent className={`grid gap-4 ${livingMode === 'before_cohabiting' ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
          {livingMode === 'before_cohabiting' ? (
            <>
              <ScopeCard
                label={userLabel}
                income={incomeByOwner.mine}
                expense={sumAmount(mineExpenses)}
                balance={incomeByOwner.mine - sumAmount(mineExpenses)}
                plannedExpense={memberBudgetMap.get(user?.id || '')}
              />
              <ScopeCard
                label={partnerLabel}
                income={incomeByOwner.partner}
                expense={sumAmount(partnerExpenses)}
                balance={incomeByOwner.partner - sumAmount(partnerExpenses)}
                plannedExpense={memberBudgetMap.get(partner?.id || '')}
              />
              <ScopeCard
                label="2人合算"
                income={actualIncome}
                expense={actualExpense}
                balance={actualBalance}
                plannedExpense={plannedExpense}
              />
            </>
          ) : (
            <>
              <ScopeCard
                label="世帯合算"
                income={actualIncome}
                expense={actualExpense}
                balance={actualBalance}
                plannedExpense={plannedExpense}
              />
              <ScopeCard
                label="共通費"
                expense={sumAmount(sharedExpenses)}
              />
              <ScopeCard
                label={`${userLabel} の個人支出`}
                income={incomeByOwner.mine}
                expense={sumAmount(minePersonalExpenses)}
                balance={incomeByOwner.mine - sumAmount(minePersonalExpenses)}
              />
              <ScopeCard
                label={`${partnerLabel} の個人支出`}
                income={incomeByOwner.partner}
                expense={sumAmount(partnerPersonalExpenses)}
                balance={incomeByOwner.partner - sumAmount(partnerPersonalExpenses)}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">カテゴリ別内訳</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {livingMode === 'before_cohabiting'
                  ? '同棲前は自分・相手・合算を切り替えて確認できます。'
                  : '同棲後は世帯合算に加えて、共通費と個人支出を分けて確認できます。'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {categoryViewOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={categoryView === option.value ? 'default' : 'outline'}
                  onClick={() => setCategoryView(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
            <span className="text-muted-foreground">表示中の実績合計</span>
            <span className="font-semibold">{formatYen(activeViewTotal)}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-2 py-2">カテゴリ</th>
                  {categoryView === 'combined' ? (
                    <>
                      <th className="px-2 py-2 text-right">計画</th>
                      <th className="px-2 py-2 text-right">実績</th>
                      <th className="px-2 py-2 text-right">差異</th>
                    </>
                  ) : (
                    <>
                      <th className="px-2 py-2 text-right">実績</th>
                      <th className="px-2 py-2 text-right">構成比</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {activeCategoryRows.map((row) => (
                  <tr key={`${categoryView}-${row.key}`} className="border-b last:border-b-0">
                    <td className="px-2 py-3">{row.name}</td>
                    {categoryView === 'combined' ? (
                      <>
                        <td className="px-2 py-3 text-right">{formatYen(row.planned)}</td>
                        <td className="px-2 py-3 text-right">{formatYen(row.actual)}</td>
                        <td className={`px-2 py-3 text-right font-medium ${diffTone(row.diff)}`}>
                          {formatYen(row.diff)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-2 py-3 text-right">{formatYen(row.actual)}</td>
                        <td className="px-2 py-3 text-right">{row.ratio.toFixed(1)}%</td>
                      </>
                    )}
                  </tr>
                ))}
                {activeCategoryRows.length === 0 && (
                  <tr>
                    <td
                      className="px-2 py-6 text-center text-sm text-muted-foreground"
                      colSpan={categoryView === 'combined' ? 4 : 3}
                    >
                      この条件の支出はまだありません。
                    </td>
                  </tr>
                )}
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
            <p className={`mt-1 text-xl font-semibold ${balanceTone(yearIncome - yearExpense)}`}>
              {formatSignedYen(yearIncome - yearExpense)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
