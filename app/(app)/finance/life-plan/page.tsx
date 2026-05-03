'use client'

import Link from 'next/link'
import { useState, useCallback, useMemo } from 'react'
import { TrendingUp, Wallet, Calendar, Settings2, Home, Users, Download, Save, Plus, X, Pencil, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/lib/hooks/use-auth'
import { useIncomeActualsByYears } from '@/lib/hooks/use-incomes'
import { useLifePlan, useLifePlanConfig, useSimulation, useSaveLifePlan, useInitLifePlan } from '@/lib/hooks/use-life-plan'
import type { LifePlanConfig, LifeEvent } from '@/types/life-plan'
import { summarizeLivingCosts } from '@/lib/life-plan/engine'
import { toast } from 'sonner'

/*
  Color Palette:
  #0a3323  foreground
  #839958  secondary
  #f7f4d5  background
  #d3968c  accent
  #105666  primary
*/

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`
const pct = (n: number) => `${(n * 100).toFixed(1)}%`

interface MonthlyIncomeActual {
  month: string
  label: string
  total: number
}

interface YearIncomeActual {
  year: number
  total: number
  mine: number
  partner: number
  monthsRecorded: number
  monthly: MonthlyIncomeActual[]
}

/** Read-only computed value — gray text on near-white bg */
function Computed({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`tabular-nums text-muted-foreground ${className}`}>{children}</span>
}

/** Strong computed value — for totals and key metrics */
function ComputedBold({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`tabular-nums font-bold text-foreground ${className}`}>{children}</span>
}

/** Editable number input — sage green bg with green border */
function NumInput({
  value,
  onChange,
  className = '',
  step,
}: {
  value: number
  onChange: (v: number) => void
  className?: string
  step?: string
}) {
  return (
    <Input
      type="number"
      step={step}
      className={`h-7 text-right text-sm bg-accent border-accent text-accent-foreground focus:border-primary focus:ring-primary ${className}`}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

/** Editable text input — sage green bg */
function TextInput({
  value,
  onChange,
  className = '',
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
}) {
  return (
    <Input
      className={`h-7 text-sm bg-accent border-accent text-accent-foreground focus:border-primary focus:ring-primary ${className}`}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/** Section header badge for editable/computed distinction */
function EditableBadge() {
  return <Badge className="ml-2 border-accent bg-accent text-[10px] text-accent-foreground"><Pencil className="mr-0.5 h-2.5 w-2.5" />編集可能</Badge>
}
function ComputedBadge() {
  return <Badge className="ml-2 border-border bg-background text-[10px] text-muted-foreground">自動計算</Badge>
}

export default function LifePlanPage() {
  const { user, partner, couple } = useAuth()
  const { data: lifePlan, isLoading } = useLifePlan(couple?.id)
  const defaultConfig = useLifePlanConfig(couple?.id)
  const [localConfig, setLocalConfig] = useState<LifePlanConfig | null>(null)
  const config = localConfig ?? defaultConfig
  const sim = useSimulation(config)
  const savePlan = useSaveLifePlan()
  const initPlan = useInitLifePlan()
  const incomeYears = useMemo(
    () => [...new Set(config.incomeData.map((entry) => entry.year))].sort((a, b) => a - b),
    [config.incomeData]
  )
  const { data: incomeActualRows } = useIncomeActualsByYears(couple?.id, incomeYears)

  const incomeActualsByYear = useMemo(() => {
    const yearMap = new Map<number, YearIncomeActual>()
    const monthlyMaps = new Map<number, Map<string, number>>()

    for (const year of incomeYears) {
      yearMap.set(year, {
        year,
        total: 0,
        mine: 0,
        partner: 0,
        monthsRecorded: 0,
        monthly: [],
      })
    }

    for (const row of incomeActualRows || []) {
      const year = Number(row.income_date.slice(0, 4))
      const month = row.income_date.slice(0, 7)
      const entry = yearMap.get(year)
      if (!entry) continue

      const amount = Number(row.amount)
      entry.total += amount
      if (row.user_id === user?.id) entry.mine += amount
      else if (row.user_id === partner?.id) entry.partner += amount

      const monthlyMap = monthlyMaps.get(year) ?? new Map<string, number>()
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + amount)
      monthlyMaps.set(year, monthlyMap)
    }

    for (const year of incomeYears) {
      const entry = yearMap.get(year)
      if (!entry) continue

      const monthlyMap = monthlyMaps.get(year) ?? new Map<string, number>()
      entry.monthly = Array.from(monthlyMap.entries()).map(([month, total]) => ({
        month,
        label: `${Number(month.slice(5, 7))}月`,
        total,
      }))
      entry.monthsRecorded = entry.monthly.length
    }

    return yearMap
  }, [incomeActualRows, incomeYears, partner?.id, user?.id])

  const updateConfig = useCallback((updater: (prev: LifePlanConfig) => LifePlanConfig) => {
    setLocalConfig((prev) => updater(prev ?? defaultConfig))
  }, [defaultConfig])

  const handleInit = async () => {
    if (!couple?.id) return
    try {
      await initPlan.mutateAsync(couple.id)
      setLocalConfig(null)
      toast.success('Excelデータをインポートしました')
    } catch {
      toast.error('インポートに失敗しました')
    }
  }

  const handleSave = async () => {
    if (!couple?.id) return
    try {
      await savePlan.mutateAsync({ coupleId: couple.id, config })
      setLocalConfig(null)
      toast.success('ライフプランを保存しました')
    } catch {
      toast.error('保存に失敗しました')
    }
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-8 text-center">読み込み中...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-foreground">人生キャッシュフロー</h2>
          <div className="flex items-center gap-3 text-[11px] mt-1">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-4 rounded-sm border border-accent bg-accent" />
              <span className="text-primary">編集可能</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-4 rounded-sm border border-border bg-background" />
              <span className="text-muted-foreground">自動計算</span>
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {!lifePlan && (
            <Button size="sm" variant="outline" onClick={handleInit} disabled={initPlan.isPending}
              className="border-accent text-primary hover:bg-accent">
              <Download className="h-4 w-4 mr-1" />
              Excelデータ反映
            </Button>
          )}
          {localConfig && (
            <Button size="sm" onClick={handleSave} disabled={savePlan.isPending}
              className="bg-primary text-primary-foreground hover:bg-secondary">
              <Save className="h-4 w-4 mr-1" />
              保存
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="h-auto flex-wrap border border-border bg-background">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><TrendingUp className="mr-1 h-3 w-3" />総合</TabsTrigger>
          <TabsTrigger value="assets" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Users className="mr-1 h-3 w-3" />資産推移</TabsTrigger>
          <TabsTrigger value="income" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Wallet className="mr-1 h-3 w-3" />収入</TabsTrigger>
          <TabsTrigger value="living" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Home className="mr-1 h-3 w-3" />生活費</TabsTrigger>
          <TabsTrigger value="events" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Calendar className="mr-1 h-3 w-3" />イベント</TabsTrigger>
          <TabsTrigger value="assumptions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Settings2 className="mr-1 h-3 w-3" />前提条件</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardTab sim={sim} />
        </TabsContent>
        <TabsContent value="assets">
          <AssetsTab sim={sim} />
        </TabsContent>
        <TabsContent value="income">
          <IncomeTab
            config={config}
            updateConfig={updateConfig}
            sim={sim}
            incomeActualsByYear={incomeActualsByYear}
            userLabel={user?.display_name || '自分'}
            partnerLabel={partner?.display_name || '相手'}
          />
        </TabsContent>
        <TabsContent value="living">
          <LivingCostTab config={config} updateConfig={updateConfig} />
        </TabsContent>
        <TabsContent value="events">
          <EventsTab config={config} updateConfig={updateConfig} />
        </TabsContent>
        <TabsContent value="assumptions">
          <AssumptionsTab config={config} updateConfig={updateConfig} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================
// Dashboard Tab (ALL computed)
// ============================================
function DashboardTab({ sim }: { sim: ReturnType<typeof useSimulation> }) {
  const config = { incomeData: [] as Array<{ year: number }> }
  const activeYear = 0
  const setSelectedActualYear = (_year: number) => {}
  const activeActual: YearIncomeActual = { year: 0, total: 0, mine: 0, partner: 0, monthsRecorded: 0, monthly: [] }
  const userLabel = ''
  const partnerLabel = ''

  return (
    <div className="space-y-4">
      {sim.household.length > 0 && (() => {
        const latest = sim.household[sim.household.length - 1]
        const first = sim.household[0]
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: `世帯手取り (${latest.year})`, value: yen(latest.householdNet), sub: `${yen(latest.householdNetMonthly)}/月` },
              { label: `世帯総資産 (${latest.year})`, value: yen(latest.householdTotalAssets) },
              { label: '資産年収倍率', value: `${latest.assetIncomeRatio.toFixed(2)}倍` },
              { label: `資産成長 (${first.year}→${latest.year})`, value: yen(latest.householdTotalAssets - first.householdTotalAssets) },
            ].map((card) => (
              <Card key={card.label} className="border-border">
                <CardContent className="p-4">
                  <p className="text-[11px] text-muted-foreground">{card.label}</p>
                  <p className="text-lg font-bold text-foreground">{card.value}</p>
                  {card.sub && <p className="text-[11px] text-muted-foreground">{card.sub}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )
      })()}

      {false && (
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-foreground">年度別ダッシュボード <ComputedBadge /></CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="text-left p-2 whitespace-nowrap font-medium">年度</th>
                <th className="text-left p-2 font-medium">年齢</th>
                <th className="text-right p-2 whitespace-nowrap font-medium">Ren手取</th>
                <th className="text-right p-2 whitespace-nowrap font-medium">Hikaru手取</th>
                <th className="text-right p-2 whitespace-nowrap font-medium">世帯手取</th>
                <th className="text-right p-2 whitespace-nowrap font-medium">キャッシュ</th>
                <th className="text-right p-2 whitespace-nowrap font-medium">NISA</th>
                <th className="text-right p-2 whitespace-nowrap font-medium">課税資産</th>
                <th className="text-right p-2 whitespace-nowrap font-medium">総資産</th>
                <th className="text-right p-2 whitespace-nowrap font-medium">Cash比率</th>
                <th className="text-right p-2 whitespace-nowrap font-medium">年収倍率</th>
              </tr>
            </thead>
            <tbody>
              {sim.household.map((row, i) => (
                <tr key={row.year} className={`border-b border-border ${i % 2 === 0 ? 'bg-background' : 'bg-accent'}`}>
                  <td className="p-2 font-bold text-foreground">{row.year}</td>
                  <td className="p-2 text-muted-foreground">{row.age}</td>
                  <td className="p-2 text-right"><Computed>{yen(row.renNet)}</Computed></td>
                  <td className="p-2 text-right"><Computed>{yen(row.hikaruNet)}</Computed></td>
                  <td className="p-2 text-right font-medium text-primary">{yen(row.householdNet)}</td>
                  <td className="p-2 text-right"><Computed>{yen(row.householdCash)}</Computed></td>
                  <td className="p-2 text-right"><Computed>{yen(row.householdNisa)}</Computed></td>
                  <td className="p-2 text-right"><Computed>{yen(row.householdTaxable)}</Computed></td>
                  <td className="p-2 text-right"><ComputedBold>{yen(row.householdTotalAssets)}</ComputedBold></td>
                  <td className="p-2 text-right"><Computed>{pct(row.cashRatio)}</Computed></td>
                  <td className="p-2 text-right"><Computed>{row.assetIncomeRatio.toFixed(2)}</Computed></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      )}

      {/* Asset composition bar chart */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-foreground">資産構成推移</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {sim.household.map((row) => {
            const max = Math.max(...sim.household.map((h) => h.householdTotalAssets))
            const cashW = max > 0 ? (row.householdCash / max) * 100 : 0
            const nisaW = max > 0 ? (row.householdNisa / max) * 100 : 0
            const taxW = max > 0 ? (row.householdTaxable / max) * 100 : 0
            return (
              <div key={row.year} className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-xs font-medium text-foreground">{row.year}</span>
                <div className="flex h-6 flex-1 overflow-hidden rounded-md border border-border bg-background">
                  <div className="h-full bg-accent transition-all" style={{ width: `${cashW}%` }} title={`Cash: ${yen(row.householdCash)}`} />
                  <div className="h-full bg-primary transition-all" style={{ width: `${nisaW}%` }} title={`NISA: ${yen(row.householdNisa)}`} />
                  <div className="h-full bg-foreground transition-all" style={{ width: `${taxW}%` }} title={`課税: ${yen(row.householdTaxable)}`} />
                </div>
                <span className="w-28 shrink-0 text-right text-xs font-bold text-foreground">{yen(row.householdTotalAssets)}</span>
              </div>
            )
          })}
          <div className="flex gap-4 text-xs pt-2">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-accent" /><span className="text-muted-foreground">キャッシュ</span></span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-primary" /><span className="text-muted-foreground">NISA</span></span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-foreground" /><span className="text-muted-foreground">課税資産</span></span>
          </div>
        </CardContent>
      </Card>

      {false && (
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
          <div>
            <CardTitle className="text-base text-foreground">月別の収入実績</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">月ごとの入力実績を積み上げて、その年の実績手取りとして表示します。</p>
          </div>
          <Link
            href="/finance/budgets"
            className="inline-flex h-8 items-center rounded-md border border-accent px-3 text-xs font-medium text-primary transition-colors hover:bg-accent"
          >
            月次実績を入力
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {config.incomeData.map((entry) => (
              <Button
                key={entry.year}
                size="sm"
                variant={activeYear === entry.year ? 'default' : 'outline'}
                onClick={() => setSelectedActualYear(entry.year)}
                className={activeYear === entry.year ? 'bg-primary text-primary-foreground hover:bg-secondary' : 'border-accent text-primary hover:bg-accent'}
              >
                {entry.year}年
              </Button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground">年額実績</p>
              <p className="mt-1 text-xl font-semibold text-primary">{yen(activeActual?.total ?? 0)}</p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground">内訳</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {userLabel} {yen(activeActual?.mine ?? 0)} / {partnerLabel} {yen(activeActual?.partner ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground">入力済み月数</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{activeActual?.monthsRecorded ?? 0}ヶ月</p>
            </div>
          </div>

          {activeActual?.monthly.length ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {activeActual.monthly.map((month) => (
                <div key={month.month} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{month.label}</p>
                  <p className="mt-1 font-semibold text-foreground">{yen(month.total)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              この年の月別実績はまだありません。予算ページから月ごとの収入実績を追加すると、ここに積み上がります。
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  )
}

// ============================================
// Assets Tab (ALL computed)
// ============================================
function AssetsTab({ sim }: { sim: ReturnType<typeof useSimulation> }) {
  const [person, setPerson] = useState<'ren' | 'hikaru'>('ren')
  const data = person === 'ren' ? sim.ren : sim.hikaru
  const config = { incomeData: [] as Array<{ year: number }> }
  const activeYear = 0
  const setSelectedActualYear = (_year: number) => {}
  const activeActual: YearIncomeActual = { year: 0, total: 0, mine: 0, partner: 0, monthsRecorded: 0, monthly: [] }
  const userLabel = ''
  const partnerLabel = ''

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        <Button size="sm" onClick={() => setPerson('ren')}
          className={person === 'ren' ? 'bg-primary text-primary-foreground hover:bg-secondary' : 'bg-background text-primary border-accent hover:bg-accent'}>
          Ren
        </Button>
        <Button size="sm" onClick={() => setPerson('hikaru')}
          className={person === 'hikaru' ? 'bg-primary text-primary-foreground hover:bg-secondary' : 'bg-background text-primary border-accent hover:bg-accent'}>
          Hikaru
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-foreground">
            {person === 'ren' ? 'Ren' : 'Hikaru'} 資産推移
            <ComputedBadge />
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="text-left p-2 font-medium">年度</th>
                <th className="text-right p-2 font-medium">手取り</th>
                <th className="text-right p-2 font-medium">生活費</th>
                <th className="text-right p-2 font-medium">可処分</th>
                <th className="text-right p-2 font-medium">イベント</th>
                <th className="text-right p-2 font-medium">Cash積立</th>
                <th className="text-right p-2 font-medium">Cash残高</th>
                <th className="text-right p-2 font-medium">投資可能</th>
                <th className="text-right p-2 font-medium">NISA投資</th>
                <th className="text-right p-2 font-medium">NISA残高</th>
                <th className="text-right p-2 font-medium">課税投資</th>
                <th className="text-right p-2 font-medium">課税残高</th>
                <th className="text-right p-2 font-medium">総資産</th>
                <th className="text-right p-2 font-medium">成長率</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={row.year} className={`border-b border-border ${i % 2 === 0 ? 'bg-background' : 'bg-accent'}`}>
                  <td className="p-2 font-bold text-foreground">{row.year}</td>
                  <td className="p-2 text-right"><Computed>{yen(row.net)}</Computed></td>
                  <td className="p-2 text-right"><Computed>{yen(row.livingCost)}</Computed></td>
                  <td className="p-2 text-right"><Computed>{yen(row.disposable)}</Computed></td>
                  <td className="p-2 text-right">{row.eventCost > 0 ? <span className="font-medium text-accent">{yen(row.eventCost)}</span> : <Computed>-</Computed>}</td>
                  <td className="p-2 text-right"><Computed>{yen(row.cashReserve)}</Computed></td>
                  <td className="p-2 text-right font-medium text-primary">{yen(row.cashBalance)}</td>
                  <td className="p-2 text-right"><Computed>{yen(row.investable)}</Computed></td>
                  <td className="p-2 text-right"><Computed>{yen(row.nisaInvestment)}</Computed></td>
                  <td className="p-2 text-right font-medium text-primary">{yen(row.nisaBalance)}</td>
                  <td className="p-2 text-right"><Computed>{yen(row.nonNisaInvestment)}</Computed></td>
                  <td className="p-2 text-right font-medium text-primary">{yen(row.taxableBalance)}</td>
                  <td className="p-2 text-right"><ComputedBold>{yen(row.totalAssets)}</ComputedBold></td>
                  <td className="p-2 text-right"><Computed>{row.assetGrowthRate ? pct(row.assetGrowthRate) : '-'}</Computed></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-foreground">{person === 'ren' ? 'Ren' : 'Hikaru'} 資産構成</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {data.map((row) => {
            const max = Math.max(...data.map((d) => d.totalAssets))
            const cashW = max > 0 ? (row.cashBalance / max) * 100 : 0
            const nisaW = max > 0 ? (row.nisaBalance / max) * 100 : 0
            const taxW = max > 0 ? (row.taxableBalance / max) * 100 : 0
            return (
              <div key={row.year} className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-xs font-medium text-foreground">{row.year}</span>
                <div className="flex h-6 flex-1 overflow-hidden rounded-md border border-border bg-background">
                  <div className="h-full bg-secondary" style={{ width: `${cashW}%` }} />
                  <div className="h-full bg-primary" style={{ width: `${nisaW}%` }} />
                  <div className="h-full bg-foreground" style={{ width: `${taxW}%` }} />
                </div>
                <span className="w-28 shrink-0 text-right text-xs font-bold text-foreground">{yen(row.totalAssets)}</span>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
          <div>
            <CardTitle className="text-base text-foreground">月別の収入実績</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">月ごとの入力実績を積み上げて、その年の実績手取りとして表示します。</p>
          </div>
          <Link
            href="/finance/budgets"
            className="inline-flex h-8 items-center rounded-md border border-accent px-3 text-xs font-medium text-primary transition-colors hover:bg-accent"
          >
            月次実績を入力
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {config.incomeData.map((entry) => (
              <Button
                key={entry.year}
                size="sm"
                variant={activeYear === entry.year ? 'default' : 'outline'}
                onClick={() => setSelectedActualYear(entry.year)}
                className={activeYear === entry.year ? 'bg-primary text-primary-foreground hover:bg-secondary' : 'border-accent text-primary hover:bg-accent'}
              >
                {entry.year}年
              </Button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground">年額実績</p>
              <p className="mt-1 text-xl font-semibold text-primary">{yen(activeActual?.total ?? 0)}</p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground">内訳</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {userLabel} {yen(activeActual?.mine ?? 0)} / {partnerLabel} {yen(activeActual?.partner ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground">入力済み月数</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{activeActual?.monthsRecorded ?? 0}ヶ月</p>
            </div>
          </div>

          {activeActual?.monthly.length ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {activeActual.monthly.map((month) => (
                <div key={month.month} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{month.label}</p>
                  <p className="mt-1 font-semibold text-foreground">{yen(month.total)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              この年の月別実績はまだありません。予算ページから月ごとの収入実績を追加すると、ここに積み上がります。
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
          <div>
            <CardTitle className="text-base text-foreground">月別の収入実績</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">月ごとの入力実績を積み上げて、その年の実績手取りとして表示します。</p>
          </div>
          <Link
            href="/finance/budgets"
            className="inline-flex h-8 items-center rounded-md border border-accent px-3 text-xs font-medium text-primary transition-colors hover:bg-accent"
          >
            月次実績を入力
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {config.incomeData.map((entry) => (
              <Button
                key={entry.year}
                size="sm"
                variant={activeYear === entry.year ? 'default' : 'outline'}
                onClick={() => setSelectedActualYear(entry.year)}
                className={activeYear === entry.year ? 'bg-primary text-primary-foreground hover:bg-secondary' : 'border-accent text-primary hover:bg-accent'}
              >
                {entry.year}年
              </Button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground">年額実績</p>
              <p className="mt-1 text-xl font-semibold text-primary">{yen(activeActual?.total ?? 0)}</p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground">内訳</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {userLabel} {yen(activeActual?.mine ?? 0)} / {partnerLabel} {yen(activeActual?.partner ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground">入力済み月数</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{activeActual?.monthsRecorded ?? 0}ヶ月</p>
            </div>
          </div>

          {activeActual?.monthly?.length ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {activeActual.monthly.map((month) => (
                <div key={month.month} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{month.label}</p>
                  <p className="mt-1 font-semibold text-foreground">{yen(month.total)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              この年の月別実績はまだありません。予算ページから月ごとの収入実績を追加すると、ここに積み上がります。
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// Income Tab (editable + computed)
// ============================================
function IncomeTab({
  config,
  updateConfig,
  sim,
  incomeActualsByYear,
  userLabel,
  partnerLabel,
}: {
  config: LifePlanConfig
  updateConfig: (fn: (c: LifePlanConfig) => LifePlanConfig) => void
  sim: ReturnType<typeof useSimulation>
  incomeActualsByYear: Map<number, YearIncomeActual>
  userLabel: string
  partnerLabel: string
}) {
  const [selectedActualYear, setSelectedActualYear] = useState<number | null>(config.incomeData[0]?.year ?? null)

  const updateIncome = (yearIdx: number, path: string, value: number) => {
    updateConfig((c) => {
      const incomeData = [...c.incomeData]
      const entry = { ...incomeData[yearIdx] }
      const [person, field] = path.split('.') as ['ren' | 'hikaru', 'gross' | 'net']
      entry[person] = { ...entry[person], [field]: value }
      incomeData[yearIdx] = entry
      return { ...c, incomeData }
    })
  }

  const addYear = () => {
    updateConfig((c) => {
      const lastYear = c.incomeData.length > 0 ? c.incomeData[c.incomeData.length - 1] : null
      const newYear = lastYear ? lastYear.year + 1 : new Date().getFullYear()
      return {
        ...c,
        incomeData: [...c.incomeData, {
          year: newYear,
          ren: lastYear ? { ...lastYear.ren } : { gross: 0, net: 0 },
          hikaru: lastYear ? { ...lastYear.hikaru } : { gross: 0, net: 0 },
        }],
      }
    })
  }

  const removeYear = (idx: number) => {
    updateConfig((c) => ({
      ...c,
      incomeData: c.incomeData.filter((_, i) => i !== idx),
    }))
  }

  const activeYear = selectedActualYear ?? config.incomeData[0]?.year ?? new Date().getFullYear()
  const activeActual = incomeActualsByYear.get(activeYear)

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base text-foreground">年度別収入 <EditableBadge /></CardTitle>
          <Button size="sm" variant="outline" onClick={addYear}
            className="border-accent text-primary hover:bg-accent">
            <Plus className="h-3 w-3 mr-1" />年度追加
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-xs text-primary-foreground">
                <th className="text-left p-2 font-medium">年度</th>
                <th className="bg-secondary text-right p-2 font-medium">Ren額面</th>
                <th className="bg-secondary text-right p-2 font-medium">Ren手取</th>
                <th className="bg-secondary text-right p-2 font-medium">Hikaru額面</th>
                <th className="bg-secondary text-right p-2 font-medium">Hikaru手取</th>
                <th className="text-right p-2 font-medium">世帯額面</th>
                <th className="text-right p-2 font-medium">世帯手取</th>
                <th className="text-right p-2 font-medium">世帯可処分</th>
                <th className="text-right p-2 font-medium">世帯 実績手取り</th>
                <th className="p-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {config.incomeData.map((entry, i) => {
                const renResult = sim.ren[i]
                const hikaruResult = sim.hikaru[i]
                const actual = incomeActualsByYear.get(entry.year)
                return (
                  <tr key={entry.year} className={`border-b border-border ${i % 2 === 0 ? 'bg-background' : 'bg-accent'}`}>
                    <td className="p-2 font-bold text-foreground">{entry.year}</td>
                    <td className="bg-secondary p-2">
                      <NumInput value={entry.ren.gross} onChange={(v) => updateIncome(i, 'ren.gross', v)} className="w-28" />
                    </td>
                    <td className="bg-secondary p-2">
                      <NumInput value={entry.ren.net} onChange={(v) => updateIncome(i, 'ren.net', v)} className="w-28" />
                    </td>
                    <td className="bg-secondary p-2">
                      <NumInput value={entry.hikaru.gross} onChange={(v) => updateIncome(i, 'hikaru.gross', v)} className="w-28" />
                    </td>
                    <td className="bg-secondary p-2">
                      <NumInput value={entry.hikaru.net} onChange={(v) => updateIncome(i, 'hikaru.net', v)} className="w-28" />
                    </td>
                    <td className="p-2 text-right"><Computed>{yen(entry.ren.gross + entry.hikaru.gross)}</Computed></td>
                    <td className="p-2 text-right font-medium text-primary">{yen(entry.ren.net + entry.hikaru.net)}</td>
                    <td className="p-2 text-right">
                      <div className="font-medium text-primary">{yen(actual?.total ?? 0)}</div>
                      <div className="text-[10px] text-muted-foreground">{actual?.monthsRecorded ?? 0}/12ヶ月</div>
                    </td>
                    <td className="p-2 text-right">
                      <Computed>{renResult && hikaruResult ? yen(renResult.disposable + hikaruResult.disposable) : '-'}</Computed>
                    </td>
                    <td className="p-2">
                      {config.incomeData.length > 1 && (
                        <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-accent" onClick={() => removeYear(i)}>
                          <X className="h-3 w-3 text-accent-foreground" />
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// Living Cost Tab (editable amounts + computed totals)
// ============================================
function LivingCostTab({
  config,
  updateConfig,
}: {
  config: LifePlanConfig
  updateConfig: (fn: (c: LifePlanConfig) => LifePlanConfig) => void
}) {
  const [template, setTemplate] = useState<'beforeRen' | 'beforeHikaru' | 'afterCohabitation'>('afterCohabitation')
  const items = config.livingCosts[template]
  const summary = summarizeLivingCosts(items)

  const updateItem = (idx: number, monthly: number) => {
    updateConfig((c) => {
      const costs = { ...c.livingCosts }
      const arr = [...costs[template]]
      arr[idx] = { ...arr[idx], monthly }
      costs[template] = arr
      return { ...c, livingCosts: costs }
    })
  }

  const templateLabels = {
    beforeRen: 'Ren同棲前',
    beforeHikaru: 'Hikaru同棲前',
    afterCohabitation: '同棲後',
  }

  const ownerLabels: Record<string, string> = { shared: '共有', ren: 'Ren', hikaru: 'Hikaru' }
  const ownerStyles: Record<string, string> = {
    shared: 'bg-primary text-primary-foreground',
    ren: 'border border-secondary bg-secondary text-secondary-foreground',
    hikaru: 'border border-border bg-background text-foreground',
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        {(Object.keys(templateLabels) as (keyof typeof templateLabels)[]).map((key) => (
          <Button key={key} size="sm" onClick={() => setTemplate(key)} className={`text-xs ${
            template === key
              ? 'bg-primary text-primary-foreground hover:bg-secondary'
              : 'border-accent bg-background text-primary hover:bg-accent'
          }`}>
            {templateLabels[key]}
          </Button>
        ))}
      </div>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-foreground">{templateLabels[template]}の生活費 <EditableBadge /></CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={`${item.item}-${item.owner}-${i}`} className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center">
                <Badge className={`text-[10px] ${ownerStyles[item.owner]}`}>{ownerLabels[item.owner]}</Badge>
                <span className="truncate text-sm text-foreground">{item.category} / {item.item}</span>
                <NumInput value={item.monthly} onChange={(v) => updateItem(i, v)} className="w-24" />
                <span className="text-[11px] text-muted-foreground w-8">/月</span>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">共有合計</span><Computed className="font-medium">{yen(summary.shared)}/月</Computed></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Ren個人</span><Computed className="font-medium">{yen(summary.ren)}/月</Computed></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Hikaru個人</span><Computed className="font-medium">{yen(summary.hikaru)}/月</Computed></div>
            <div className="flex justify-between border-t border-primary pt-2">
              <span className="font-bold text-foreground">合計</span>
              <ComputedBold>{yen(summary.total)}/月（年間 {yen(summary.total * 12)}）</ComputedBold>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// Events Tab (editable + computed burden)
// ============================================
function EventsTab({
  config,
  updateConfig,
}: {
  config: LifePlanConfig
  updateConfig: (fn: (c: LifePlanConfig) => LifePlanConfig) => void
}) {
  const updateEvent = (idx: number, field: keyof LifeEvent, value: string | number) => {
    updateConfig((c) => {
      const events = [...c.lifeEvents]
      events[idx] = { ...events[idx], [field]: value }
      if (field === 'renRatio') events[idx].hikaruRatio = Math.round((1 - Number(value)) * 10000) / 10000
      if (field === 'hikaruRatio') events[idx].renRatio = Math.round((1 - Number(value)) * 10000) / 10000
      return { ...c, lifeEvents: events }
    })
  }

  const addEvent = () => {
    updateConfig((c) => ({
      ...c,
      lifeEvents: [...c.lifeEvents, {
        year: new Date().getFullYear() + 1,
        title: '', category: '', amount: 0,
        renRatio: 0.5, hikaruRatio: 0.5,
        paymentType: 'lump_sum' as const, memo: '',
      }],
    }))
  }

  const removeEvent = (idx: number) => {
    updateConfig((c) => ({ ...c, lifeEvents: c.lifeEvents.filter((_, i) => i !== idx) }))
  }

  const totalCost = config.lifeEvents.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base text-foreground">ライフイベント <EditableBadge /></CardTitle>
          <Button size="sm" variant="outline" onClick={addEvent}
            className="border-accent text-primary hover:bg-accent">
            <Plus className="h-3 w-3 mr-1" />追加
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-xs text-primary-foreground">
                <th className="bg-secondary text-left p-2 font-medium">年度</th>
                <th className="bg-secondary text-left p-2 font-medium">イベント</th>
                <th className="bg-secondary text-left p-2 font-medium">カテゴリ</th>
                <th className="bg-secondary text-right p-2 font-medium">支出額</th>
                <th className="bg-secondary text-right p-2 font-medium">Ren比率</th>
                <th className="text-right p-2 font-medium">Ren負担</th>
                <th className="text-right p-2 font-medium">Hikaru負担</th>
                <th className="bg-secondary text-left p-2 font-medium">メモ</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {config.lifeEvents.map((event, i) => (
                <tr key={i} className={`border-b border-border ${i % 2 === 0 ? 'bg-background' : 'bg-accent'}`}>
                  <td className="bg-secondary p-2">
                    <NumInput value={event.year} onChange={(v) => updateEvent(i, 'year', v)} className="w-16" />
                  </td>
                  <td className="bg-secondary p-2">
                    <TextInput value={event.title} onChange={(v) => updateEvent(i, 'title', v)} className="w-24" placeholder="名前" />
                  </td>
                  <td className="bg-secondary p-2">
                    <TextInput value={event.category} onChange={(v) => updateEvent(i, 'category', v)} className="w-16" />
                  </td>
                  <td className="bg-secondary p-2">
                    <NumInput value={event.amount} onChange={(v) => updateEvent(i, 'amount', v)} className="w-28" />
                  </td>
                  <td className="bg-secondary p-2">
                    <NumInput value={event.renRatio} onChange={(v) => updateEvent(i, 'renRatio', v)} className="w-16" step="0.01" />
                  </td>
                  <td className="p-2 text-right"><Computed>{yen(event.amount * event.renRatio)}</Computed></td>
                  <td className="p-2 text-right"><Computed>{yen(event.amount * event.hikaruRatio)}</Computed></td>
                  <td className="bg-secondary p-2">
                    <TextInput value={event.memo} onChange={(v) => updateEvent(i, 'memo', v)} className="w-28" />
                  </td>
                  <td className="p-2">
                    <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-accent" onClick={() => removeEvent(i)}>
                      <X className="h-3 w-3 text-accent-foreground" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 border-t border-primary pt-2 text-right text-sm">
            <span className="text-muted-foreground">合計: </span>
            <ComputedBold>{yen(totalCost)}</ComputedBold>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// Assumptions Tab (editable)
// ============================================
function AssumptionsTab({
  config,
  updateConfig,
}: {
  config: LifePlanConfig
  updateConfig: (fn: (c: LifePlanConfig) => LifePlanConfig) => void
}) {
  const updateAssumption = (field: string, value: number) => {
    updateConfig((c) => ({ ...c, assumptions: { ...c.assumptions, [field]: value } }))
  }

  const updateInitialAssets = (person: 'ren' | 'hikaru', field: string, value: number) => {
    updateConfig((c) => ({
      ...c,
      initialAssets: { ...c.initialAssets, [person]: { ...c.initialAssets[person], [field]: value } },
    }))
  }

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-foreground">前提条件 <EditableBadge /></CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-medium text-foreground">キャッシュ確保率</Label>
              <div className="flex items-center gap-2">
                <NumInput value={config.assumptions.cashReserveRatio} onChange={(v) => updateAssumption('cashReserveRatio', v)} className="w-24" step="0.01" />
                <Computed>= {pct(config.assumptions.cashReserveRatio)}</Computed>
              </div>
              <p className="text-[11px] text-muted-foreground">手取りの何割をキャッシュとして確保するか</p>
            </div>
            <div className="space-y-2">
              <Label className="font-medium text-foreground">目標防衛資金（月数）</Label>
              <div className="flex items-center gap-2">
                <NumInput value={config.assumptions.defenseMonths} onChange={(v) => updateAssumption('defenseMonths', v)} className="w-24" />
                <span className="text-sm text-muted-foreground">ヶ月分の生活費</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-medium text-foreground">想定投資利回り</Label>
              <div className="flex items-center gap-2">
                <NumInput value={config.assumptions.returnRate} onChange={(v) => updateAssumption('returnRate', v)} className="w-24" step="0.01" />
                <Computed>= 年{pct(config.assumptions.returnRate)}</Computed>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-medium text-foreground">NISA年間投入枠</Label>
              <div className="flex items-center gap-2">
                <NumInput value={config.assumptions.nisaAnnualLimit} onChange={(v) => updateAssumption('nisaAnnualLimit', v)} className="w-32" />
                <span className="text-sm text-muted-foreground">円/年</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-foreground">初期資産 <EditableBadge /></CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(['ren', 'hikaru'] as const).map((person) => (
              <div key={person} className="space-y-3 rounded-lg border border-border bg-background p-3">
                <h4 className="font-bold text-foreground">{person === 'ren' ? 'Ren' : 'Hikaru'}</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="w-20 text-xs text-muted-foreground">キャッシュ</Label>
                    <NumInput value={config.initialAssets[person].cash} onChange={(v) => updateInitialAssets(person, 'cash', v)} className="w-32" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="w-20 text-xs text-muted-foreground">NISA</Label>
                    <NumInput value={config.initialAssets[person].nisa} onChange={(v) => updateInitialAssets(person, 'nisa', v)} className="w-32" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="w-20 text-xs text-muted-foreground">課税資産</Label>
                    <NumInput value={config.initialAssets[person].taxable} onChange={(v) => updateInitialAssets(person, 'taxable', v)} className="w-32" />
                  </div>
                  <div className="border-t border-border pt-2">
                    <span className="text-xs text-muted-foreground">合計: </span>
                    <ComputedBold className="text-sm">{yen(config.initialAssets[person].cash + config.initialAssets[person].nisa + config.initialAssets[person].taxable)}</ComputedBold>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
