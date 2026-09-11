'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatYen } from '@/lib/finance/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useFinancePlanItems, type FinancePlanHorizon, type FinancePlanItem } from '@/lib/hooks/use-finance-plan'
import { usePlanVsActual } from '@/lib/hooks/use-plan-vs-actual'

const HORIZONS: Array<{ key: FinancePlanHorizon; title: string; range: string }> = [
  { key: 'short', title: '短期', range: '〜3ヶ月' },
  { key: 'medium', title: '中期', range: '3ヶ月〜3年' },
  { key: 'long', title: '長期', range: '3年以上' },
]

function formatTargetDate(value: string | null) {
  if (!value) return '期限なし'
  const [year, month, day] = value.split('-')
  return `${year}/${Number(month)}/${Number(day)}`
}

function PlanItemRow({ item }: { item: FinancePlanItem }) {
  const progress = item.target_amount && item.current_amount != null && item.target_amount > 0
    ? Math.min(100, Math.max(0, (item.current_amount / item.target_amount) * 100))
    : null

  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-semibold">{item.title}</p>
            {item.category ? <span className="text-xs text-muted-foreground">{item.category}</span> : null}
            {item.priority === 'high' ? <span className="text-xs font-medium">重要</span> : null}
          </div>
          {item.description ? <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.description}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          {item.target_amount != null ? <p className="text-sm font-semibold tabular-nums">{formatYen(item.target_amount)}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">{formatTargetDate(item.target_date)}</p>
        </div>
      </div>

      {progress != null ? (
        <div className="mt-3">
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-foreground" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {formatYen(item.current_amount || 0)} / {formatYen(item.target_amount || 0)} · {progress.toFixed(0)}%
          </p>
        </div>
      ) : null}
    </div>
  )
}

export default function FinancePlanPage() {
  const { couple } = useAuth()
  const { data: items, isLoading } = useFinancePlanItems(couple?.id)
  const planVsActual = usePlanVsActual(couple?.id)
  const actual = planVsActual.currentYear
  const activeItems = (items || []).filter((item) => item.status === 'active' || item.status === 'paused')
  const nextItem = [...activeItems.filter((item) => item.target_date)].sort((a, b) => (a.target_date || '').localeCompare(b.target_date || ''))[0]

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-8">
      <header>
        <h1 className="text-[28px] font-semibold tracking-tight">計画</h1>
        <p className="mt-1 text-sm text-muted-foreground">近い予定から長期の資産形成まで。</p>
      </header>

      {nextItem ? (
        <section className="border-y py-6">
          <p className="text-xs font-medium text-muted-foreground">次に備えること</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight">{nextItem.title}</h2>
              {nextItem.description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{nextItem.description}</p> : null}
            </div>
            <div className="text-right">
              {nextItem.target_amount != null ? <p className="text-2xl font-semibold tabular-nums">{formatYen(nextItem.target_amount)}</p> : null}
              <p className="mt-1 text-sm text-muted-foreground">{formatTargetDate(nextItem.target_date)}</p>
            </div>
          </div>
        </section>
      ) : null}

      {actual ? (
        <section>
          <div className="flex items-baseline justify-between gap-4 border-b pb-3">
            <h2 className="text-base font-semibold">{actual.year}年</h2>
            <span className="text-xs text-muted-foreground">計画と実績</span>
          </div>
          <div className="grid grid-cols-3 divide-x py-5 text-center">
            <div className="px-2">
              <p className="text-xs text-muted-foreground">収入</p>
              <p className="mt-1 text-base font-semibold tabular-nums">{formatYen(actual.actualAnnualIncome)}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">計画 {formatYen(actual.plannedAnnualIncome)}</p>
            </div>
            <div className="px-2">
              <p className="text-xs text-muted-foreground">支出</p>
              <p className="mt-1 text-base font-semibold tabular-nums">{formatYen(actual.actualAnnualExpense)}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">計画 {formatYen(actual.plannedAnnualExpense)}</p>
            </div>
            <div className="px-2">
              <p className="text-xs text-muted-foreground">収支</p>
              <p className="mt-1 text-base font-semibold tabular-nums">{formatYen(actual.actualAnnualIncome - actual.actualAnnualExpense)}</p>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-3">
        {HORIZONS.map((horizon) => {
          const horizonItems = activeItems.filter((item) => item.horizon === horizon.key)
          return (
            <section key={horizon.key}>
              <div className="flex items-baseline justify-between gap-3 border-b pb-3">
                <h2 className="text-base font-semibold">{horizon.title}</h2>
                <span className="text-xs text-muted-foreground">{horizon.range}</span>
              </div>
              {isLoading ? (
                <p className="py-5 text-sm text-muted-foreground">読み込み中...</p>
              ) : horizonItems.length > 0 ? (
                <div className="divide-y">{horizonItems.map((item) => <PlanItemRow key={item.id} item={item} />)}</div>
              ) : (
                <p className="py-5 text-sm leading-6 text-muted-foreground">計画はまだありません。</p>
              )}
            </section>
          )
        })}
      </div>

      <section className="flex flex-wrap items-center justify-between gap-4 border-t pt-6">
        <div>
          <p className="text-sm font-semibold">五カ年シミュレーション</p>
          <p className="mt-1 text-xs text-muted-foreground">年収・生活費・資産推移の前提を確認・編集。</p>
        </div>
        <Link href="/finance/life-plan">
          <Button variant="ghost" className="gap-1.5 px-2">開く <ArrowRight className="h-4 w-4" /></Button>
        </Link>
      </section>
    </div>
  )
}
