'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Plus, Download, AlertTriangle, CheckCircle2, Pencil, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/lib/hooks/use-auth'
import { useBudget, useBudgetCategories, useCreateBudget, useUpsertBudgetCategory, useSeedBudget, type BudgetCategoryWithDetail } from '@/lib/hooks/use-budgets'
import { useMonthlyExpenseSummary } from '@/lib/hooks/use-expenses'
import { useExpenseCategories } from '@/lib/hooks/use-categories'
import { useFinanceStore } from '@/stores/finance-store'
import { toast } from 'sonner'

export default function BudgetsPage() {
  const { couple } = useAuth()
  const { selectedMonth } = useFinanceStore()
  const { data: budget, refetch: refetchBudget } = useBudget(couple?.id, selectedMonth)
  const { data: budgetCategories } = useBudgetCategories(budget?.id)
  const { data: summary } = useMonthlyExpenseSummary(couple?.id, selectedMonth)
  const { data: allCategories } = useExpenseCategories(couple?.id)
  const createBudget = useCreateBudget()
  const upsertBudgetCategory = useUpsertBudgetCategory()
  const seedBudget = useSeedBudget()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [totalLimit, setTotalLimit] = useState('')
  const [editing, setEditing] = useState(false)
  const [editAmounts, setEditAmounts] = useState<Record<string, string>>({})

  // Initialize edit amounts from budget categories
  useEffect(() => {
    if (budgetCategories) {
      const amounts: Record<string, string> = {}
      for (const bc of budgetCategories) {
        amounts[bc.category_id] = String(Number(bc.limit_amount) || 0)
      }
      setEditAmounts(amounts)
    }
  }, [budgetCategories])

  const handleCreate = async () => {
    if (!totalLimit) { toast.error('予算額を入力してください'); return }
    if (!couple?.id) { toast.error('ログインが必要です'); return }
    try {
      await createBudget.mutateAsync({
        couple_id: couple.id,
        year_month: selectedMonth,
        total_limit: Number(totalLimit),
      })
      setTotalLimit('')
      setDialogOpen(false)
      toast.success('予算を設定しました')
    } catch {
      toast.error('予算の設定に失敗しました')
    }
  }

  const handleSeed = async () => {
    try {
      const result = await seedBudget.mutateAsync()
      toast.success(result.message)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'インポートに失敗しました')
    }
  }

  // Computed total from edit amounts (linked variable)
  const editTotal = Object.values(editAmounts).reduce((sum, v) => sum + (Number(v) || 0), 0)

  const handleEditAmount = (categoryId: string, value: string) => {
    setEditAmounts((prev) => ({ ...prev, [categoryId]: value }))
  }

  const handleAddCategory = (categoryId: string) => {
    if (editAmounts[categoryId] !== undefined) return
    setEditAmounts((prev) => ({ ...prev, [categoryId]: '0' }))
  }

  const handleSaveAll = useCallback(async () => {
    if (!budget?.id) return
    try {
      // Save each category budget
      for (const [categoryId, amount] of Object.entries(editAmounts)) {
        await upsertBudgetCategory.mutateAsync({
          budget_id: budget.id,
          category_id: categoryId,
          limit_amount: Number(amount) || 0,
          alert_ratio: 0.80,
        })
      }

      // Update total_limit to match sum of categories
      const supabase = (await import('@/lib/supabase/client')).createClient()
      await supabase
        .from('budgets')
        .update({ total_limit: editTotal })
        .eq('id', budget.id)

      await refetchBudget()
      setEditing(false)
      toast.success('予算を保存しました')
    } catch {
      toast.error('保存に失敗しました')
    }
  }, [budget?.id, editAmounts, editTotal, upsertBudgetCategory, refetchBudget])

  const spent = summary?.total || 0
  const limit = budget?.total_limit ? Number(budget.total_limit) : 0
  const remaining = limit - spent
  const percentage = limit > 0 ? (spent / limit) * 100 : 0

  const [year, month] = selectedMonth.split('-').map(Number)
  const displayDate = new Date(year, month - 1, 1)

  // Build comparison rows
  const comparisonRows = (budgetCategories || []).map((bc) => {
    const catName = bc.expense_categories?.name || '不明'
    const catIcon = bc.expense_categories?.icon || '📦'
    const budgetAmount = editing ? (Number(editAmounts[bc.category_id]) || 0) : (Number(bc.limit_amount) || 0)
    const actualAmount = summary?.byCategory?.[bc.category_id]?.total || 0
    const diff = budgetAmount - actualAmount
    const pct = budgetAmount > 0 ? (actualAmount / budgetAmount) * 100 : 0
    return { catName, catIcon, budgetAmount, actualAmount, diff, pct, categoryId: bc.category_id }
  })

  // New categories added during editing (not yet in budgetCategories)
  const newCategoryRows = Object.entries(editAmounts)
    .filter(([id]) => !budgetCategories?.some((bc) => bc.category_id === id))
    .map(([id, amount]) => {
      const cat = allCategories?.find((c) => c.id === id)
      const budgetAmount = Number(amount) || 0
      const actualAmount = summary?.byCategory?.[id]?.total || 0
      return {
        catName: cat?.name || '不明',
        catIcon: cat?.icon || '📦',
        budgetAmount,
        actualAmount,
        diff: budgetAmount - actualAmount,
        pct: budgetAmount > 0 ? (actualAmount / budgetAmount) * 100 : 0,
        categoryId: id,
      }
    })

  const allRows = [...comparisonRows, ...newCategoryRows]

  // Unbudgeted categories (categories with spending but no budget)
  const unbudgetedCategories = Object.entries(summary?.byCategory || {}).filter(
    ([id]) => !allRows.some((r) => r.categoryId === id)
  )

  // Categories available to add
  const addableCategories = allCategories?.filter(
    (c) => !allRows.some((r) => r.categoryId === c.id)
  ) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-bold">
          {format(displayDate, 'yyyy年M月', { locale: ja })}の予算
        </h2>
        <div className="flex gap-2">
          {budget && !editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" />
              編集
            </Button>
          )}
          {editing && (
            <Button size="sm" onClick={handleSaveAll} disabled={upsertBudgetCategory.isPending}>
              <Save className="h-4 w-4 mr-1" />
              保存
            </Button>
          )}
          {!budget && (
            <>
              <Button size="sm" variant="outline" onClick={handleSeed} disabled={seedBudget.isPending}>
                <Download className="h-4 w-4 mr-1" />
                {seedBudget.isPending ? 'インポート中...' : 'Excelデータ反映'}
              </Button>
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                手動設定
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Create Budget Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>予算を設定</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>月の予算額（円）</Label>
              <Input
                type="number"
                placeholder="321500"
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

      {budget ? (
        <>
          {/* Overall Budget Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">全体予算</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>支出: ¥{spent.toLocaleString()}</span>
                <span>予算: ¥{(editing ? editTotal : limit).toLocaleString()}</span>
              </div>
              <div className="h-4 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    percentage > 100 ? 'bg-destructive' : percentage > 80 ? 'bg-[#85B59B]' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(100, percentage)}%` }}
                />
              </div>
              <div className="text-center">
                <span className={`text-2xl font-bold ${remaining < 0 ? 'text-destructive' : ''}`}>
                  ¥{(editing ? editTotal - spent : remaining).toLocaleString()}
                </span>
                <p className="text-xs text-muted-foreground">
                  {(editing ? editTotal - spent : remaining) >= 0 ? '残り' : '超過'}
                  {!editing && `（${percentage.toFixed(0)}%使用）`}
                  {editing && '（編集中 — 合計は自動計算）'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Budget vs Actual - editable */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {editing ? '予算編集（カテゴリ別）' : '予算 vs 実績'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Header */}
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-xs text-muted-foreground border-b pb-2 mb-2">
                <span>カテゴリ</span>
                <span className="text-right w-24">予算</span>
                <span className="text-right w-20">実績</span>
                <span className="text-right w-20">差額</span>
              </div>

              <div className="space-y-3">
                {allRows.map((row) => (
                  <div key={row.categoryId}>
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center text-sm">
                      <span className="flex items-center gap-1">
                        <span>{row.catIcon}</span>
                        <span className="truncate">{row.catName}</span>
                      </span>
                      {editing ? (
                        <Input
                          type="number"
                          className="w-24 h-7 text-right text-sm"
                          value={editAmounts[row.categoryId] || '0'}
                          onChange={(e) => handleEditAmount(row.categoryId, e.target.value)}
                        />
                      ) : (
                        <span className="text-right w-24 text-muted-foreground">
                          ¥{row.budgetAmount.toLocaleString()}
                        </span>
                      )}
                      <span className="text-right w-20 font-medium">
                        ¥{row.actualAmount.toLocaleString()}
                      </span>
                      <span className={`text-right w-20 font-medium ${row.diff < 0 ? 'text-destructive' : 'text-primary'}`}>
                        {row.diff >= 0 ? '+' : ''}¥{row.diff.toLocaleString()}
                      </span>
                    </div>
                    {!editing && (
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
                        <div
                          className={`h-full rounded-full transition-all ${
                            row.pct > 100 ? 'bg-destructive' : row.pct > 80 ? 'bg-[#85B59B]' : 'bg-primary'
                          }`}
                          style={{ width: `${Math.min(100, row.pct)}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add category button in edit mode */}
              {editing && addableCategories.length > 0 && (
                <div className="mt-4 pt-3 border-t">
                  <p className="text-xs text-muted-foreground mb-2">カテゴリを追加:</p>
                  <div className="flex flex-wrap gap-1">
                    {addableCategories.map((cat) => (
                      <Button
                        key={cat.id}
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => handleAddCategory(cat.id)}
                      >
                        {cat.icon} {cat.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Totals row */}
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-t mt-4 pt-3 text-sm font-bold">
                <span>合計</span>
                <span className="text-right w-24">
                  ¥{(editing ? editTotal : allRows.reduce((s, r) => s + r.budgetAmount, 0)).toLocaleString()}
                </span>
                <span className="text-right w-20">
                  ¥{allRows.reduce((s, r) => s + r.actualAmount, 0).toLocaleString()}
                </span>
                <span className={`text-right w-20 ${
                  allRows.reduce((s, r) => s + r.diff, 0) < 0 ? 'text-destructive' : 'text-primary'
                }`}>
                  {allRows.reduce((s, r) => s + r.diff, 0) >= 0 ? '+' : ''}
                  ¥{allRows.reduce((s, r) => s + r.diff, 0).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Status Alerts (hide in edit mode) */}
          {!editing && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ステータス</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {allRows.filter((r) => r.pct > 80).length > 0 ? (
                  allRows
                    .filter((r) => r.pct > 80)
                    .sort((a, b) => b.pct - a.pct)
                    .map((row) => (
                      <div
                        key={row.categoryId}
                        className={`flex items-center gap-2 text-sm p-2 rounded-lg ${
                          row.pct > 100 ? 'bg-destructive/10 text-destructive' : 'bg-[#85B59B]/20 text-foreground'
                        }`}
                      >
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>
                          {row.catIcon} {row.catName}: {row.pct.toFixed(0)}%使用
                          {row.pct > 100 && `（¥${Math.abs(row.diff).toLocaleString()} 超過）`}
                        </span>
                      </div>
                    ))
                ) : (
                  <div className="flex items-center gap-2 text-sm text-primary p-2 rounded-lg bg-primary/10">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>全カテゴリ予算内です</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Unbudgeted spending */}
          {!editing && unbudgetedCategories.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">予算未設定の支出</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {unbudgetedCategories.map(([id, cat]) => (
                  <div key={id} className="flex justify-between text-sm">
                    <span>{cat.icon} {cat.name}</span>
                    <span className="text-muted-foreground">¥{cat.total.toLocaleString()}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="p-12 text-center space-y-4">
            <p className="text-muted-foreground">予算が設定されていません</p>
            <p className="text-sm text-muted-foreground">
              「Excelデータ反映」で予算を一括インポートするか、「手動設定」で作成できます
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
