'use client'

import Link from 'next/link'
import { ArrowRight, Bot, CalendarDays, CircleDollarSign, Clock3, Route, Telescope } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatYen } from '@/lib/finance/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useFinancePlanItems, type FinancePlanHorizon, type FinancePlanItem } from '@/lib/hooks/use-finance-plan'
import { usePlanVsActual } from '@/lib/hooks/use-plan-vs-actual'

const HORIZONS: Array<{ key: FinancePlanHorizon; title: string; range: string; description: string; icon: typeof Clock3 }> = [
  { key: 'short', title: '短期', range: '〜3ヶ月', description: '今月〜次の四半期。現金、直近の大きな支出、生活費の調整。', icon: Clock3 },
  { key: 'medium', title: '中期', range: '3ヶ月〜3年', description: '結婚、転職、旅行、引越しなど、数年以内の意思決定。', icon: Route },
  { key: 'long', title: '長期', range: '3年以上', description: '資産形成、家族、住宅、働き方など、人生全体の財務方針。', icon: Telescope },
]

function formatTargetDate(value: string | null) {
  if (!value) return '期限未設定'
  const [year, month, day] = value.split('-')
  return `${year}/${Number(month)}/${Number(day)}`
}

function PlanItemRow({ item }: { item: FinancePlanItem }) {
  const progress = item.target_amount && item.current_amount != null && item.target_amount > 0
    ? Math.min(100, Math.max(0, (item.current_amount / item.target_amount) * 100))
    : null

  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">{item.title}</p>
            {item.category && <Badge variant="outline">{item.category}</Badge>}
            {item.priority === 'high' && <Badge>重要</Badge>}
            {item.status === 'achieved' && <Badge variant="secondary">達成</Badge>}
          </div>
          {item.description && <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.description}</p>}
        </div>
        {item.source === 'chatgpt' && <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground"><Bot className="h-3 w-3" /> AI</span>}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{formatTargetDate(item.target_date)}</span>
        {item.target_amount != null && <span className="inline-flex items-center gap-1.5 font-medium"><CircleDollarSign className="h-3.5 w-3.5" />{formatYen(item.target_amount)}</span>}
      </div>
      {progress != null && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground"><span>進捗 {formatYen(item.current_amount || 0)} / {formatYen(item.target_amount || 0)}</span><span>{progress.toFixed(0)}%</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div>
        </div>
      )}
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
    <div className="space-y-7">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold tracking-tight">お金の計画</h1><Badge variant="outline" className="gap-1 font-normal"><Bot className="h-3 w-3" />会話で更新</Badge></div>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">ChatGPTと相談して決めた短期・中期・長期の方針と、DBに積み上がった実績を同じ場所で確認します。</p>
      </div>

      {actual && (
        <Card className="border-primary/20">
          <CardHeader><CardTitle className="text-base">{actual.year}年 計画 vs 実績</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">支出</p><p className="mt-1 text-lg font-semibold">{formatYen(actual.actualAnnualExpense)}</p><p className="text-xs text-muted-foreground">計画 {formatYen(actual.plannedAnnualExpense)}</p></div>
            <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">収入</p><p className="mt-1 text-lg font-semibold">{formatYen(actual.actualAnnualIncome)}</p><p className="text-xs text-muted-foreground">計画 {formatYen(actual.plannedAnnualIncome)}</p></div>
            <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">実績収支</p><p className="mt-1 text-lg font-semibold">{formatYen(actual.actualAnnualIncome - actual.actualAnnualExpense)}</p><p className="text-xs text-muted-foreground">台帳実績から自動更新</p></div>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/20"><CardContent className="p-6 md:p-7">
        {nextItem ? (
          <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
            <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">NEXT PRIORITY</p><h2 className="mt-2 text-2xl font-bold tracking-tight">{nextItem.title}</h2>{nextItem.description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{nextItem.description}</p>}</div>
            <div className="flex flex-col gap-1 md:text-right"><span className="text-sm text-muted-foreground">{formatTargetDate(nextItem.target_date)}</span>{nextItem.target_amount != null && <span className="text-2xl font-bold">{formatYen(nextItem.target_amount)}</span>}</div>
          </div>
        ) : (
          <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">PLANNING LAYER</p><h2 className="mt-2 text-xl font-bold">ここから会話で計画を育てる</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">決めた内容を短期・中期・長期へ保存していきます。</p></div>
        )}
      </CardContent></Card>

      <div className="grid gap-5 xl:grid-cols-3">
        {HORIZONS.map((horizon) => {
          const Icon = horizon.icon
          const horizonItems = activeItems.filter((item) => item.horizon === horizon.key)
          return (
            <section key={horizon.key} className="space-y-3">
              <div className="flex items-start gap-3 px-1"><div className="mt-0.5 rounded-lg border bg-background p-2"><Icon className="h-4 w-4" /></div><div><div className="flex items-baseline gap-2"><h2 className="text-lg font-bold">{horizon.title}</h2><span className="text-xs text-muted-foreground">{horizon.range}</span></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{horizon.description}</p></div></div>
              <div className="space-y-3">
                {isLoading ? <div className="rounded-xl border p-4 text-sm text-muted-foreground">読み込み中...</div> : horizonItems.length > 0 ? horizonItems.map((item) => <PlanItemRow key={item.id} item={item} />) : <div className="rounded-xl border border-dashed p-5 text-sm leading-6 text-muted-foreground">まだ計画はありません。ChatGPTとの会話で決まった内容がここに入ります。</div>}
              </div>
            </section>
          )
        })}
      </div>

      <Card><CardHeader className="pb-2"><CardTitle className="text-base">詳細シミュレーション</CardTitle></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-2xl"><p className="text-sm font-medium">年収・生活費・資産推移を年度単位で確認</p><p className="mt-1 text-xs leading-5 text-muted-foreground">五カ年モデルではDB実績と将来仮定を分けて扱います。</p></div>
        <Link href="/finance/life-plan"><Button variant="outline" className="gap-1.5">詳細を見る <ArrowRight className="h-4 w-4" /></Button></Link>
      </CardContent></Card>
    </div>
  )
}
