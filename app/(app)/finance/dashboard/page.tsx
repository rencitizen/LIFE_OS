'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useQueryClient } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChevronLeft, ChevronRight, PieChart, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getBudgetLimitTotal, getLifePlanMonthlyBudget } from '@/lib/budget-utils'
import { LIVING_MODE_LABELS, LIVING_MODES } from '@/lib/finance/constants'
import { formatYen, getCalendarYearMonths, getFiscalYearLabel } from '@/lib/finance/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useBudget, useBudgetIncomeCategories, useBudgetMemberLimits } from '@/lib/hooks/use-budgets'
import { useMonthlyExpenseSummary, useYearExpenseHistory } from '@/lib/hooks/use-expenses'
import { useIncomes, useYearIncomeHistory } from '@/lib/hooks/use-incomes'
import { useLifePlanConfig } from '@/lib/hooks/use-life-plan'
import { useTransactions } from '@/lib/hooks/use-transactions'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/stores/finance-store'
import { toast } from 'sonner'
import type { LivingMode } from '@/types'

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-card p-3 shadow-md">
      <p className="mb-1 text-sm font-medium">{label}</p>
      {payload.map((entry) => (
        <p key={`${entry.name}-${entry.value}`} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {formatYen(entry.value)}
        </p>
      ))}
    </div>
  )
}

export default function FinanceDashboardPage() {
  const { couple } = useAuth()
  const queryClient = useQueryClient()
  const supabase = createClient()
  const { selectedMonth, setSelectedMonth, livingMode, setLivingMode } = useFinanceStore()
  const lifePlanConfig = useLifePlanConfig(couple?.id)
  const { data: summary } = useMonthlyExpenseSummary(couple?.id, selectedMonth)
  const { data: incomes } = useIncomes(couple?.id, selectedMonth)
  const { data: budget } = useBudget(couple?.id, selectedMonth)
  const { data: budgetIncomeCategories } = useBudgetIncomeCategories(budget?.id)
  const { data: budgetMemberLimits } = useBudgetMemberLimits(budget?.id)
  const { data: transactions } = useTransactions(couple?.id, selectedMonth)

  const selectedYear = Number(selectedMonth.slice(0, 4))
  const { data: yearExpenses } = useYearExpenseHistory(couple?.id, selectedYear)
  const { data: yearIncomes } = useYearIncomeHistory(couple?.id, selectedYear)

  const [savingMode, setSavingMode] = useState(false)

  const totalIncome = incomes?.reduce((sum, income) => sum + Number(income.amount), 0) || 0
  const totalExpense = summary?.total || 0
  const balance = totalIncome - totalExpense
  const lifePlanBudget = getLifePlanMonthlyBudget(lifePlanConfig, selectedMonth)
  const budgetLimit = getBudgetLimitTotal(budget, budgetMemberLimits) || lifePlanBudget.total
  const remaining = budgetLimit - totalExpense
  const plannedIncome = (budgetIncomeCategories || []).reduce((sum, row) => sum + Number(row.planned_amount), 0)

  const navigateMonth = (direction: number) => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const nextDate = new Date(year, month - 1 + direction, 1)
    setSelectedMonth(format(nextDate, 'yyyy-MM'))
  }

  const [year, month] = selectedMonth.split('-').map(Number)
  const displayDate = new Date(year, month - 1, 1)

  const handleLivingModeChange = async (mode: LivingMode) => {
    setLivingMode(mode)
    if (!couple?.id) return

    setSavingMode(true)
    try {
      const { error } = await supabase.from('couples').update({ living_mode: mode }).eq('id', couple.id)
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['auth-couple', couple.id] })
    } catch {
      toast.error('生活モードの更新に失敗しました')
    } finally {
      setSavingMode(false)
    }
  }

  const monthlyCashflow = useMemo(() => {
    const monthRows = getCalendarYearMonths(selectedYear).map((row) => ({
      ...row,
      income: 0,
      expense: 0,
      balance: 0,
    }))
    const map = new Map(monthRows.map((row) => [row.key, row]))

    for (const income of yearIncomes || []) {
      const key = income.income_date.slice(0, 7)
      const row = map.get(key)
      if (row) row.income += Number(income.amount)
    }

    for (const expense of yearExpenses || []) {
      const key = expense.expense_date.slice(0, 7)
      const row = map.get(key)
      if (row) row.expense += Number(expense.amount)
    }

    return monthRows.map((row) => ({
      ...row,
      balance: row.income - row.expense,
    }))
  }, [selectedYear, yearExpenses, yearIncomes])

  const pieData = useMemo(() => {
    const entries = Object.values(summary?.byCategory || {}).sort((a, b) => b.total - a.total)
    const colors = ['#F59E0B', '#3B82F6', '#22C55E', '#1F5C4D', '#6B7280', '#94A3B8']
    const top = entries.slice(0, 5).map((entry, index) => ({
      name: entry.name,
      value: entry.total,
      color: colors[index % colors.length],
    }))
    const otherTotal = entries.slice(5).reduce((sum, entry) => sum + entry.total, 0)
    if (otherTotal > 0) {
      top.push({ name: 'その他', value: otherTotal, color: '#CBD5E1' })
    }
    return top
  }, [summary?.byCategory])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">家計ダッシュボード</h1>
          <p className="text-sm text-muted-foreground">
            暦年 {getFiscalYearLabel(selectedMonth)} 年度として表示 / {format(displayDate, 'yyyy年M月', { locale: ja })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg border p-1">
            {LIVING_MODES.map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant={livingMode === mode ? 'default' : 'ghost'}
                onClick={() => handleLivingModeChange(mode)}
                disabled={savingMode}
              >
                {LIVING_MODE_LABELS[mode]}
              </Button>
            ))}
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[110px] text-center text-sm font-medium">
            {format(displayDate, 'yyyy年M月', { locale: ja })}
          </span>
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">今月の収入</CardTitle>
            <TrendingUp className="h-4 w-4 text-[var(--color-income)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[var(--color-income)]">{formatYen(totalIncome)}</div>
            <p className="mt-1 text-xs text-muted-foreground">予算 {formatYen(plannedIncome)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">今月の支出</CardTitle>
            <TrendingDown className="h-4 w-4 text-[var(--color-expense)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[var(--color-expense)]">{formatYen(totalExpense)}</div>
            <p className="mt-1 text-xs text-muted-foreground">予算 {formatYen(budgetLimit)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">月次差額</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatYen(balance)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">同棲モード: {LIVING_MODE_LABELS[livingMode]}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">予算残り</CardTitle>
            <PieChart className="h-4 w-4 text-[var(--color-info)]" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${remaining >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatYen(remaining)}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${remaining < 0 ? 'bg-destructive' : 'bg-[var(--color-expense)]'}`}
                style={{ width: `${budgetLimit > 0 ? Math.min(100, (totalExpense / budgetLimit) * 100) : 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{selectedYear}年の月次キャッシュフロー</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyCashflow}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D7E4DD" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(value) => `${Math.round(value / 10000)}万`} tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              <Bar dataKey="income" name="収入" fill="#22C55E" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="支出" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">今月の支出内訳</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                <ResponsiveContainer width="100%" height={260}>
                  <RechartsPieChart>
                    <Tooltip formatter={(value) => formatYen(Number(value || 0))} />
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </RechartsPieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {pieData.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-sm">{entry.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatYen(entry.value)}</p>
                        <p className="text-xs text-muted-foreground">
                          {totalExpense > 0 ? `${Math.round((entry.value / totalExpense) * 100)}%` : '0%'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">支出データがありません</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">今月の取引</CardTitle>
            <Badge variant="outline">{transactions?.length || 0}件</Badge>
          </CardHeader>
          <CardContent>
            {transactions && transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.slice(0, 8).map((transaction) => (
                  <div key={`${transaction.transactionType}-${transaction.id}`} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">
                        {transaction.transactionType === 'income' ? '収入' : '支出'} / {transaction.category}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {transaction.date}
                        {transaction.memo ? ` ・ ${transaction.memo}` : ''}
                      </p>
                    </div>
                    <p className={`font-semibold ${transaction.transactionType === 'income' ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'}`}>
                      {transaction.transactionType === 'income' ? '+' : '-'}{formatYen(transaction.amount).replace('¥', '')}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">取引データがありません</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
