'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, WalletCards } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/use-auth'
import type { User } from '@/types'

const TSUMITATE_ANNUAL_LIMIT = 1_200_000
const GROWTH_ANNUAL_LIMIT = 2_400_000
const TOTAL_ANNUAL_LIMIT = TSUMITATE_ANNUAL_LIMIT + GROWTH_ANNUAL_LIMIT
const LIFETIME_LIMIT = 18_000_000

type NisaStatusRow = {
  id: string
  couple_id: string
  user_id: string
  year: number
  tsumitate_used: number | null
  growth_used: number | null
  lifetime_used: number | null
  monthly_tsumitate: number
  monthly_growth: number
  memo: string | null
  created_at: string
  updated_at: string
}

const yen = (value: number) => `¥${Math.round(value).toLocaleString()}`

function numeric(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function clampRemaining(limit: number, used: number) {
  return Math.max(0, limit - used)
}

function ProgressBar({ value, limit }: { value: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.max(0, (value / limit) * 100)) : 0
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

function UsageMetric({
  label,
  used,
  limit,
  basis,
}: {
  label: string
  used: number
  limit: number
  basis: string
}) {
  const remaining = clampRemaining(limit, used)
  return (
    <div className="space-y-2 rounded-xl border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground">{basis}</span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-lg font-bold tabular-nums">{yen(remaining)}</div>
          <div className="text-[11px] text-muted-foreground">残り</div>
        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          <div>{yen(used)} / {yen(limit)}</div>
          <div>利用 / 上限</div>
        </div>
      </div>
      <ProgressBar value={used} limit={limit} />
    </div>
  )
}

function MemberNisaCard({
  member,
  row,
  coupleId,
  year,
}: {
  member: User
  row?: NisaStatusRow
  coupleId: string
  year: number
}) {
  const queryClient = useQueryClient()
  const supabase = createClient()

  const monthlyTsumitate = Number(row?.monthly_tsumitate ?? 0)
  const monthlyGrowth = Number(row?.monthly_growth ?? 0)
  const plannedTsumitate = monthlyTsumitate * 12
  const plannedGrowth = monthlyGrowth * 12

  const actualTsumitate = numeric(row?.tsumitate_used)
  const actualGrowth = numeric(row?.growth_used)
  const basisTsumitate = actualTsumitate === null ? '設定ベース（年換算）' : '実績ベース'
  const basisGrowth = actualGrowth === null ? '設定ベース（年換算）' : '実績ベース'
  const usedTsumitate = actualTsumitate ?? plannedTsumitate
  const usedGrowth = actualGrowth ?? plannedGrowth
  const usedAnnual = usedTsumitate + usedGrowth
  const annualBasis =
    actualTsumitate !== null && actualGrowth !== null
      ? '実績ベース'
      : actualTsumitate === null && actualGrowth === null
        ? '設定ベース（年換算）'
        : '実績＋設定ベース'

  const [tsumitateInput, setTsumitateInput] = useState('')
  const [growthInput, setGrowthInput] = useState('')
  const [lifetimeInput, setLifetimeInput] = useState('')

  useEffect(() => {
    setTsumitateInput(row?.tsumitate_used === null || row?.tsumitate_used === undefined ? '' : String(row.tsumitate_used))
    setGrowthInput(row?.growth_used === null || row?.growth_used === undefined ? '' : String(row.growth_used))
    setLifetimeInput(row?.lifetime_used === null || row?.lifetime_used === undefined ? '' : String(row.lifetime_used))
  }, [row?.growth_used, row?.lifetime_used, row?.tsumitate_used])

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        couple_id: coupleId,
        user_id: member.id,
        year,
        tsumitate_used: numeric(tsumitateInput),
        growth_used: numeric(growthInput),
        lifetime_used: numeric(lifetimeInput),
        monthly_tsumitate: monthlyTsumitate,
        monthly_growth: monthlyGrowth,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase
        .from('nisa_statuses')
        .upsert(payload, { onConflict: 'user_id,year' })
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['nisa-statuses', coupleId, year] })
      toast.success(`${member.display_name}のNISA実績を保存しました`)
    },
    onError: () => toast.error('NISA実績の保存に失敗しました'),
  })

  const lifetimeUsed = numeric(row?.lifetime_used)
  const lifetimeRemaining = lifetimeUsed === null ? null : clampRemaining(LIFETIME_LIMIT, lifetimeUsed)

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">{member.display_name}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              現在の積立設定 {yen(monthlyTsumitate)}/月
              {monthlyGrowth > 0 ? ` + 成長枠 ${yen(monthlyGrowth)}/月` : ''}
            </p>
          </div>
          <div className="rounded-full bg-muted px-3 py-1 text-xs font-medium tabular-nums">
            年換算 {yen(plannedTsumitate + plannedGrowth)}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <UsageMetric
            label="年間NISA枠"
            used={usedAnnual}
            limit={TOTAL_ANNUAL_LIMIT}
            basis={annualBasis}
          />
          <UsageMetric
            label="つみたて投資枠"
            used={usedTsumitate}
            limit={TSUMITATE_ANNUAL_LIMIT}
            basis={basisTsumitate}
          />
          <UsageMetric
            label="成長投資枠"
            used={usedGrowth}
            limit={GROWTH_ANNUAL_LIMIT}
            basis={basisGrowth}
          />
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground">生涯非課税保有限度額</div>
              <div className="mt-1 text-lg font-bold tabular-nums">
                {lifetimeRemaining === null ? '未登録' : yen(lifetimeRemaining)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {lifetimeUsed === null ? '取得価額ベースの利用済み額を入力すると残りを計算' : `${yen(lifetimeUsed)} / ${yen(LIFETIME_LIMIT)}`}
              </div>
            </div>
            {lifetimeUsed !== null ? (
              <div className="w-32">
                <ProgressBar value={lifetimeUsed} limit={LIFETIME_LIMIT} />
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <div className="mb-3">
            <div className="text-sm font-semibold">{year}年の実績を入力</div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              評価額ではなく、NISAで実際に買い付けた取得価額を入力。空欄なら現在の月額設定を年換算して表示します。
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">つみたて投資枠 利用済み</Label>
              <Input
                inputMode="numeric"
                type="number"
                min={0}
                max={TSUMITATE_ANNUAL_LIMIT}
                placeholder="未登録"
                value={tsumitateInput}
                onChange={(e) => setTsumitateInput(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">成長投資枠 利用済み</Label>
              <Input
                inputMode="numeric"
                type="number"
                min={0}
                max={GROWTH_ANNUAL_LIMIT}
                placeholder="未登録"
                value={growthInput}
                onChange={(e) => setGrowthInput(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">生涯枠 利用済み</Label>
              <Input
                inputMode="numeric"
                type="number"
                min={0}
                max={LIFETIME_LIMIT}
                placeholder="未登録"
                value={lifetimeInput}
                onChange={(e) => setLifetimeInput(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending} size="sm">
              <Save className="mr-1.5 h-4 w-4" />
              保存
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function NisaPage() {
  const { user, partner, couple, isLoading: isAuthLoading } = useAuth()
  const supabase = createClient()
  const year = new Date().getFullYear()

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['nisa-statuses', couple?.id, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nisa_statuses')
        .select('*')
        .eq('couple_id', couple!.id)
        .eq('year', year)
      if (error) throw error
      return (data || []) as NisaStatusRow[]
    },
    enabled: !!couple?.id,
  })

  const rowByUser = useMemo(
    () => new Map(rows.map((row) => [row.user_id, row])),
    [rows]
  )

  const members = [user, partner].filter((member): member is User => !!member)

  if (isAuthLoading || isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">読み込み中...</div>
  }

  if (!couple?.id || members.length === 0) {
    return <div className="p-8 text-center text-sm text-muted-foreground">NISA情報を表示できません。</div>
  }

  const householdPlannedAnnual = members.reduce((sum, member) => {
    const row = rowByUser.get(member.id)
    return sum + Number(row?.monthly_tsumitate ?? 0) * 12 + Number(row?.monthly_growth ?? 0) * 12
  }, 0)
  const householdAnnualLimit = TOTAL_ANNUAL_LIMIT * members.length
  const householdPlannedRemaining = clampRemaining(householdAnnualLimit, householdPlannedAnnual)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <WalletCards className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-[var(--color-heading)]">NISA枠</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            年間枠・つみたて投資枠・成長投資枠・生涯枠の残りを、2人分まとめて確認できます。
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background px-4 py-2 text-right">
          <div className="text-[11px] text-muted-foreground">世帯の年間枠残り（設定ベース）</div>
          <div className="text-lg font-bold tabular-nums">{yen(householdPlannedRemaining)}</div>
          <div className="text-[10px] text-muted-foreground">{yen(householdPlannedAnnual)} / {yen(householdAnnualLimit)}</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        現行の成人NISAは、1人あたり年間360万円（つみたて投資枠120万円＋成長投資枠240万円）、
        非課税保有限度額は合計1,800万円です。実績未登録の項目は現在の積立設定を12ヶ月換算して表示します。
      </div>

      <div className="space-y-4">
        {members.map((member) => (
          <MemberNisaCard
            key={member.id}
            member={member}
            row={rowByUser.get(member.id)}
            coupleId={couple.id}
            year={year}
          />
        ))}
      </div>
    </div>
  )
}
