'use client'

import { useMemo, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts'
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, ArrowUpDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/lib/hooks/use-auth'
import { usePlanVsActual } from '@/lib/hooks/use-plan-vs-actual'

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`
const yenK = (n: number) => `${Math.round(n / 10000)}万`

/** Custom tooltip for charts */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-card p-3 shadow-md">
      <p className="text-sm font-medium mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {yen(entry.value)}
        </p>
      ))}
    </div>
  )
}

/** Deviation indicator badge */
function DeviationBadge({ value, inverse = false }: { value: number; inverse?: boolean }) {
  // For expenses, positive deviation = bad (overspent). For income, positive = good.
  const isGood = inverse ? value > 0 : value < 0
  const abs = Math.abs(value)
  if (abs < 1000) return <span className="text-xs text-muted-foreground">±0</span>
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${isGood ? 'text-primary' : 'text-destructive'}`}>
      {isGood ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
      {value > 0 ? '+' : ''}{yen(value)}
    </span>
  )
}

export default function AnalysisPage() {
  const { couple } = useAuth()
  const { currentYear, allYears, simulation, isLoading } = usePlanVsActual(couple?.id)
  const [chartTab, setChartTab] = useState('monthly')

  const currentMonth = new Date().getMonth() // 0-indexed

  // Data for the monthly bar chart (current year)
  const monthlyData = useMemo(() => {
    if (!currentYear) return []
    return currentYear.months.slice(0, currentMonth + 1).map((m) => ({
      name: m.label,
      計画支出: m.plannedExpense,
      実績支出: m.actualExpense,
      計画収入: m.plannedIncome,
      実績収入: m.actualIncome,
    }))
  }, [currentYear, currentMonth])

  // Data for cumulative line chart
  const cumulativeData = useMemo(() => {
    if (!currentYear) return []
    return currentYear.months.slice(0, currentMonth + 1).map((m) => ({
      name: m.label,
      計画貯蓄: m.cumulativePlannedSavings,
      実績貯蓄: m.cumulativeActualSavings,
      計画支出: m.cumulativePlannedExpense,
      実績支出: m.cumulativeActualExpense,
    }))
  }, [currentYear, currentMonth])

  // Data for multi-year asset projection chart
  const assetProjectionData = useMemo(() => {
    if (!allYears.length) return []
    return allYears.map((y) => ({
      name: `${y.year}`,
      キャッシュ: y.plannedCash,
      NISA: y.plannedNisa,
      課税資産: y.plannedTaxable,
      総資産: y.plannedTotalAssets,
    }))
  }, [allYears])

  // Summary stats
  const stats = useMemo(() => {
    if (!currentYear) return null
    const monthsElapsed = currentMonth + 1
    const completedMonths = currentYear.months.slice(0, monthsElapsed)
    const totalPlannedExp = completedMonths.reduce((s, m) => s + m.plannedExpense, 0)
    const totalActualExp = completedMonths.reduce((s, m) => s + m.actualExpense, 0)
    const totalPlannedInc = completedMonths.reduce((s, m) => s + m.plannedIncome, 0)
    const totalActualInc = completedMonths.reduce((s, m) => s + m.actualIncome, 0)
    const expenseDeviation = totalActualExp - totalPlannedExp
    const incomeDeviation = totalActualInc - totalPlannedInc
    const savingsDeviation = incomeDeviation - expenseDeviation
    const expensePct = totalPlannedExp > 0 ? ((totalActualExp / totalPlannedExp) * 100) : 0
    const incomePct = totalPlannedInc > 0 ? ((totalActualInc / totalPlannedInc) * 100) : 0

    return {
      monthsElapsed,
      totalPlannedExp,
      totalActualExp,
      totalPlannedInc,
      totalActualInc,
      expenseDeviation,
      incomeDeviation,
      savingsDeviation,
      expensePct,
      incomePct,
      plannedAnnualExpense: currentYear.plannedAnnualExpense,
      plannedEventCost: currentYear.plannedEventCost,
      plannedTotalAssets: currentYear.plannedTotalAssets,
    }
  }, [currentYear, currentMonth])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (!currentYear || !stats) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">計画 vs 実績</h1>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">ライフプランを先に設定してください</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{currentYear.year}年 計画 vs 実績</h1>
          <p className="text-sm text-muted-foreground">
            ライフプランの予測と実際の家計データを比較（{stats.monthsElapsed}ヶ月経過）
          </p>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Expense deviation */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">支出乖離（YTD）</CardTitle>
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <DeviationBadge value={stats.expenseDeviation} />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>計画: {yen(stats.totalPlannedExp)}</span>
              <span>実績: {yen(stats.totalActualExp)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${stats.expensePct > 100 ? 'bg-destructive' : 'bg-primary'}`}
                style={{ width: `${Math.min(150, stats.expensePct)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{stats.expensePct.toFixed(0)}% of plan</p>
          </CardContent>
        </Card>

        {/* Income deviation */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">収入乖離（YTD）</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <DeviationBadge value={stats.incomeDeviation} inverse />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>計画: {yen(stats.totalPlannedInc)}</span>
              <span>実績: {yen(stats.totalActualInc)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(150, stats.incomePct)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{stats.incomePct.toFixed(0)}% of plan</p>
          </CardContent>
        </Card>

        {/* Savings deviation */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">貯蓄乖離（YTD）</CardTitle>
            {stats.savingsDeviation >= 0
              ? <CheckCircle2 className="h-4 w-4 text-primary" />
              : <AlertTriangle className="h-4 w-4 text-destructive" />
            }
          </CardHeader>
          <CardContent>
            <DeviationBadge value={stats.savingsDeviation} inverse />
            <p className="text-xs text-muted-foreground mt-2">
              計画: {yen(stats.totalPlannedInc - stats.totalPlannedExp)}
            </p>
            <p className="text-xs text-muted-foreground">
              実績: {yen(stats.totalActualInc - stats.totalActualExp)}
            </p>
          </CardContent>
        </Card>

        {/* Year-end target */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">年末目標資産</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#133929]">{yenK(stats.plannedTotalAssets)}円</p>
            <p className="text-xs text-muted-foreground mt-2">
              年間生活費: {yen(stats.plannedAnnualExpense)}
            </p>
            {stats.plannedEventCost > 0 && (
              <p className="text-xs text-muted-foreground">
                イベント費: {yen(stats.plannedEventCost)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Charts ── */}
      <Tabs value={chartTab} onValueChange={setChartTab}>
        <TabsList>
          <TabsTrigger value="monthly">月次比較</TabsTrigger>
          <TabsTrigger value="cumulative">累積推移</TabsTrigger>
          <TabsTrigger value="assets">資産予測</TabsTrigger>
        </TabsList>

        {/* Monthly Bar Chart */}
        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">月次 計画 vs 実績（支出）</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={monthlyData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `${Math.round(v / 10000)}万`} tick={{ fontSize: 12 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                    <Bar dataKey="計画支出" fill="#D9D9D9" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="実績支出" fill="#1E5945" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">データなし</p>
              )}
            </CardContent>
          </Card>

          {/* Income bar chart */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">月次 計画 vs 実績（収入）</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `${Math.round(v / 10000)}万`} tick={{ fontSize: 12 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                    <Bar dataKey="計画収入" fill="#D9D9D9" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="実績収入" fill="#85B59B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">データなし</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cumulative Line Chart */}
        <TabsContent value="cumulative">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">累積貯蓄推移 — 計画 vs 実績</CardTitle>
            </CardHeader>
            <CardContent>
              {cumulativeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={cumulativeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `${Math.round(v / 10000)}万`} tick={{ fontSize: 12 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                    <ReferenceLine y={0} stroke="#D9D9D9" />
                    <Area
                      type="monotone"
                      dataKey="計画貯蓄"
                      stroke="#D9D9D9"
                      fill="#D9D9D9"
                      fillOpacity={0.3}
                      strokeDasharray="5 5"
                    />
                    <Area
                      type="monotone"
                      dataKey="実績貯蓄"
                      stroke="#1E5945"
                      fill="#85B59B"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">データなし</p>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">累積支出推移</CardTitle>
            </CardHeader>
            <CardContent>
              {cumulativeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={cumulativeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `${Math.round(v / 10000)}万`} tick={{ fontSize: 12 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="計画支出" stroke="#D9D9D9" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="実績支出" stroke="#1E5945" strokeWidth={2} dot={{ r: 3, fill: '#1E5945' }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">データなし</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Multi-year Asset Projection */}
        <TabsContent value="assets">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">資産推移予測（ライフプランより）</CardTitle>
            </CardHeader>
            <CardContent>
              {assetProjectionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={assetProjectionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `${Math.round(v / 10000)}万`} tick={{ fontSize: 12 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                    <Bar dataKey="キャッシュ" stackId="a" fill="#85B59B" />
                    <Bar dataKey="NISA" stackId="a" fill="#1E5945" />
                    <Bar dataKey="課税資産" stackId="a" fill="#133929" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">データなし</p>
              )}
            </CardContent>
          </Card>

          {/* Year-by-year summary table */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">年度別サマリー</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#1E5945] text-white">
                      <th className="p-2 text-left">年度</th>
                      <th className="p-2 text-right">世帯手取り</th>
                      <th className="p-2 text-right">生活費</th>
                      <th className="p-2 text-right">イベント</th>
                      <th className="p-2 text-right">年末総資産</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allYears.map((y, i) => (
                      <tr key={y.year} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F7F7F7]'}>
                        <td className="p-2 font-medium text-[#133929]">{y.year}</td>
                        <td className="p-2 text-right tabular-nums">{yen(y.plannedAnnualIncome)}</td>
                        <td className="p-2 text-right tabular-nums">{yen(y.plannedAnnualExpense)}</td>
                        <td className="p-2 text-right tabular-nums">{y.plannedEventCost > 0 ? yen(y.plannedEventCost) : '-'}</td>
                        <td className="p-2 text-right tabular-nums font-bold text-[#133929]">{yen(y.plannedTotalAssets)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Monthly Deviation Table ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">月別乖離テーブル</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1E5945] text-white">
                  <th className="p-2 text-left">月</th>
                  <th className="p-2 text-right">計画支出</th>
                  <th className="p-2 text-right">実績支出</th>
                  <th className="p-2 text-right">乖離</th>
                  <th className="p-2 text-right">計画収入</th>
                  <th className="p-2 text-right">実績収入</th>
                  <th className="p-2 text-right">乖離</th>
                </tr>
              </thead>
              <tbody>
                {currentYear.months.slice(0, currentMonth + 1).map((m, i) => (
                  <tr key={m.month} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F7F7F7]'}>
                    <td className="p-2 font-medium text-[#133929]">{m.label}</td>
                    <td className="p-2 text-right tabular-nums text-muted-foreground">{yen(m.plannedExpense)}</td>
                    <td className="p-2 text-right tabular-nums">{yen(m.actualExpense)}</td>
                    <td className="p-2 text-right">
                      <DeviationBadge value={m.expenseDeviation} />
                    </td>
                    <td className="p-2 text-right tabular-nums text-muted-foreground">{yen(m.plannedIncome)}</td>
                    <td className="p-2 text-right tabular-nums">{yen(m.actualIncome)}</td>
                    <td className="p-2 text-right">
                      <DeviationBadge value={m.incomeDeviation} inverse />
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="border-t-2 border-[#1E5945] font-bold">
                  <td className="p-2 text-[#133929]">合計</td>
                  <td className="p-2 text-right tabular-nums text-muted-foreground">{yen(stats.totalPlannedExp)}</td>
                  <td className="p-2 text-right tabular-nums">{yen(stats.totalActualExp)}</td>
                  <td className="p-2 text-right">
                    <DeviationBadge value={stats.expenseDeviation} />
                  </td>
                  <td className="p-2 text-right tabular-nums text-muted-foreground">{yen(stats.totalPlannedInc)}</td>
                  <td className="p-2 text-right tabular-nums">{yen(stats.totalActualInc)}</td>
                  <td className="p-2 text-right">
                    <DeviationBadge value={stats.incomeDeviation} inverse />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
