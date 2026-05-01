'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { addMonths, format } from 'date-fns'
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UI_ACCENT_COLORS } from '@/lib/finance/constants'
import { FINANCE_SCOPE_LABELS, filterByFinanceScope } from '@/lib/finance/scope'
import { formatYen } from '@/lib/finance/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useExpenses } from '@/lib/hooks/use-expenses'
import { useIncomes } from '@/lib/hooks/use-incomes'
import { useFinanceStore } from '@/stores/finance-store'

const PIE_COLORS = ['#093C5D', '#3B7597', '#6FD1D7', '#5DF8D8']

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
  const { data: monthIncomes } = useIncomes(couple?.id, selectedMonth)

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

  const monthlyPlSeries = useMemo(
    () => [
      { label: 'Income', value: actualIncome, fill: UI_ACCENT_COLORS.income },
      { label: 'Expense', value: actualExpense, fill: UI_ACCENT_COLORS.expense },
      { label: 'Balance', value: Math.abs(actualBalance), fill: actualBalance >= 0 ? UI_ACCENT_COLORS.primary : '#EF4444' },
    ],
    [actualBalance, actualExpense, actualIncome]
  )

  const expensePieData = useMemo(() => {
    const totals = new Map<string, number>()

    for (const row of scopedExpenseRows) {
      const name = row.expense_categories?.name || 'Uncategorized'
      totals.set(name, (totals.get(name) || 0) + Number(row.amount))
    }

    const rows = Array.from(totals.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    return rows
  }, [scopedExpenseRows])

  const navigateMonth = (direction: number) => {
    const nextDate = addMonths(displayDate, direction)
    setSelectedMonth(format(nextDate, 'yyyy-MM'))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Monthly overview</h1>
          <p className="text-sm text-muted-foreground">
            PL cockpit focused on income, expense, and monthly balance for {FINANCE_SCOPE_LABELS[financeScope]}.
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
        <Card tone="mint">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-[var(--color-income)]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--color-income)]">{formatYen(actualIncome)}</div>
            <p className="mt-1 text-xs text-muted-foreground">{scopedIncomes.length} income entries</p>
          </CardContent>
        </Card>

        <Card tone="blue">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expense</CardTitle>
            <TrendingDown className="h-4 w-4 text-[var(--color-expense)]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--color-expense)]">{formatYen(actualExpense)}</div>
            <p className="mt-1 text-xs text-muted-foreground">{scopedExpenseRows.length} expense entries</p>
          </CardContent>
        </Card>

        <Card tone="cyan">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${actualBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatSignedYen(actualBalance)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Income minus expense for the selected month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <Card tone="cyan">
          <CardHeader>
            <CardTitle className="text-base">Monthly PL graph</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyPlSeries.some((row) => row.value > 0) ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyPlSeries} layout="vertical" margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                      tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
                    />
                    <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} fontSize={12} width={56} />
                    <Tooltip formatter={formatTooltipCurrency} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {monthlyPlSeries.map((row) => (
                        <Cell key={row.label} fill={row.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Add income or expense entries to populate the monthly PL graph.</p>
            )}
          </CardContent>
        </Card>

        <Card tone="cyan">
          <CardHeader>
            <CardTitle className="text-base">Expense mix</CardTitle>
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
                  {expensePieData.slice(0, 6).map((row, index) => (
                    <div key={row.name} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                        />
                        <span className="truncate">{row.name}</span>
                      </div>
                      <span className="shrink-0 font-medium">{formatYen(row.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Add expense entries to populate the expense mix chart.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/finance/expenses" className="rounded-xl border bg-[var(--color-info-soft)] p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm">
          <p className="text-sm font-medium">Open transactions</p>
          <p className="mt-1 text-xs text-muted-foreground">Review and edit monthly income and expense entries.</p>
        </Link>
        <Link href="/finance/analysis" className="rounded-xl border bg-[var(--color-success-soft)] p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm">
          <p className="text-sm font-medium">Open analysis</p>
          <p className="mt-1 text-xs text-muted-foreground">Dive deeper into category and year-over-year detail.</p>
        </Link>
        <Link href="/finance/budgets" className="rounded-xl border bg-[var(--color-expense-soft)] p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm">
          <p className="text-sm font-medium">Open budgets</p>
          <p className="mt-1 text-xs text-muted-foreground">Adjust the monthly budget baseline used across finance views.</p>
        </Link>
      </div>
    </div>
  )
}
