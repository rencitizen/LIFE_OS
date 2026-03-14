'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Wallet, PieChart, LineChart, ArrowRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/hooks/use-auth'
import { useMonthlyExpenseSummary } from '@/lib/hooks/use-expenses'
import { useIncomes } from '@/lib/hooks/use-incomes'
import { useBudget, useBudgetMemberLimits } from '@/lib/hooks/use-budgets'
import { getBudgetLimitTotal } from '@/lib/budget-utils'
import { usePlanVsActual } from '@/lib/hooks/use-plan-vs-actual'
import { useFinanceStore } from '@/stores/finance-store'

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-card p-3 shadow-md">
      <p className="text-sm font-medium mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {yen(entry.value)}
        </p>
      ))}
    </div>
  )
}

export default function FinanceDashboardPage() {
  const { couple } = useAuth()
  const { selectedMonth, setSelectedMonth } = useFinanceStore()

  const { data: summary } = useMonthlyExpenseSummary(couple?.id, selectedMonth)
  const { data: incomes } = useIncomes(couple?.id, selectedMonth)
  const { data: budget } = useBudget(couple?.id, selectedMonth)
  const { data: budgetMemberLimits } = useBudgetMemberLimits(budget?.id)
  const { currentYear } = usePlanVsActual(couple?.id)

  const totalIncome = incomes?.reduce((sum, i) => sum + Number(i.amount), 0) || 0
  const balance = totalIncome - (summary?.total || 0)
  const budgetLimit = getBudgetLimitTotal(budget, budgetMemberLimits)

  const navigateMonth = (direction: number) => {
    const [y, m] = selectedMonth.split('-').map(Number)
    const date = new Date(y, m - 1 + direction, 1)
    setSelectedMonth(format(date, 'yyyy-MM'))
  }

  const [year, month] = selectedMonth.split('-').map(Number)
  const displayDate = new Date(year, month - 1, 1)

  // Plan vs Actual for this month
  const currentMonthIdx = month - 1
  const planMonth = currentYear?.months[currentMonthIdx]

  // Mini chart data: last few months of plan vs actual expenses
  const miniChartData = useMemo(() => {
    if (!currentYear) return []
    const now = new Date()
    const endMonth = now.getMonth() // 0-indexed
    return currentYear.months.slice(0, endMonth + 1).slice(-6).map((m) => ({
      name: m.label,
      計画: m.plannedExpense,
      実績: m.actualExpense,
    }))
  }, [currentYear])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">CFOダッシュボード</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[100px] text-center">
            {format(displayDate, 'yyyy年M月', { locale: ja })}
          </span>
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">収入</CardTitle>
            <TrendingUp className="h-4 w-4 text-[#85B59B]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1E5945]">
              {yen(totalIncome)}
            </div>
            {planMonth && (
              <p className="text-xs text-muted-foreground mt-1">
                計画: {yen(planMonth.plannedIncome)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">支出合計</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {yen(summary?.total || 0)}
            </div>
            {planMonth && (
              <p className="text-xs text-muted-foreground mt-1">
                計画: {yen(planMonth.plannedExpense)}
                {(summary?.total || 0) > planMonth.plannedExpense && (
                  <span className="text-destructive ml-1">
                    (+{yen((summary?.total || 0) - planMonth.plannedExpense)})
                  </span>
                )}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">収支バランス</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? 'text-[#1E5945]' : 'text-destructive'}`}>
              {yen(balance)}
            </div>
            {planMonth && (
              <p className="text-xs text-muted-foreground mt-1">
                計画: {yen(planMonth.plannedIncome - planMonth.plannedExpense)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">予算残り</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {budgetLimit > 0 ? (
              <>
                <div className="text-2xl font-bold">
                  {yen(budgetLimit - (summary?.total || 0))}
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.min(100, ((summary?.total || 0) / budgetLimit) * 100)}%`,
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">未設定</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan vs Actual Mini Chart + Link */}
      {miniChartData.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">支出 計画 vs 実績</CardTitle>
            <Link href="/finance/analysis">
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                詳細分析 <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={miniChartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 10000)}万`} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Bar dataKey="計画" fill="#D9D9D9" radius={[3, 3, 0, 0]} />
                <Bar dataKey="実績" fill="#1E5945" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Fixed vs Variable + Category */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">固定費 vs 変動費</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">固定費</span>
                <span className="font-medium">{yen(summary?.fixed || 0)}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#1E5945]"
                  style={{
                    width: summary?.total ? `${(summary.fixed / summary.total) * 100}%` : '0%',
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">変動費</span>
                <span className="font-medium">{yen(summary?.variable || 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">カテゴリ別支出</CardTitle>
          </CardHeader>
          <CardContent>
            {summary?.byCategory && Object.keys(summary.byCategory).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(summary.byCategory)
                  .sort((a, b) => b[1].total - a[1].total)
                  .slice(0, 8)
                  .map(([id, cat]) => (
                    <div key={id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{cat.icon || ''}</span>
                        <span className="text-sm">{cat.name}</span>
                      </div>
                      <span className="text-sm font-medium">{yen(cat.total)}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">支出データがありません</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Shared vs Personal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">共有 vs 個人</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 rounded-md bg-muted/50">
              <p className="text-sm text-muted-foreground">共有支出</p>
              <p className="text-xl font-bold mt-1">{yen(summary?.shared || 0)}</p>
            </div>
            <div className="text-center p-4 rounded-md bg-muted/50">
              <p className="text-sm text-muted-foreground">個人支出</p>
              <p className="text-xl font-bold mt-1">{yen(summary?.personal || 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
