'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { addMonths, format } from 'date-fns'
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  FileUp,
  House,
  Landmark,
  ListChecks,
  ReceiptText,
  Scale,
  ShoppingBag,
  Sparkles,
  Sprout,
  TrendingUp,
  WalletCards,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FINANCE_SCOPE_LABELS, filterByFinanceScope } from '@/lib/finance/scope'
import { formatYen } from '@/lib/finance/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useBudget } from '@/lib/hooks/use-budgets'
import { useExpenseCategories } from '@/lib/hooks/use-categories'
import { useExpenses } from '@/lib/hooks/use-expenses'
import { useFinancePlanItems } from '@/lib/hooks/use-finance-plan'
import { useIncomes } from '@/lib/hooks/use-incomes'
import { useMonthlySettlementPreview } from '@/lib/hooks/use-settlements'
import { useFinanceStore } from '@/stores/finance-store'

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

function formatSignedYen(value: number) {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${formatYen(Math.abs(value))}`
}

function sumAmount<T extends { amount: number | string }>(rows: T[]) {
  return rows.reduce((sum, row) => sum + Number(row.amount), 0)
}

function deltaMeta(current: number, previous: number) {
  if (previous <= 0) {
    return {
      label: current === 0 ? '前月と同じ' : '前月データなし',
      positive: true,
      ratio: 0,
    }
  }

  const ratio = ((current - previous) / previous) * 100
  return {
    label: `前月比 ${ratio >= 0 ? '+' : ''}${ratio.toFixed(1)}%`,
    positive: ratio <= 0,
    ratio,
  }
}

function displayPerson(
  id: string | null,
  user?: { id: string; display_name: string } | null,
  partner?: { id: string; display_name: string } | null
) {
  if (!id) return '—'
  if (user?.id === id) return user.display_name
  if (partner?.id === id) return partner.display_name
  return 'メンバー'
}

type CategoryViewRow = {
  id: string | null
  name: string
  icon: string | null
  amount: number
  hasChildren: boolean
}

function KpiCard({
  label,
  value,
  meta,
  icon,
  tone,
}: {
  label: string
  value: string
  meta: string
  icon: React.ReactNode
  tone: 'blue' | 'red' | 'green' | 'purple'
}) {
  const styles = {
    blue: {
      icon: 'bg-sky-500/10 text-sky-600',
      meta: 'text-sky-600',
    },
    red: {
      icon: 'bg-rose-500/10 text-rose-600',
      meta: 'text-emerald-600',
    },
    green: {
      icon: 'bg-emerald-500/10 text-emerald-600',
      meta: 'text-emerald-600',
    },
    purple: {
      icon: 'bg-violet-500/10 text-violet-600',
      meta: 'text-violet-600',
    },
  }[tone]

  return (
    <div className="min-w-0 px-4 py-4">
      <div className="flex items-center gap-2.5">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${styles.icon}`}>
          {icon}
        </div>
        <p className="text-xs font-bold text-muted-foreground">{label}</p>
      </div>
      <p className="mt-3 truncate text-[22px] font-black tracking-tight tabular-nums">{value}</p>
      <p className={`mt-1 text-[11px] font-semibold ${styles.meta}`}>{meta}</p>
    </div>
  )
}

export default function FinanceDashboardPage() {
  const { couple, user, partner } = useAuth()
  const { selectedMonth, setSelectedMonth, financeScope } = useFinanceStore()
  const [year, month] = selectedMonth.split('-').map(Number)
  const displayDate = new Date(year, month - 1, 1)
  const previousMonth = format(addMonths(displayDate, -1), 'yyyy-MM')

  const { data: expenses } = useExpenses(couple?.id, selectedMonth)
  const { data: incomes } = useIncomes(couple?.id, selectedMonth)
  const { data: previousExpenses } = useExpenses(couple?.id, previousMonth)
  const { data: previousIncomes } = useIncomes(couple?.id, previousMonth)
  const { data: categories } = useExpenseCategories(couple?.id)
  const { data: budget } = useBudget(couple?.id, selectedMonth)
  const { data: settlement } = useMonthlySettlementPreview(user?.id, selectedMonth)
  const { data: financePlanItems } = useFinancePlanItems(couple?.id)

  const [categoryPath, setCategoryPath] = useState<string[]>([])

  const scopedExpenses = useMemo(
    () => filterByFinanceScope(expenses || [], financeScope, user?.id, partner?.id, (row) => row.paid_by),
    [expenses, financeScope, partner?.id, user?.id]
  )
  const scopedIncomes = useMemo(
    () => filterByFinanceScope(incomes || [], financeScope, user?.id, partner?.id, (row) => row.user_id),
    [financeScope, incomes, partner?.id, user?.id]
  )
  const scopedPreviousExpenses = useMemo(
    () => filterByFinanceScope(previousExpenses || [], financeScope, user?.id, partner?.id, (row) => row.paid_by),
    [financeScope, partner?.id, previousExpenses, user?.id]
  )
  const scopedPreviousIncomes = useMemo(
    () => filterByFinanceScope(previousIncomes || [], financeScope, user?.id, partner?.id, (row) => row.user_id),
    [financeScope, partner?.id, previousIncomes, user?.id]
  )

  const monthExpense = useMemo(() => sumAmount(scopedExpenses), [scopedExpenses])
  const monthIncome = useMemo(() => sumAmount(scopedIncomes), [scopedIncomes])
  const monthBalance = monthIncome - monthExpense
  const previousExpense = useMemo(() => sumAmount(scopedPreviousExpenses), [scopedPreviousExpenses])
  const previousIncome = useMemo(() => sumAmount(scopedPreviousIncomes), [scopedPreviousIncomes])

  const expenseDelta = deltaMeta(monthExpense, previousExpense)
  const incomeDelta = deltaMeta(monthIncome, previousIncome)
  const balanceDelta = deltaMeta(monthBalance, previousIncome - previousExpense)

  const sharedExpense = useMemo(
    () => scopedExpenses
      .filter((row) => row.expense_type === 'shared' || row.is_settlement_target)
      .reduce((sum, row) => sum + Number(row.amount), 0),
    [scopedExpenses]
  )

  const settlementRows = useMemo(
    () => scopedExpenses.filter((row) => row.is_settlement_target),
    [scopedExpenses]
  )
  const settlementTarget = useMemo(() => sumAmount(settlementRows), [settlementRows])

  const assetFormationItems = useMemo(
    () => (financePlanItems || []).filter(
      (item) => item.category === '資産形成'
        && item.status === 'active'
        && Number(item.target_amount || 0) > 0
    ),
    [financePlanItems]
  )
  const monthlyInvestmentTotal = useMemo(
    () => assetFormationItems.reduce((sum, item) => sum + Number(item.target_amount || 0), 0),
    [assetFormationItems]
  )

  const anomalies = useMemo(
    () => (expenses || []).filter(
      (row) => !row.category_id
        || (row.is_settlement_target && (!row.expense_splits || row.expense_splits.length === 0))
    ),
    [expenses]
  )

  const categoryById = useMemo(
    () => new Map((categories || []).map((category) => [category.id, category])),
    [categories]
  )
  const selectedCategoryId = categoryPath[categoryPath.length - 1] || null
  const selectedCategoryHasChildren = useMemo(
    () => Boolean(
      selectedCategoryId
      && (categories || []).some((category) => category.parent_category_id === selectedCategoryId)
    ),
    [categories, selectedCategoryId]
  )

  const categoryRows = useMemo<CategoryViewRow[]>(() => {
    const categoryList = categories || []
    const totals = new Map<string, CategoryViewRow>()

    const hasChildren = (categoryId: string) =>
      categoryList.some((category) => category.parent_category_id === categoryId)

    const rootCategoryId = (categoryId: string) => {
      let current = categoryById.get(categoryId)
      const seen = new Set<string>()
      while (current?.parent_category_id && !seen.has(current.id)) {
        seen.add(current.id)
        current = categoryById.get(current.parent_category_id)
      }
      return current?.id || categoryId
    }

    const directChildBelow = (categoryId: string, ancestorId: string) => {
      let current = categoryById.get(categoryId)
      const seen = new Set<string>()
      while (current && !seen.has(current.id)) {
        seen.add(current.id)
        if (current.parent_category_id === ancestorId) return current.id
        if (!current.parent_category_id) return null
        current = categoryById.get(current.parent_category_id)
      }
      return null
    }

    const isDescendantOrSelf = (categoryId: string, ancestorId: string) => {
      if (categoryId === ancestorId) return true
      let current = categoryById.get(categoryId)
      const seen = new Set<string>()
      while (current?.parent_category_id && !seen.has(current.id)) {
        seen.add(current.id)
        if (current.parent_category_id === ancestorId) return true
        current = categoryById.get(current.parent_category_id)
      }
      return false
    }

    for (const expense of scopedExpenses) {
      const categoryId = expense.category_id
      const amount = Number(expense.amount)

      if (!categoryId || !categoryById.has(categoryId)) {
        if (!selectedCategoryId) {
          const current = totals.get('uncategorized') || {
            id: null,
            name: '未分類',
            icon: null,
            amount: 0,
            hasChildren: false,
          }
          current.amount += amount
          totals.set('uncategorized', current)
        }
        continue
      }

      let bucketId: string | null = null
      let bucketName = ''
      let bucketIcon: string | null = null
      let bucketHasChildren = false

      if (!selectedCategoryId) {
        bucketId = rootCategoryId(categoryId)
        const category = categoryById.get(bucketId)
        bucketName = category?.name || expense.expense_categories?.name || 'その他'
        bucketIcon = category?.icon || null
        bucketHasChildren = hasChildren(bucketId)
      } else {
        if (!isDescendantOrSelf(categoryId, selectedCategoryId)) continue
        if (categoryId === selectedCategoryId) {
          const selected = categoryById.get(selectedCategoryId)
          bucketName = `${selected?.name || 'カテゴリ'}（直下）`
          bucketIcon = selected?.icon || null
        } else {
          bucketId = directChildBelow(categoryId, selectedCategoryId)
          const category = bucketId ? categoryById.get(bucketId) : null
          bucketName = category?.name || 'その他'
          bucketIcon = category?.icon || null
          bucketHasChildren = Boolean(bucketId && hasChildren(bucketId))
        }
      }

      const key = bucketId || `direct:${selectedCategoryId || 'root'}`
      const current = totals.get(key) || {
        id: bucketId,
        name: bucketName,
        icon: bucketIcon,
        amount: 0,
        hasChildren: bucketHasChildren,
      }
      current.amount += amount
      totals.set(key, current)
    }

    return Array.from(totals.values()).sort((a, b) => b.amount - a.amount)
  }, [categories, categoryById, scopedExpenses, selectedCategoryId])

  const categoryViewTotal = categoryRows.reduce((sum, row) => sum + row.amount, 0)

  const selectedCategoryTransactions = useMemo(() => {
    if (!selectedCategoryId || selectedCategoryHasChildren) return []
    return scopedExpenses
      .filter((expense) => expense.category_id === selectedCategoryId)
      .sort((a, b) => {
        const dateDiff = b.expense_date.localeCompare(a.expense_date)
        return dateDiff !== 0 ? dateDiff : Number(b.amount) - Number(a.amount)
      })
  }, [scopedExpenses, selectedCategoryHasChildren, selectedCategoryId])

  const topCategory = categoryRows[0] || null
  const secondCategory = categoryRows[1] || null

  const highlights = useMemo(() => {
    const rows: string[] = []

    if (topCategory) {
      rows.push(`最大カテゴリは「${topCategory.name}」で ${formatYen(topCategory.amount)}`)
    }

    if (topCategory && secondCategory && topCategory.name === '食費') {
      rows.push(`食費は全支出の ${((topCategory.amount / Math.max(monthExpense, 1)) * 100).toFixed(0)}% を占めています`)
    } else if (previousExpense > 0) {
      const diff = monthExpense - previousExpense
      rows.push(`支出は前月より ${formatYen(Math.abs(diff))} ${diff >= 0 ? '増加' : '減少'}`)
    }

    if (settlementRows.length > 0 && rows.length < 2) {
      rows.push(`精算対象は ${settlementRows.length}件・${formatYen(settlementTarget)}`)
    }

    return rows.slice(0, 2)
  }, [monthExpense, previousExpense, secondCategory, settlementRows.length, settlementTarget, topCategory])

  const budgetLimit = financeScope === 'combined' ? Number(budget?.total_limit || 0) : 0
  const sharedBudgetPct = budgetLimit > 0 ? clamp((sharedExpense / budgetLimit) * 100) : 0

  const settlementDirection = settlement && settlement.amount > 0
    ? `${displayPerson(settlement.from_user, user, partner)} → ${displayPerson(settlement.to_user, user, partner)}`
    : '精算なし'

  const nextActions = useMemo(() => {
    const actions: { title: string; priority: '高' | '中'; icon: React.ReactNode }[] = []

    if (anomalies.length > 0) {
      actions.push({
        title: `要確認の明細 ${anomalies.length}件を整理する`,
        priority: '高',
        icon: <CircleAlert className="h-4 w-4" />,
      })
    } else {
      actions.push({
        title: 'カード支払い後の現金残高を確認する',
        priority: '高',
        icon: <WalletCards className="h-4 w-4" />,
      })
    }

    if (budgetLimit > 0 && sharedExpense > budgetLimit) {
      actions.push({
        title: '共通生活費の予算超過カテゴリを見直す',
        priority: '中',
        icon: <House className="h-4 w-4" />,
      })
    } else {
      actions.push({
        title: '食費と日用品の予算進捗を週次で確認する',
        priority: '中',
        icon: <ShoppingBag className="h-4 w-4" />,
      })
    }

    actions.push({
      title: monthlyInvestmentTotal > 0 ? 'NISAの積立額を維持する' : 'NISAの積立額を設定する',
      priority: '中',
      icon: <TrendingUp className="h-4 w-4" />,
    })

    return actions
  }, [anomalies.length, budgetLimit, monthlyInvestmentTotal, sharedExpense])

  const navigateMonth = (direction: number) => {
    setSelectedMonth(format(addMonths(displayDate, direction), 'yyyy-MM'))
    setCategoryPath([])
  }

  const kpiIncome = monthIncome > 0 ? formatYen(monthIncome) : '未連携'
  const kpiBalance = monthIncome > 0 ? formatSignedYen(monthBalance) : '—'

  return (
    <div className="-mx-4 -mt-4 pb-10 md:-mx-6 md:-mt-6">
      <section className="bg-[#0b1830] px-4 pb-8 pt-5 text-white md:px-6 md:pb-10 md:pt-7">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black tracking-[0.18em] text-white/70">LIFE_OS</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Monthly Report</h1>
              <div className="mt-3 flex items-center gap-2">
                <Badge className="rounded-full border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-white/10">
                  {format(displayDate, 'yyyy年M月')}
                </Badge>
                <span className="text-xs font-semibold text-white/55">{FINANCE_SCOPE_LABELS[financeScope]}</span>
              </div>
            </div>

            <div className="flex items-center rounded-full border border-white/10 bg-white/5 p-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-white hover:bg-white/10 hover:text-white"
                onClick={() => navigateMonth(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[62px] text-center text-xs font-black text-white/85">
                {format(displayDate, 'yyyy/MM')}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-white hover:bg-white/10 hover:text-white"
                onClick={() => navigateMonth(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto -mt-4 max-w-5xl space-y-4 px-4 md:px-6">
        <Card className="overflow-hidden rounded-[28px] border-0 bg-card shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
          <CardHeader className="border-b px-4 py-4 md:px-5">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-sky-600" />
              <CardTitle className="text-sm font-black">エグゼクティブサマリー</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 divide-x divide-y">
              <KpiCard
                label="収入"
                value={kpiIncome}
                meta={monthIncome > 0 ? incomeDelta.label : '収入データ未連携'}
                icon={<Banknote className="h-4 w-4" />}
                tone="blue"
              />
              <KpiCard
                label="支出"
                value={formatYen(monthExpense)}
                meta={expenseDelta.label}
                icon={<ShoppingBag className="h-4 w-4" />}
                tone="red"
              />
              <KpiCard
                label="収支"
                value={kpiBalance}
                meta={monthIncome > 0 ? balanceDelta.label : '収入連携後に表示'}
                icon={monthBalance >= 0
                  ? <ArrowUpRight className="h-4 w-4" />
                  : <ArrowDownRight className="h-4 w-4" />}
                tone="green"
              />
              <KpiCard
                label="NISA"
                value={formatYen(monthlyInvestmentTotal)}
                meta={monthlyInvestmentTotal > 0 ? '月次の固定積立' : '積立設定なし'}
                icon={<Sprout className="h-4 w-4" />}
                tone="purple"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border bg-card shadow-none">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <p className="text-sm font-black">今月のハイライト</p>
              </div>
              <Link href="/finance/expenses" className="text-[11px] font-bold text-primary">
                詳細を見る
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {highlights.length > 0 ? highlights.map((highlight) => (
                <div key={highlight} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                  <p className="text-sm font-semibold leading-6">{highlight}</p>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">今月の支出データが揃うと、ここに要点を表示します。</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[28px] border bg-card shadow-none">
          <CardHeader className="border-b px-4 py-4 md:px-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-black">カテゴリ別支出</CardTitle>
                <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                  {selectedCategoryId
                    ? `${categoryById.get(selectedCategoryId)?.name || 'カテゴリ'} の内訳`
                    : `支出合計 ${formatYen(monthExpense)}`}
                </p>
              </div>
              {selectedCategoryId ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-full px-2.5 text-xs"
                  onClick={() => setCategoryPath((current) => current.slice(0, -1))}
                >
                  <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                  戻る
                </Button>
              ) : (
                <Link href="/finance/expenses" className="text-[11px] font-bold text-primary">
                  すべて見る
                </Link>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {selectedCategoryId && !selectedCategoryHasChildren ? (
              selectedCategoryTransactions.length > 0 ? (
                <div className="divide-y">
                  {selectedCategoryTransactions.slice(0, 8).map((expense) => (
                    <div key={expense.id} className="flex items-center gap-3 px-4 py-3.5 md:px-5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-[11px] font-black text-slate-500 dark:bg-slate-800">
                        {expense.expense_date.slice(8, 10)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">
                          {expense.description || expense.expense_categories?.name || '支出'}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {expense.expense_date.slice(5).replace('-', '/')} · {displayPerson(expense.paid_by, user, partner)}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-black tabular-nums">{formatYen(Number(expense.amount))}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">このカテゴリの支出はありません。</p>
              )
            ) : categoryRows.length > 0 ? (
              <div className="divide-y">
                {categoryRows.slice(0, 5).map((row, index) => {
                  const pct = categoryViewTotal > 0 ? (row.amount / categoryViewTotal) * 100 : 0
                  const fills = ['bg-sky-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500']
                  const iconFills = [
                    'bg-sky-500/10 text-sky-600',
                    'bg-violet-500/10 text-violet-600',
                    'bg-emerald-500/10 text-emerald-600',
                    'bg-amber-500/10 text-amber-600',
                    'bg-rose-500/10 text-rose-600',
                  ]

                  const content = (
                    <div className="flex items-center gap-3 px-4 py-4 md:px-5">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xs font-black ${iconFills[index % iconFills.length]}`}>
                        {row.icon || index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-bold">{row.name}</p>
                          <div className="flex shrink-0 items-baseline gap-2">
                            <span className="text-[11px] font-bold text-muted-foreground">{pct.toFixed(0)}%</span>
                            <span className="text-sm font-black tabular-nums">{formatYen(row.amount)}</span>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${fills[index % fills.length]}`}
                            style={{ width: `${clamp(pct)}%` }}
                          />
                        </div>
                      </div>
                      {row.id ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
                    </div>
                  )

                  return row.id ? (
                    <button
                      key={row.id}
                      type="button"
                      className="block w-full text-left transition-colors hover:bg-muted/35 active:bg-muted/60"
                      onClick={() => setCategoryPath((current) => [...current, row.id!])}
                    >
                      {content}
                    </button>
                  ) : (
                    <div key={row.name}>{content}</div>
                  )
                })}
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">支出データがありません。</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border bg-card shadow-none">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600">
                  <House className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-black">共同生活費</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {FINANCE_SCOPE_LABELS[financeScope]}
                  </p>
                </div>
              </div>
              <Link href="/finance/settlements" className="text-[11px] font-bold text-primary">
                精算を見る
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-3 divide-x rounded-2xl border bg-muted/20">
              <div className="px-3 py-3.5">
                <p className="text-[10px] font-semibold text-muted-foreground">予算</p>
                <p className="mt-1 text-base font-black tabular-nums">
                  {budgetLimit > 0 ? formatYen(budgetLimit) : '未設定'}
                </p>
              </div>
              <div className="px-3 py-3.5">
                <p className="text-[10px] font-semibold text-muted-foreground">実績</p>
                <p className="mt-1 text-base font-black tabular-nums">{formatYen(sharedExpense)}</p>
              </div>
              <div className="px-3 py-3.5">
                <p className="text-[10px] font-semibold text-muted-foreground">精算</p>
                <div className="mt-1 flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-xs font-black">{settlement?.amount ? formatYen(settlement.amount) : 'なし'}</span>
                </div>
              </div>
            </div>

            {budgetLimit > 0 ? (
              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-sky-500"
                    style={{ width: `${sharedBudgetPct}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-medium text-muted-foreground">
                  <span>予算進捗 {sharedBudgetPct.toFixed(0)}%</span>
                  <span>{settlementDirection}</span>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border bg-card shadow-none">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-sky-600" />
              <p className="text-sm font-black">次月アクション</p>
            </div>

            <div className="mt-3 divide-y">
              {nextActions.map((action) => (
                <div key={action.title} className="flex items-center gap-3 py-3.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/20 text-muted-foreground">
                    {action.icon}
                  </div>
                  <p className="min-w-0 flex-1 text-sm font-bold leading-5">{action.title}</p>
                  <Badge
                    variant="secondary"
                    className={action.priority === '高'
                      ? 'shrink-0 rounded-full bg-rose-500/10 px-2 text-[10px] font-black text-rose-600 hover:bg-rose-500/10'
                      : 'shrink-0 rounded-full bg-sky-500/10 px-2 text-[10px] font-black text-sky-600 hover:bg-sky-500/10'}
                  >
                    優先度：{action.priority}
                  </Badge>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-2 pb-2">
          <Link
            href="/finance/expenses"
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-muted/55 px-2 py-3 text-xs font-bold transition-colors hover:bg-muted"
          >
            <ReceiptText className="h-4 w-4" />
            <span>家計簿</span>
          </Link>
          <Link
            href="/finance/settlements"
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-muted/55 px-2 py-3 text-xs font-bold transition-colors hover:bg-muted"
          >
            <Scale className="h-4 w-4" />
            <span>精算</span>
          </Link>
          <Link
            href="/finance/import"
            className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-muted/55 px-2 py-3 text-xs font-bold transition-colors hover:bg-muted"
          >
            <FileUp className="h-4 w-4" />
            <span>CSV</span>
          </Link>
        </div>
      </main>
    </div>
  )
}
