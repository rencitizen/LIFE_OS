'use client'

import Link from 'next/link'
import { useMemo } from 'react'
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
import { useExpenses } from '@/lib/hooks/use-expenses'
import { useIncomes } from '@/lib/hooks/use-incomes'
import { useFinanceStore } from '@/stores/finance-store'

const PIE_COLORS = ['#9fdfad', '#f29a90', '#ffe985', '#8fc8f4', '#c8ddc2', '#ffd1cb', '#b8dcff']

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
  const relationLineExpensePct = actualIncome > 0 ? Math.min(100, Math.max(0, (actualExpense / actualIncome) * 100)) : 0
  const relationLineBalancePct = actualIncome > 0 ? Math.min(100, Math.max(0, (actualBalance / actualIncome) * 100)) : 0

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
        <Card tone="mint">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">収入</CardTitle>
            <Wallet className="h-4 w-4 text-[var(--color-income)]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--color-income)]">{formatYen(actualIncome)}</div>
            <p className="mt-1 text-xs text-muted-foreground">{scopedIncomes.length} 件の収入</p>
          </CardContent>
        </Card>

        <Card tone="blue">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">支出</CardTitle>
            <Wallet className="h-4 w-4 text-[var(--color-expense)]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--color-expense)]">{formatYen(actualExpense)}</div>
            <p className="mt-1 text-xs text-muted-foreground">{scopedExpenseRows.length} 件の支出</p>
          </CardContent>
        </Card>

        <Card tone="cyan">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">収支</CardTitle>
            <Wallet className="h-4 w-4 text-[var(--color-info)]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--color-info)]">{formatSignedYen(actualBalance)}</div>
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
                      className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--color-income)]"
                      style={{ left: `${relationLineExpensePct}%`, width: `${relationLineBalancePct}%` }}
                    />
                    <div
                      className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-[var(--color-expense)]"
                      style={{ left: `${relationLineExpensePct}%` }}
                    />
                    <div
                      className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-[var(--color-income)]"
                      style={{ left: '100%' }}
                    />
                    <div className="absolute left-0 top-0 -translate-y-1 text-[10px] font-medium text-[var(--color-income)]">
                      収入
                    </div>
                    <div className="absolute top-0 -translate-y-1 -translate-x-1/2 text-[10px] font-medium text-[var(--color-expense)]" style={{ left: `${relationLineExpensePct}%` }}>
                      支出点
                    </div>
                    <div className="absolute right-0 top-0 -translate-y-1 text-[10px] font-medium text-[var(--color-income)]">
                      収支点
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-[var(--color-income)]">収入 {formatYen(actualIncome)}</span>
                    <span className="text-[var(--color-expense)]">支出 {formatYen(actualExpense)}</span>
                    <span className="text-[var(--color-info)]">収支 {formatSignedYen(actualBalance)}</span>
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
                      <span className="block font-medium text-[var(--color-info)]">収支</span>
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
          <CardHeader>
            <CardTitle className="text-base">支出構成</CardTitle>
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
              <p className="text-sm text-muted-foreground">支出を追加すると支出構成グラフが表示されます。</p>
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
