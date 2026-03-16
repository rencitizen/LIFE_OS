'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Landmark, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { LIVING_MODE_LABELS, LIVING_MODES } from '@/lib/finance/constants'
import { formatYen } from '@/lib/finance/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useAccountBalanceSummary } from '@/lib/hooks/use-accounts'
import { useBudget, useBudgetIncomeCategories, useBudgetMemberLimits } from '@/lib/hooks/use-budgets'
import { useMonthlyExpenseSummary, useYearExpenseHistory } from '@/lib/hooks/use-expenses'
import { useIncomes, useYearIncomeHistory } from '@/lib/hooks/use-incomes'
import { useLifePlanConfig, useSaveLifePlan, useSimulation } from '@/lib/hooks/use-life-plan'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/stores/finance-store'
import { toast } from 'sonner'
import type { LivingMode } from '@/types'

function compareTone(value: number) {
  if (value > 0) return 'text-destructive'
  if (value < 0) return 'text-primary'
  return 'text-foreground'
}

export default function FinanceDashboardPage() {
  const { user, partner, couple } = useAuth()
  const supabase = createClient()
  const lifePlanConfig = useLifePlanConfig(couple?.id)
  const saveLifePlan = useSaveLifePlan()
  const simulation = useSimulation(lifePlanConfig)
  const { selectedMonth, setSelectedMonth, livingMode, setLivingMode } = useFinanceStore()
  const { data: monthExpenses } = useMonthlyExpenseSummary(couple?.id, selectedMonth)
  const { data: monthIncomes } = useIncomes(couple?.id, selectedMonth)
  const { data: budget } = useBudget(couple?.id, selectedMonth)
  const { data: budgetIncomeCategories } = useBudgetIncomeCategories(budget?.id)
  const { data: budgetMemberLimits } = useBudgetMemberLimits(budget?.id)
  const { data: accountSummary } = useAccountBalanceSummary(couple?.id)

  const selectedYear = Number(selectedMonth.slice(0, 4))
  const { data: yearExpenses } = useYearExpenseHistory(couple?.id, selectedYear)
  const { data: yearIncomes } = useYearIncomeHistory(couple?.id, selectedYear)

  const [savingMode, setSavingMode] = useState(false)
  const [openingCash, setOpeningCash] = useState({ mine: '', partner: '' })
  const [year, month] = selectedMonth.split('-').map(Number)
  const displayDate = new Date(year, month - 1, 1)

  useEffect(() => {
    setOpeningCash({
      mine: String(lifePlanConfig.initialAssets.ren.cash || 0),
      partner: String(lifePlanConfig.initialAssets.hikaru.cash || 0),
    })
  }, [lifePlanConfig.initialAssets.hikaru.cash, lifePlanConfig.initialAssets.ren.cash])

  const actualMonthIncome = useMemo(
    () => (monthIncomes || []).reduce((sum, row) => sum + Number(row.amount), 0),
    [monthIncomes]
  )
  const actualMonthExpense = monthExpenses?.total || 0
  const actualMonthBalance = actualMonthIncome - actualMonthExpense

  const plannedMonthIncome = useMemo(
    () => (budgetIncomeCategories || []).reduce((sum, row) => sum + Number(row.planned_amount), 0),
    [budgetIncomeCategories]
  )
  const plannedMonthExpense = useMemo(
    () => (budgetMemberLimits || []).reduce((sum, row) => sum + Number(row.limit_amount), 0) || Number(budget?.total_limit || 0),
    [budget?.total_limit, budgetMemberLimits]
  )
  const plannedMonthBalance = plannedMonthIncome - plannedMonthExpense

  const actualYearIncome = useMemo(
    () => (yearIncomes || []).reduce((sum, row) => sum + Number(row.amount), 0),
    [yearIncomes]
  )
  const actualYearExpense = useMemo(
    () => (yearExpenses || []).reduce((sum, row) => sum + Number(row.amount), 0),
    [yearExpenses]
  )

  const yearPlan = useMemo(() => {
    const index = simulation.household.findIndex((row) => row.year === selectedYear)
    if (index < 0) return null
    return {
      income: simulation.household[index].householdNet,
      expense: simulation.ren[index].livingCost + simulation.hikaru[index].livingCost,
      asset: simulation.household[index].householdTotalAssets,
    }
  }, [selectedYear, simulation.household, simulation.hikaru, simulation.ren])

  const fiveYearRows = useMemo(() => {
    const startIndex = simulation.household.findIndex((row) => row.year === selectedYear)
    const index = startIndex >= 0 ? startIndex : 0
    return simulation.household.slice(index, index + 5).map((row, offset) => ({
      year: row.year,
      income: row.householdNet,
      expense: simulation.ren[index + offset].livingCost + simulation.hikaru[index + offset].livingCost,
      balance: row.householdNet - (simulation.ren[index + offset].livingCost + simulation.hikaru[index + offset].livingCost),
      asset: row.householdTotalAssets,
    }))
  }, [selectedYear, simulation.household, simulation.hikaru, simulation.ren])

  const accountNetWorth = accountSummary?.netWorth ?? 0
  const accountAssets = accountSummary?.assets ?? 0
  const accountLiabilities = accountSummary?.liabilities ?? 0
  const planAssetGap = yearPlan ? accountNetWorth - yearPlan.asset : 0
  const openingCashTotal = Number(openingCash.mine || 0) + Number(openingCash.partner || 0)

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
      toast.error('生活モードの更新に失敗しました')
    } finally {
      setSavingMode(false)
    }
  }

  const handleSaveOpeningCash = async () => {
    if (!couple?.id) return

    try {
      await saveLifePlan.mutateAsync({
        coupleId: couple.id,
        config: {
          ...lifePlanConfig,
          initialAssets: {
            ...lifePlanConfig.initialAssets,
            ren: {
              ...lifePlanConfig.initialAssets.ren,
              cash: Number(openingCash.mine || 0),
            },
            hikaru: {
              ...lifePlanConfig.initialAssets.hikaru,
              cash: Number(openingCash.partner || 0),
            },
          },
        },
      })
      toast.success('期首預金残高を更新しました')
    } catch {
      toast.error('期首預金残高の更新に失敗しました')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {LIVING_MODE_LABELS[livingMode]}
            </span>
            <span className="text-sm text-muted-foreground">家計の概要</span>
          </div>
          <h1 className="text-2xl font-bold">{format(displayDate, 'yyyy年M月', { locale: ja })}の概要</h1>
          <p className="text-sm text-muted-foreground">
            月次実績は PL、5年計画は CF、資産は実績残高ベースで表示します。
          </p>
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">今月の実績収支</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-1">
            <p className={`text-2xl font-bold ${actualMonthBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatYen(actualMonthBalance)}
            </p>
            <p className="text-xs text-muted-foreground">
              収入 {formatYen(actualMonthIncome)} / 支出 {formatYen(actualMonthExpense)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">今月の計画差異</CardTitle>
            <TrendingDown className="h-4 w-4 text-[var(--color-expense)]" />
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">収入差異</span>
              <span className={compareTone(plannedMonthIncome - actualMonthIncome)}>
                {formatYen(actualMonthIncome - plannedMonthIncome)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">支出差異</span>
              <span className={compareTone(actualMonthExpense - plannedMonthExpense)}>
                {formatYen(actualMonthExpense - plannedMonthExpense)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t pt-2 font-medium">
              <span>収支差異</span>
              <span className={actualMonthBalance - plannedMonthBalance >= 0 ? 'text-primary' : 'text-destructive'}>
                {formatYen(actualMonthBalance - plannedMonthBalance)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{selectedYear}年の進捗</CardTitle>
            <TrendingUp className="h-4 w-4 text-[var(--color-info)]" />
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">年収実績</span>
              <span>{formatYen(actualYearIncome)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">年支出実績</span>
              <span>{formatYen(actualYearExpense)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-2 font-medium">
              <span>年収支差異</span>
              <span className={yearPlan && actualYearIncome - actualYearExpense >= yearPlan.income - yearPlan.expense ? 'text-primary' : 'text-destructive'}>
                {formatYen((actualYearIncome - actualYearExpense) - ((yearPlan?.income || 0) - (yearPlan?.expense || 0)))}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">純資産</CardTitle>
            <Landmark className="h-4 w-4 text-[var(--color-info)]" />
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-bold text-primary">{formatYen(accountNetWorth)}</p>
            <p className="text-xs text-muted-foreground">
              資産 {formatYen(accountAssets)} / 負債 {formatYen(accountLiabilities)}
            </p>
            {yearPlan && (
              <p className={`text-xs ${planAssetGap >= 0 ? 'text-primary' : 'text-destructive'}`}>
                計画差異 {formatYen(planAssetGap)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">月次実績の見方</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">今月の PL と予算差異を先に確認します。</p>
            </div>
            <Link
              href="/finance/analysis"
              className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              月次実績へ
            </Link>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">計画収入</p>
              <p className="mt-1 text-lg font-semibold text-primary">{formatYen(plannedMonthIncome)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">計画支出</p>
              <p className="mt-1 text-lg font-semibold text-[var(--color-expense)]">{formatYen(plannedMonthExpense)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">計画収支</p>
              <p className={`mt-1 text-lg font-semibold ${plannedMonthBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {formatYen(plannedMonthBalance)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">期首預金残高</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">5年計画の起点になる現預金だけここで調整できます。</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">{user?.display_name || '自分'}</label>
                <Input
                  inputMode="numeric"
                  value={openingCash.mine}
                  onChange={(event) => setOpeningCash((current) => ({ ...current, mine: event.target.value.replace(/[^\d]/g, '') }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">{partner?.display_name || '相手'}</label>
                <Input
                  inputMode="numeric"
                  value={openingCash.partner}
                  onChange={(event) => setOpeningCash((current) => ({ ...current, partner: event.target.value.replace(/[^\d]/g, '') }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-muted-foreground">期首預金残高 合計</span>
              <span className="font-semibold">{formatYen(openingCashTotal)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-muted-foreground">実績の現預金</span>
              <span className="font-medium">{formatYen(accountSummary?.cashLike || 0)}</span>
            </div>
            <Button onClick={handleSaveOpeningCash} disabled={saveLifePlan.isPending || !couple?.id}>
              {saveLifePlan.isPending ? '保存中...' : '期首預金残高を保存'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">5年見通し</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">CF 計画書として、年ごとの収支と年末資産を見ます。</p>
          </div>
          <Link
            href="/finance/life-plan"
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            5年計画へ
          </Link>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-2 py-2">年</th>
                  <th className="px-2 py-2 text-right">計画収入</th>
                  <th className="px-2 py-2 text-right">計画支出</th>
                  <th className="px-2 py-2 text-right">計画収支</th>
                  <th className="px-2 py-2 text-right">年末資産</th>
                </tr>
              </thead>
              <tbody>
                {fiveYearRows.map((row) => (
                  <tr key={row.year} className="border-b last:border-b-0">
                    <td className="px-2 py-3 font-medium">{row.year}</td>
                    <td className="px-2 py-3 text-right">{formatYen(row.income)}</td>
                    <td className="px-2 py-3 text-right">{formatYen(row.expense)}</td>
                    <td className={`px-2 py-3 text-right font-medium ${row.balance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {formatYen(row.balance)}
                    </td>
                    <td className="px-2 py-3 text-right font-semibold">{formatYen(row.asset)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
