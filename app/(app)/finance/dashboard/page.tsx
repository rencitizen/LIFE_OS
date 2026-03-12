'use client'

import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Wallet, PieChart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/hooks/use-auth'
import { useMonthlyExpenseSummary } from '@/lib/hooks/use-expenses'
import { useIncomes } from '@/lib/hooks/use-incomes'
import { useBudget } from '@/lib/hooks/use-budgets'
import { useFinanceStore } from '@/stores/finance-store'

export default function FinanceDashboardPage() {
  const { couple } = useAuth()
  const { selectedMonth, setSelectedMonth } = useFinanceStore()

  const { data: summary } = useMonthlyExpenseSummary(couple?.id, selectedMonth)
  const { data: incomes } = useIncomes(couple?.id, selectedMonth)
  const { data: budget } = useBudget(couple?.id, selectedMonth)

  const totalIncome = incomes?.reduce((sum, i) => sum + Number(i.amount), 0) || 0
  const balance = totalIncome - (summary?.total || 0)

  const navigateMonth = (direction: number) => {
    const [y, m] = selectedMonth.split('-').map(Number)
    const date = new Date(y, m - 1 + direction, 1)
    setSelectedMonth(format(date, 'yyyy-MM'))
  }

  const [year, month] = selectedMonth.split('-').map(Number)
  const displayDate = new Date(year, month - 1, 1)

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
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ¥{totalIncome.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">支出合計</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              ¥{(summary?.total || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.count || 0}件
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">収支バランス</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              ¥{balance.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">予算残り</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {budget?.total_limit ? (
              <>
                <div className="text-2xl font-bold">
                  ¥{(Number(budget.total_limit) - (summary?.total || 0)).toLocaleString()}
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.min(100, ((summary?.total || 0) / Number(budget.total_limit)) * 100)}%`,
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

      {/* Fixed vs Variable */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">固定費 vs 変動費</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">固定費</span>
                <span className="font-medium">¥{(summary?.fixed || 0).toLocaleString()}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{
                    width: summary?.total ? `${(summary.fixed / summary.total) * 100}%` : '0%',
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">変動費</span>
                <span className="font-medium">¥{(summary?.variable || 0).toLocaleString()}</span>
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
                      <span className="text-sm font-medium">¥{cat.total.toLocaleString()}</span>
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
              <p className="text-xl font-bold mt-1">¥{(summary?.shared || 0).toLocaleString()}</p>
            </div>
            <div className="text-center p-4 rounded-md bg-muted/50">
              <p className="text-sm text-muted-foreground">個人支出</p>
              <p className="text-xl font-bold mt-1">¥{(summary?.personal || 0).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
