'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Pencil, Save, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  getBudgetLimitTotal,
  getLifePlanCategoryBreakdownMap,
  getLifePlanCategoryBudgetMap,
  getLifePlanMonthlyBudget,
} from '@/lib/budget-utils'
import { INCOME_TYPE_LABELS, LIVING_MODE_LABELS } from '@/lib/finance/constants'
import { formatYen } from '@/lib/finance/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import {
  useBudget,
  useBudgetCategories,
  useBudgetIncomeCategories,
  useBudgetMemberLimits,
  useCreateBudget,
  useUpsertBudgetCategory,
  useUpsertBudgetIncomeCategory,
  useUpsertBudgetMemberLimit,
} from '@/lib/hooks/use-budgets'
import { useExpenseCategories } from '@/lib/hooks/use-categories'
import { useIncomes } from '@/lib/hooks/use-incomes'
import { useLifePlanConfig } from '@/lib/hooks/use-life-plan'
import { useExpenses, useMonthlyExpenseSummary } from '@/lib/hooks/use-expenses'
import { useFinanceStore } from '@/stores/finance-store'
import { toast } from 'sonner'

const INCOME_BUDGET_TYPES = ['salary', 'bonus', 'freelance', 'other'] as const
type LivingCostView = 'combined' | 'mine' | 'partner' | 'shared' | 'mine_personal' | 'partner_personal'

export default function BudgetsPage() {
  const { user, couple, partner } = useAuth()
  const { selectedMonth, setSelectedMonth, livingMode } = useFinanceStore()
  const lifePlanConfig = useLifePlanConfig(couple?.id)
  const { data: budget, refetch: refetchBudget } = useBudget(couple?.id, selectedMonth)
  const { data: budgetCategories } = useBudgetCategories(budget?.id)
  const { data: budgetIncomeCategories } = useBudgetIncomeCategories(budget?.id)
  const { data: budgetMemberLimits } = useBudgetMemberLimits(budget?.id)
  const { data: summary } = useMonthlyExpenseSummary(couple?.id, selectedMonth)
  const { data: expenses } = useExpenses(couple?.id, selectedMonth)
  const { data: allCategories } = useExpenseCategories(couple?.id)
  const { data: incomes } = useIncomes(couple?.id, selectedMonth)
  const createBudget = useCreateBudget()
  const upsertBudgetCategory = useUpsertBudgetCategory()
  const upsertBudgetIncomeCategory = useUpsertBudgetIncomeCategory()
  const upsertBudgetMemberLimit = useUpsertBudgetMemberLimit()

  const [editing, setEditing] = useState(false)
  const [editAmounts, setEditAmounts] = useState<Record<string, string>>({})
  const [editMemberAmounts, setEditMemberAmounts] = useState<Record<string, string>>({})
  const [editIncomeAmounts, setEditIncomeAmounts] = useState<Record<string, string>>({})
  const [livingCostView, setLivingCostView] = useState<LivingCostView>('combined')

  const members = useMemo(() => {
    const rows: Array<{ id: string; label: string }> = []
    if (user) rows.push({ id: user.id, label: user.display_name || '自分' })
    if (partner) rows.push({ id: partner.id, label: partner.display_name || 'パートナー' })
    return rows
  }, [partner, user])

  const lifePlanBudget = useMemo(() => getLifePlanMonthlyBudget(lifePlanConfig, selectedMonth), [lifePlanConfig, selectedMonth])
  const lifePlanCategoryBudgetMap = useMemo(
    () => getLifePlanCategoryBudgetMap(lifePlanConfig, selectedMonth),
    [lifePlanConfig, selectedMonth]
  )
  const lifePlanCategoryBreakdownMap = useMemo(
    () => getLifePlanCategoryBreakdownMap(lifePlanConfig, selectedMonth),
    [lifePlanConfig, selectedMonth]
  )
  const lifePlanIncomeReference = useMemo(() => {
    const year = Number(selectedMonth.slice(0, 4))
    const entry = lifePlanConfig.incomeData.find((row) => row.year === year)
    if (!entry) return 0
    return Math.round((entry.ren.net + entry.hikaru.net) / 12)
  }, [lifePlanConfig.incomeData, selectedMonth])
  const lifePlanIncomeByMember = useMemo(() => {
    const year = Number(selectedMonth.slice(0, 4))
    const entry = lifePlanConfig.incomeData.find((row) => row.year === year)
    if (!entry) return { mine: 0, partner: 0 }
    return {
      mine: Math.round(entry.ren.net / 12),
      partner: Math.round(entry.hikaru.net / 12),
    }
  }, [lifePlanConfig.incomeData, selectedMonth])

  useEffect(() => {
    if (budgetCategories?.length) {
      setEditAmounts(
        Object.fromEntries(budgetCategories.map((row) => [row.category_id, String(Number(row.limit_amount) || 0)]))
      )
      return
    }

    if (!allCategories?.length) {
      setEditAmounts({})
      return
    }

    const seededRows = allCategories
      .filter((category) => lifePlanCategoryBudgetMap[category.name] !== undefined)
      .map((category) => [category.id, String(lifePlanCategoryBudgetMap[category.name] || 0)])

    setEditAmounts(Object.fromEntries(seededRows))
  }, [allCategories, budgetCategories, lifePlanCategoryBudgetMap])

  useEffect(() => {
    if (budgetMemberLimits?.length) {
      setEditMemberAmounts(
        Object.fromEntries(budgetMemberLimits.map((row) => [row.user_id, String(Number(row.limit_amount) || 0)]))
      )
      return
    }

    const defaults: Record<string, string> = {}
    if (user) defaults[user.id] = String(lifePlanBudget.ren)
    if (partner) defaults[partner.id] = String(lifePlanBudget.hikaru)
    setEditMemberAmounts(defaults)
  }, [budgetMemberLimits, lifePlanBudget.hikaru, lifePlanBudget.ren, partner, user])

  useEffect(() => {
    if (budgetIncomeCategories?.length) {
      setEditIncomeAmounts(
        Object.fromEntries(budgetIncomeCategories.map((row) => [row.income_type, String(Number(row.planned_amount) || 0)]))
      )
      return
    }

    setEditIncomeAmounts(
      Object.fromEntries(INCOME_BUDGET_TYPES.map((type) => [type, '0']))
    )
  }, [budgetIncomeCategories])

  const handleSaveAll = useCallback(async () => {
    if (!couple?.id) return toast.error('ペア情報を確認してください')

    try {
      const totalLimit = members.length
        ? members.reduce((sum, member) => sum + (Number(editMemberAmounts[member.id]) || 0), 0)
        : Object.values(editAmounts).reduce((sum, value) => sum + (Number(value) || 0), 0)

      const activeBudget = budget ?? await createBudget.mutateAsync({
        couple_id: couple.id,
        year_month: selectedMonth,
        total_limit: totalLimit,
      })

      for (const [categoryId, amount] of Object.entries(editAmounts)) {
        await upsertBudgetCategory.mutateAsync({
          budget_id: activeBudget.id,
          category_id: categoryId,
          limit_amount: Number(amount) || 0,
          alert_ratio: 0.8,
        })
      }

      for (const member of members) {
        await upsertBudgetMemberLimit.mutateAsync({
          budget_id: activeBudget.id,
          user_id: member.id,
          limit_amount: Number(editMemberAmounts[member.id]) || 0,
        })
      }

      for (const incomeType of INCOME_BUDGET_TYPES) {
        await upsertBudgetIncomeCategory.mutateAsync({
          budget_id: activeBudget.id,
          income_type: incomeType,
          scenario: 'base',
          planned_amount: Number(editIncomeAmounts[incomeType]) || 0,
        })
      }

      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { error } = await supabase
        .from('budgets')
        .update({ total_limit: totalLimit })
        .eq('id', activeBudget.id)
      if (error) throw error

      await refetchBudget()
      setEditing(false)
      toast.success('予算を保存しました')
    } catch {
      toast.error('予算の保存に失敗しました')
    }
  }, [
    budget,
    couple?.id,
    createBudget,
    editAmounts,
    editIncomeAmounts,
    editMemberAmounts,
    members,
    refetchBudget,
    selectedMonth,
    upsertBudgetCategory,
    upsertBudgetIncomeCategory,
    upsertBudgetMemberLimit,
  ])

  const spent = summary?.total || 0
  const limit = getBudgetLimitTotal(budget, budgetMemberLimits) || lifePlanBudget.total
  const remaining = limit - spent
  const percentage = limit > 0 ? (spent / limit) * 100 : 0
  const [year, month] = selectedMonth.split('-').map(Number)
  const displayDate = new Date(year, month - 1, 1)

  const navigateMonth = (direction: number) => {
    const nextDate = new Date(year, month - 1 + direction, 1)
    setSelectedMonth(format(nextDate, 'yyyy-MM'))
  }

  const actualIncomeByType = useMemo(() => {
    const map: Record<string, number> = {}
    for (const income of incomes || []) {
      map[income.income_type] = (map[income.income_type] || 0) + Number(income.amount)
    }
    return map
  }, [incomes])
  const actualIncomeByMember = useMemo(() => {
    const mine = (incomes || [])
      .filter((income) => income.user_id === user?.id)
      .reduce((sum, income) => sum + Number(income.amount), 0)
    const partnerTotal = (incomes || [])
      .filter((income) => income.user_id === partner?.id)
      .reduce((sum, income) => sum + Number(income.amount), 0)
    return { mine, partner: partnerTotal }
  }, [incomes, partner?.id, user?.id])
  const actualExpenseByMember = useMemo(() => {
    const mine = (expenses || [])
      .filter((expense) => expense.paid_by === user?.id)
      .reduce((sum, expense) => sum + Number(expense.amount), 0)
    const partnerTotal = (expenses || [])
      .filter((expense) => expense.paid_by === partner?.id)
      .reduce((sum, expense) => sum + Number(expense.amount), 0)
    return { mine, partner: partnerTotal }
  }, [expenses, partner?.id, user?.id])

  const livingCostViewOptions = useMemo(
    () =>
      livingMode === 'before_cohabiting'
        ? [
            { value: 'combined' as const, label: '2人合算' },
            { value: 'mine' as const, label: user?.display_name || '自分' },
            { value: 'partner' as const, label: partner?.display_name || '相手' },
          ]
        : [
            { value: 'combined' as const, label: '世帯合算' },
            { value: 'shared' as const, label: '共通費' },
            { value: 'mine_personal' as const, label: `${user?.display_name || '自分'} 個人` },
            { value: 'partner_personal' as const, label: `${partner?.display_name || '相手'} 個人` },
          ],
    [livingMode, partner?.display_name, user?.display_name]
  )

  useEffect(() => {
    if (!livingCostViewOptions.some((option) => option.value === livingCostView)) {
      setLivingCostView('combined')
    }
  }, [livingCostView, livingCostViewOptions])

  useEffect(() => {
    if (editing && livingCostView !== 'combined') {
      setLivingCostView('combined')
    }
  }, [editing, livingCostView])

  const allRows = useMemo(() => {
    const categoryIds = new Set<string>([
      ...(budgetCategories || []).map((row) => row.category_id),
      ...Object.keys(editAmounts),
    ])

    return Array.from(categoryIds).map((id) => {
      const budgetCategory = budgetCategories?.find((row) => row.category_id === id)
      const category = allCategories?.find((row) => row.id === id)
      const budgetAmount = editing
        ? (Number(editAmounts[id]) || 0)
        : (Number(budgetCategory?.limit_amount) || Number(editAmounts[id]) || 0)
      const actualAmount = summary?.byCategory?.[id]?.total || 0
      const breakdown = lifePlanCategoryBreakdownMap[budgetCategory?.expense_categories?.name || category?.name || ''] ?? {
        combined: 0,
        mine: 0,
        partner: 0,
        shared: 0,
        minePersonal: 0,
        partnerPersonal: 0,
      }

      const scopedBudgetAmount = (() => {
        if (livingCostView === 'combined') return budgetAmount
        const sourceAmount =
          livingCostView === 'mine'
            ? breakdown.mine
            : livingCostView === 'partner'
              ? breakdown.partner
              : livingCostView === 'shared'
                ? breakdown.shared
                : livingCostView === 'mine_personal'
                  ? breakdown.minePersonal
                  : breakdown.partnerPersonal
        return breakdown.combined > 0 ? Math.round((budgetAmount * sourceAmount) / breakdown.combined) : 0
      })()

      const scopedActualAmount = (() => {
        if (livingCostView === 'combined') return actualAmount
        if (livingCostView === 'mine') {
          return (expenses || [])
            .filter((expense) => expense.category_id === id && expense.paid_by === user?.id)
            .reduce((sum, expense) => sum + Number(expense.amount), 0)
        }
        if (livingCostView === 'partner') {
          return (expenses || [])
            .filter((expense) => expense.category_id === id && expense.paid_by === partner?.id)
            .reduce((sum, expense) => sum + Number(expense.amount), 0)
        }
        if (livingCostView === 'shared') {
          return (expenses || [])
            .filter((expense) => expense.category_id === id && expense.expense_type === 'shared')
            .reduce((sum, expense) => sum + Number(expense.amount), 0)
        }
        if (livingCostView === 'mine_personal') {
          return (expenses || [])
            .filter((expense) => expense.category_id === id && expense.paid_by === user?.id && expense.expense_type === 'personal')
            .reduce((sum, expense) => sum + Number(expense.amount), 0)
        }
        return (expenses || [])
          .filter((expense) => expense.category_id === id && expense.paid_by === partner?.id && expense.expense_type === 'personal')
          .reduce((sum, expense) => sum + Number(expense.amount), 0)
      })()

      return {
        categoryId: id,
        icon: budgetCategory?.expense_categories?.icon || category?.icon || '•',
        name: budgetCategory?.expense_categories?.name || category?.name || '未分類',
        budgetAmount: scopedBudgetAmount,
        actualAmount: scopedActualAmount,
        diff: scopedBudgetAmount - scopedActualAmount,
        pct: scopedBudgetAmount > 0 ? (scopedActualAmount / scopedBudgetAmount) * 100 : 0,
      }
    }).sort((a, b) => b.budgetAmount - a.budgetAmount)
  }, [
    allCategories,
    budgetCategories,
    editAmounts,
    editing,
    expenses,
    lifePlanCategoryBreakdownMap,
    livingCostView,
    partner?.id,
    summary?.byCategory,
    user?.id,
  ])

  const addableCategories = (allCategories || []).filter((category) => !allRows.some((row) => row.categoryId === category.id))
  const incomeBudgetRows = INCOME_BUDGET_TYPES.map((incomeType) => {
    const plannedAmount = Number(editIncomeAmounts[incomeType]) || 0
    const actualAmount = actualIncomeByType[incomeType] || 0
    return {
      incomeType,
      label: INCOME_TYPE_LABELS[incomeType],
      plannedAmount,
      actualAmount,
      diff: actualAmount - plannedAmount,
    }
  })
  const incomePlannedTotal = incomeBudgetRows.reduce((sum, row) => sum + row.plannedAmount, 0)
  const incomeActualTotal = incomeBudgetRows.reduce((sum, row) => sum + row.actualAmount, 0)
  const livingCostBudgetTotal = limit
  const livingCostActualTotal = spent
  const lifePlanCategoryBreakdownTotals = Object.values(lifePlanCategoryBreakdownMap).reduce(
    (acc, row) => ({
      shared: acc.shared + row.shared,
      minePersonal: acc.minePersonal + row.minePersonal,
      partnerPersonal: acc.partnerPersonal + row.partnerPersonal,
    }),
    { shared: 0, minePersonal: 0, partnerPersonal: 0 }
  )
  const afterSharedBudget = lifePlanCategoryBreakdownTotals.shared
  const afterMinePersonalBudget = lifePlanCategoryBreakdownTotals.minePersonal
  const afterPartnerPersonalBudget = lifePlanCategoryBreakdownTotals.partnerPersonal
  const afterSharedActual = (expenses || [])
    .filter((expense) => expense.expense_type === 'shared')
    .reduce((sum, expense) => sum + Number(expense.amount), 0)
  const afterMinePersonalActual = (expenses || [])
    .filter((expense) => expense.paid_by === user?.id && expense.expense_type === 'personal')
    .reduce((sum, expense) => sum + Number(expense.amount), 0)
  const afterPartnerPersonalActual = (expenses || [])
    .filter((expense) => expense.paid_by === partner?.id && expense.expense_type === 'personal')
    .reduce((sum, expense) => sum + Number(expense.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{format(displayDate, 'yyyy年M月', { locale: ja })}の予算</h2>
          <p className="text-sm text-muted-foreground">
            暦年ベースで管理中 / 現在モード: {LIVING_MODE_LABELS[livingMode]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[110px] text-center text-sm font-medium">
            {format(displayDate, 'yyyy年M月', { locale: ja })}
          </span>
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="mr-1 h-4 w-4" />
              編集
            </Button>
          ) : (
            <Button size="sm" onClick={handleSaveAll} disabled={createBudget.isPending || upsertBudgetCategory.isPending || upsertBudgetIncomeCategory.isPending || upsertBudgetMemberLimit.isPending}>
              <Save className="mr-1 h-4 w-4" />
              保存
            </Button>
          )}
        </div>
      </div>

      <Card tone="sky" className="border-primary/20 bg-[linear-gradient(135deg,rgba(29,106,87,0.08),rgba(63,124,246,0.08))]">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                ライフプランをもとに月予算を管理
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                生活費の前提、二人の配分、同棲モードをこの画面でまとめて確認します。長期シミュレーションの編集だけ別画面に残します。
              </p>
            </div>
            <Link
              href="/finance/life-plan"
              className="inline-flex h-9 items-center rounded-md border border-primary/30 bg-white/80 px-3 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-white"
            >
              ライフプラン詳細
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border bg-background/85 p-4">
            <p className="text-xs text-muted-foreground">ライフプラン基準額</p>
            <p className="mt-1 text-xl font-semibold text-primary">{formatYen(lifePlanBudget.total)}</p>
            <p className="mt-1 text-xs text-muted-foreground">長期前提から自動算出した今月の目安です。</p>
          </div>
          <div className="rounded-lg border bg-background/85 p-4">
            <p className="text-xs text-muted-foreground">5年計画の月次収入目安</p>
            <p className="mt-1 text-xl font-semibold text-[#22C55E]">{formatYen(lifePlanIncomeReference)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              選択年の年手取りを 12 で割った参考値です。
            </p>
          </div>
          <div className="rounded-lg border bg-background/85 p-4">
            <p className="text-xs text-muted-foreground">生活モード</p>
            <p className="mt-1 text-xl font-semibold">{LIVING_MODE_LABELS[livingMode]}</p>
            <p className="mt-1 text-xs text-muted-foreground">同棲前/同棲後の前提を予算と同じ文脈で見直せます。</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card tone="mint">
          <CardHeader>
            <CardTitle className="text-base">収入予算と実績</CardTitle>
          </CardHeader>
          <CardContent className={`grid gap-3 ${livingMode === 'before_cohabiting' ? 'md:grid-cols-3' : 'md:grid-cols-3'}`}>
            {livingMode === 'before_cohabiting' && (
              <>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">{user?.display_name || '自分'}</p>
                  <p className="mt-1 text-lg font-semibold text-[#22C55E]">{formatYen(lifePlanIncomeByMember.mine)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">実績 {formatYen(actualIncomeByMember.mine)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">{partner?.display_name || '相手'}</p>
                  <p className="mt-1 text-lg font-semibold text-[#22C55E]">{formatYen(lifePlanIncomeByMember.partner)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">実績 {formatYen(actualIncomeByMember.partner)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">合算</p>
                  <p className="mt-1 text-lg font-semibold text-[#22C55E]">{formatYen(lifePlanIncomeReference)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">実績 {formatYen(incomeActualTotal)}</p>
                </div>
              </>
            )}
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">5年計画の月次収入目安</p>
              <p className="mt-1 text-lg font-semibold text-[#22C55E]">{formatYen(lifePlanIncomeReference)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">収入予算</p>
              <p className="mt-1 text-lg font-semibold">{formatYen(incomePlannedTotal)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground">収入実績</p>
              <p className="mt-1 text-lg font-semibold text-[#22C55E]">{formatYen(incomeActualTotal)}</p>
            </div>
          </CardContent>
        </Card>

        <Card tone="amber">
          <CardHeader>
            <CardTitle className="text-base">生活費予算と実績</CardTitle>
          </CardHeader>
          <CardContent className={`grid gap-3 ${livingMode === 'before_cohabiting' ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
            {livingMode === 'before_cohabiting' && (
              <>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">{user?.display_name || '自分'}</p>
                  <p className="mt-1 text-lg font-semibold">{formatYen(lifePlanBudget.ren)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">実績 {formatYen(actualExpenseByMember.mine)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">{partner?.display_name || '相手'}</p>
                  <p className="mt-1 text-lg font-semibold">{formatYen(lifePlanBudget.hikaru)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">実績 {formatYen(actualExpenseByMember.partner)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">合算</p>
                  <p className="mt-1 text-lg font-semibold">{formatYen(lifePlanBudget.total)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">実績 {formatYen(livingCostActualTotal)}</p>
                </div>
              </>
            )}
            {livingMode === 'after_cohabiting' && (
              <>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">共通費</p>
                  <p className="mt-1 text-lg font-semibold">{formatYen(afterSharedBudget)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">実績 {formatYen(afterSharedActual)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">{user?.display_name || '自分'} 個人</p>
                  <p className="mt-1 text-lg font-semibold">{formatYen(afterMinePersonalBudget)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">実績 {formatYen(afterMinePersonalActual)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">{partner?.display_name || '相手'} 個人</p>
                  <p className="mt-1 text-lg font-semibold">{formatYen(afterPartnerPersonalBudget)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">実績 {formatYen(afterPartnerPersonalActual)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">世帯合算</p>
                  <p className="mt-1 text-lg font-semibold">{formatYen(lifePlanBudget.total)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">実績 {formatYen((expenses || []).reduce((sum, expense) => sum + Number(expense.amount), 0))}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card tone="violet">
        <CardHeader>
          <CardTitle className="text-base">月次予算サマリー</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">ライフプラン基準</span>
              <span className="font-medium">{formatYen(lifePlanBudget.total)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground">同棲モード</span>
              <span>{LIVING_MODE_LABELS[livingMode]}</span>
            </div>
          </div>

          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-3">
                <Label>{member.label}</Label>
                {editing ? (
                  <Input
                    type="number"
                    className="w-40 text-right"
                    value={editMemberAmounts[member.id] || '0'}
                    onChange={(e) => setEditMemberAmounts((prev) => ({ ...prev, [member.id]: e.target.value }))}
                  />
                ) : (
                  <span className="font-medium">{formatYen(Number(editMemberAmounts[member.id]) || 0)}</span>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>支出</span>
              <span>{formatYen(spent)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>予算</span>
              <span>{formatYen(editing ? members.reduce((sum, member) => sum + (Number(editMemberAmounts[member.id]) || 0), 0) : limit)}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${percentage > 100 ? 'bg-destructive' : percentage > 80 ? 'bg-[var(--color-expense)]' : 'bg-primary'}`}
                style={{ width: `${Math.min(100, percentage)}%` }}
              />
            </div>
            <div className={`text-center text-2xl font-bold ${remaining < 0 ? 'text-destructive' : 'text-primary'}`}>
              {formatYen(editing ? members.reduce((sum, member) => sum + (Number(editMemberAmounts[member.id]) || 0), 0) - spent : remaining)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card tone="sky">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">生活費予算</CardTitle>
            <Tabs value={livingCostView} onValueChange={(value) => setLivingCostView(value as LivingCostView)}>
              <TabsList className="h-auto flex-wrap">
                {livingCostViewOptions.map((option) => (
                  <TabsTrigger key={option.value} value={option.value} disabled={editing && option.value !== 'combined'}>
                    {option.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b pb-2 text-xs text-muted-foreground">
            <span>生活費項目（MFカテゴリ）</span>
            <span className="w-24 text-right">予算</span>
            <span className="w-24 text-right">実績</span>
            <span className="w-24 text-right">差額</span>
          </div>

          {allRows.map((row) => (
            <div key={row.categoryId} className="space-y-2">
              <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 text-sm">
                <span className="truncate">{row.icon} {row.name}</span>
                {editing ? (
                  <Input
                    type="number"
                    className="w-24 text-right"
                    value={editAmounts[row.categoryId] || '0'}
                    onChange={(e) => setEditAmounts((prev) => ({ ...prev, [row.categoryId]: e.target.value }))}
                  />
                ) : (
                  <span className="w-24 text-right">{formatYen(row.budgetAmount)}</span>
                )}
                <span className="w-24 text-right">{formatYen(row.actualAmount)}</span>
                <span className={`w-24 text-right font-medium ${row.diff < 0 ? 'text-destructive' : 'text-primary'}`}>
                  {formatYen(row.diff)}
                </span>
              </div>
              {!editing && (
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${row.pct > 100 ? 'bg-destructive' : row.pct > 80 ? 'bg-[var(--color-expense)]' : 'bg-primary'}`}
                    style={{ width: `${Math.min(100, row.pct)}%` }}
                  />
                </div>
              )}
            </div>
          ))}

          {editing && addableCategories.length > 0 && (
            <div className="border-t pt-4">
              <p className="mb-2 text-xs text-muted-foreground">カテゴリを追加</p>
              <div className="flex flex-wrap gap-2">
                {addableCategories.map((category) => (
                  <Button
                    key={category.id}
                    size="sm"
                    variant="outline"
                    onClick={() => setEditAmounts((prev) => ({ ...prev, [category.id]: '0' }))}
                  >
                    {category.icon} {category.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card tone="mint">
        <CardHeader>
          <CardTitle className="text-base">収入予算</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b pb-2 text-xs text-muted-foreground">
            <span>項目</span>
            <span className="w-24 text-right">予算</span>
            <span className="w-24 text-right">実績</span>
            <span className="w-24 text-right">差異</span>
          </div>
          {incomeBudgetRows.map((row) => (
            <div key={row.incomeType} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 text-sm">
              <span>{row.label}</span>
              {editing ? (
                <Input
                  type="number"
                  className="w-24 text-right"
                  value={editIncomeAmounts[row.incomeType] || '0'}
                  onChange={(e) => setEditIncomeAmounts((prev) => ({ ...prev, [row.incomeType]: e.target.value }))}
                />
              ) : (
                <span className="w-24 text-right">{formatYen(row.plannedAmount)}</span>
              )}
              <span className="w-24 text-right">{formatYen(row.actualAmount)}</span>
              <span className={`w-24 text-right font-medium ${row.diff < 0 ? 'text-destructive' : 'text-primary'}`}>
                {formatYen(row.diff)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {!editing && (
        <Card tone="violet">
          <CardHeader>
            <CardTitle className="text-base">予算ステータス</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {allRows.filter((row) => row.pct > 80).length > 0 ? (
              allRows
                .filter((row) => row.pct > 80)
                .sort((a, b) => b.pct - a.pct)
                .map((row) => (
                  <div
                    key={row.categoryId}
                    className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
                      row.pct > 100 ? 'bg-destructive/10 text-destructive' : 'bg-[var(--color-expense-soft)] text-[var(--color-expense)]'
                    }`}
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{row.icon} {row.name}: {row.pct.toFixed(0)}%</span>
                  </div>
                ))
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-3 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>現在は予算内です</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  )
}
