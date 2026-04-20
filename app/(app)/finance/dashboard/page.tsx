'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Landmark, NotebookPen, ReceiptText, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LIVING_MODE_LABELS, LIVING_MODES } from '@/lib/finance/constants'
import { formatYen } from '@/lib/finance/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useAccountBalanceSummary } from '@/lib/hooks/use-accounts'
import { useBudget } from '@/lib/hooks/use-budgets'
import { useExpenses, useMonthlyExpenseSummary } from '@/lib/hooks/use-expenses'
import { useIncomes } from '@/lib/hooks/use-incomes'
import { useLifePlanConfig, useSimulation } from '@/lib/hooks/use-life-plan'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/stores/finance-store'
import { toast } from 'sonner'
import type { LivingMode } from '@/types'

function formatSignedYen(value: number) {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${formatYen(Math.abs(value))}`
}

function getBalanceTone(value: number) {
  return value >= 0 ? 'text-[#22C55E]' : 'text-destructive'
}

function getDiffTone(value: number, smallerIsBetter = false) {
  const positive = smallerIsBetter ? value <= 0 : value >= 0
  return positive ? 'text-primary' : 'text-destructive'
}

export default function FinanceDashboardPage() {
  const { couple } = useAuth()
  const supabase = createClient()
  const lifePlanConfig = useLifePlanConfig(couple?.id)
  const simulation = useSimulation(lifePlanConfig)
  const { selectedMonth, setSelectedMonth, livingMode, setLivingMode } = useFinanceStore()
  const { data: monthExpenses } = useMonthlyExpenseSummary(couple?.id, selectedMonth)
  const { data: expenseRows } = useExpenses(couple?.id, selectedMonth)
  const { data: monthIncomes } = useIncomes(couple?.id, selectedMonth)
  const { data: accountSummary } = useAccountBalanceSummary(couple?.id)
  const { data: budget } = useBudget(couple?.id, selectedMonth)

  const [savingMode, setSavingMode] = useState(false)
  const [year, month] = selectedMonth.split('-').map(Number)
  const displayDate = new Date(year, month - 1, 1)
  const selectedYear = Number(selectedMonth.slice(0, 4))

  const actualIncome = useMemo(
    () => (monthIncomes || []).reduce((sum, row) => sum + Number(row.amount), 0),
    [monthIncomes]
  )
  const actualExpense = monthExpenses?.total || 0
  const actualBalance = actualIncome - actualExpense

  const yearPlan = useMemo(() => {
    const index = simulation.household.findIndex((row) => row.year === selectedYear)
    if (index < 0) return null

    return {
      income: Math.round(simulation.household[index].householdNet / 12),
      expense: Math.round((simulation.ren[index].livingCost + simulation.hikaru[index].livingCost) / 12),
      asset: simulation.household[index].householdTotalAssets,
    }
  }, [selectedYear, simulation.household, simulation.hikaru, simulation.ren])

  const plannedIncome = yearPlan?.income || 0
  const plannedExpense = Number(budget?.total_limit) || yearPlan?.expense || 0
  const plannedBalance = plannedIncome - plannedExpense

  const openingAssetsTotal =
    lifePlanConfig.initialAssets.ren.cash +
    lifePlanConfig.initialAssets.ren.nisa +
    lifePlanConfig.initialAssets.ren.taxable +
    lifePlanConfig.initialAssets.hikaru.cash +
    lifePlanConfig.initialAssets.hikaru.nisa +
    lifePlanConfig.initialAssets.hikaru.taxable

  const netWorth = (accountSummary?.netWorth ?? 0) + openingAssetsTotal
  const assetGap = yearPlan ? netWorth - yearPlan.asset : 0

  const topCategories = useMemo(() => {
    const totals = new Map<string, number>()

    for (const row of expenseRows || []) {
      const name = row.expense_categories?.name || '未分類'
      totals.set(name, (totals.get(name) || 0) + Number(row.amount))
    }

    return Array.from(totals.entries())
      .map(([name, total]) => ({
        name,
        total,
        ratio: actualExpense > 0 ? (total / actualExpense) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [actualExpense, expenseRows])

  const latestExpenseDate = expenseRows?.[0]?.expense_date || null
  const latestIncomeDate = monthIncomes?.[0]?.income_date || null

  const navigateMonth = (direction: number) => {
    const nextDate = new Date(year, month - 1 + direction, 1)
    setSelectedMonth(format(nextDate, 'yyyy-MM'))
  }

  const handleLivingModeChange = async (mode: LivingMode) => {
    setLivingMode(mode)
    if (!couple?.id) return

    setSavingMode(true)
    try {
      const { error } = await supabase.from('couples').update({ living_mode: mode }).eq('id', couple.id)
      if (error) throw error
    } catch {
      toast.error('同居モードの更新に失敗しました')
    } finally {
      setSavingMode(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {LIVING_MODE_LABELS[livingMode]}
            </span>
            <span className="text-sm text-muted-foreground">月末にまとめて入力する前提の見え方です</span>
          </div>
          <h1 className="text-2xl font-bold">{format(displayDate, 'yyyy年M月', { locale: ja })} の家計レビュー</h1>
          <p className="text-sm text-muted-foreground">まず今月の締め結果、その次に差異、最後に資産だけ確認できる構成にしています。</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">今月の締め結果</CardTitle>
            <NotebookPen className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-2">
            <p className={`text-3xl font-bold ${getBalanceTone(actualBalance)}`}>{formatSignedYen(actualBalance)}</p>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">収入</span>
                <span>{formatYen(actualIncome)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">支出</span>
                <span>{formatYen(actualExpense)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">入力状況</CardTitle>
            <ReceiptText className="h-4 w-4 text-[var(--color-info)]" />
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">支出件数</span>
              <span className="font-medium">{monthExpenses?.count || 0}件</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">収入件数</span>
              <span className="font-medium">{monthIncomes?.length || 0}件</span>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p>最新の支出入力: {latestExpenseDate || '未入力'}</p>
              <p className="mt-1">最新の収入入力: {latestIncomeDate || '未入力'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">純資産</CardTitle>
            <Landmark className="h-4 w-4 text-[var(--color-info)]" />
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-bold text-primary">{formatYen(netWorth)}</p>
            <p className={`text-sm font-medium ${assetGap >= 0 ? 'text-primary' : 'text-destructive'}`}>
              計画との差: {formatSignedYen(assetGap)}
            </p>
            <p className="text-xs text-muted-foreground">リアルタイム残高ではなく、月末時点の確認用として見せています。</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">今月の差異はこの3つだけ見れば足ります</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                label: '収入',
                actual: actualIncome,
                planned: plannedIncome,
                diff: actualIncome - plannedIncome,
                smallerIsBetter: false,
              },
              {
                label: '支出',
                actual: actualExpense,
                planned: plannedExpense,
                diff: actualExpense - plannedExpense,
                smallerIsBetter: true,
              },
              {
                label: '収支',
                actual: actualBalance,
                planned: plannedBalance,
                diff: actualBalance - plannedBalance,
                smallerIsBetter: false,
              },
            ].map((row) => (
              <div key={row.label} className="rounded-xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{row.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">計画 {formatYen(row.planned)} / 実績 {formatYen(row.actual)}</p>
                  </div>
                  <div className={`text-right text-lg font-semibold ${getDiffTone(row.diff, row.smallerIsBetter)}`}>
                    {formatSignedYen(row.diff)}
                  </div>
                </div>
              </div>
            ))}

            <div className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
              {actualExpense === 0 && actualIncome === 0
                ? 'まだ今月の記録が入っていません。月末にまとめて入力する使い方なら正常です。'
                : actualBalance >= plannedBalance
                  ? '今月は計画より良い着地です。細かい数字より、この差だけ見れば十分です。'
                  : '今月は計画を下回っています。まずは支出差異と上位カテゴリだけ確認すると把握しやすいです。'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">支出の大きい項目</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">上位だけ見えるようにして、細かいカテゴリは後回しにしています。</p>
            </div>
            <Link
              href="/finance/analysis"
              className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              月次実績を見る
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {topCategories.length > 0 ? (
              topCategories.map((row) => (
                <div key={row.name} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{row.name}</span>
                    <span className="shrink-0 font-medium">{formatYen(row.total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-slate-700" style={{ width: `${Math.min(100, row.ratio)}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">今月の支出はまだありません。</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/finance/expenses" className="rounded-xl border bg-background p-4 transition-colors hover:bg-muted/40">
          <div className="flex items-center gap-3">
            <ReceiptText className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium">実績入力</p>
              <p className="text-xs text-muted-foreground">月末に収入と支出をまとめて入れる</p>
            </div>
          </div>
        </Link>
        <Link href="/finance/budgets" className="rounded-xl border bg-background p-4 transition-colors hover:bg-muted/40">
          <div className="flex items-center gap-3">
            <Target className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium">予算を調整</p>
              <p className="text-xs text-muted-foreground">毎月見る数字を少なくするための基準を整える</p>
            </div>
          </div>
        </Link>
        <Link href="/finance/life-plan" className="rounded-xl border bg-background p-4 transition-colors hover:bg-muted/40">
          <div className="flex items-center gap-3">
            <Landmark className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium">長期計画</p>
              <p className="text-xs text-muted-foreground">日々の画面とは切り離して5年計画を見る</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
