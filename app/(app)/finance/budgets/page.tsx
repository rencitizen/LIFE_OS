'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useAuth } from '@/lib/hooks/use-auth'
import { useBudget, useCreateBudget } from '@/lib/hooks/use-budgets'
import { useMonthlyExpenseSummary } from '@/lib/hooks/use-expenses'
import { useFinanceStore } from '@/stores/finance-store'

export default function BudgetsPage() {
  const { couple } = useAuth()
  const { selectedMonth } = useFinanceStore()
  const { data: budget } = useBudget(couple?.id, selectedMonth)
  const { data: summary } = useMonthlyExpenseSummary(couple?.id, selectedMonth)
  const createBudget = useCreateBudget()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [totalLimit, setTotalLimit] = useState('')

  const handleCreate = async () => {
    if (!totalLimit || !couple?.id) return
    await createBudget.mutateAsync({
      couple_id: couple.id,
      year_month: selectedMonth,
      total_limit: Number(totalLimit),
    })
    setTotalLimit('')
    setDialogOpen(false)
  }

  const spent = summary?.total || 0
  const limit = budget?.total_limit ? Number(budget.total_limit) : 0
  const remaining = limit - spent
  const percentage = limit > 0 ? (spent / limit) * 100 : 0

  const [year, month] = selectedMonth.split('-').map(Number)
  const displayDate = new Date(year, month - 1, 1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          {format(displayDate, 'yyyy年M月', { locale: ja })}の予算
        </h2>
        {!budget && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={<Button size="sm" />}
            >
              <Plus className="h-4 w-4 mr-1" />
              予算設定
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>予算を設定</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>月の予算額（円）</Label>
                  <Input
                    type="number"
                    placeholder="300000"
                    value={totalLimit}
                    onChange={(e) => setTotalLimit(e.target.value)}
                  />
                </div>
                <Button onClick={handleCreate} className="w-full" disabled={createBudget.isPending}>
                  設定
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {budget ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">全体予算</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>使用済み: ¥{spent.toLocaleString()}</span>
                <span>予算: ¥{limit.toLocaleString()}</span>
              </div>
              <div className="h-4 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    percentage > 100 ? 'bg-destructive' : percentage > 80 ? 'bg-yellow-500' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(100, percentage)}%` }}
                />
              </div>
              <div className="text-center">
                <span className={`text-2xl font-bold ${remaining < 0 ? 'text-destructive' : ''}`}>
                  ¥{remaining.toLocaleString()}
                </span>
                <p className="text-xs text-muted-foreground">
                  {remaining >= 0 ? '残り' : '超過'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Category budgets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">カテゴリ別予算</CardTitle>
            </CardHeader>
            <CardContent>
              {summary?.byCategory && Object.keys(summary.byCategory).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(summary.byCategory).map(([id, cat]) => (
                    <div key={id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{cat.icon} {cat.name}</span>
                        <span>¥{cat.total.toLocaleString()}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{ width: `${Math.min(100, limit > 0 ? (cat.total / limit) * 100 : 0)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">データなし</p>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">予算が設定されていません</p>
            <p className="text-sm text-muted-foreground mt-1">上のボタンから予算を設定しましょう</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
