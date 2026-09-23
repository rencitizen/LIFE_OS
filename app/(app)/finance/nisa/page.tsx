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

function FrameBreakdown({
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
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-[10px] text-muted-foreground">{basis}</span>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[10px] text-muted-foreground">残り</div>
          <div className="text-base font-bold tabular-nums">{yen(remaining)}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground">利用済み</div>
          <div className="text-sm font-medium tabular-nums">{yen(used)}</div>
        </div>
      </div>
      <div className="mt-2">
        <ProgressBar value={used} limit={limit} />
      </div>
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
  const currentMonthlyInvestment = monthlyTsumitate + monthlyGrowth
  const plannedTsumitate = monthlyTsumitate * 12
  const plannedGrowth = monthlyGrowth * 12

  const actualTsumitate = numeric(row?.tsumitate_used)
  const actualGrowth = numeric(row?.growth_used)
  const basisTsumitate = actualTsumitate === null ? '設定ベース' : '実績'
  const basisGrowth = actualGrowth === null ? '設定ベース' : '実績'
  const usedTsumitate = actualTsumitate ?? plannedTsumitate
  const usedGrowth = actualGrowth ?? plannedGrowth
  const usedAnnual = usedTsumitate + usedGrowth
  const annualRemaining = clampRemaining(TOTAL_ANNUAL_LIMIT, usedAnnual)
  const annualBasis =
    actualTsumitate !== null && actualGrowth !== null
      ? '実績ベース'
      : actualTsumitate === null && actualGrowth === null
        ? '設定ベース'
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
    <Card className="overflow-hidden border-border">
      <CardHeader className="border-b border-border bg-muted/20 pb-3">
        <CardTitle className="text-base">{member.display_name}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="text-xs font-medium text-muted-foreground">現在の積立額</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{yen(currentMonthlyInvestment)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">毎月</div>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-medium text-muted-foreground">{year}年 残りNISA枠</div>
              <div className="text-[10px] text-muted-foreground">{annualBasis}</div>
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{yen(annualRemaining)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              利用済み {yen(usedAnnual)} / {yen(TOTAL_ANNUAL_LIMIT)}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">枠の内訳</div>
          <div className="grid gap-3 md:grid-cols-2">
            <FrameBreakdown
              label="つみたて投資枠"
              used={usedTsumitate}
              limit={TSUMITATE_ANNUAL_LIMIT}
              basis={basisTsumitate}
            />
            <FrameBreakdown
              label="成長投資枠"
              used={usedGrowth}
              limit={GROWTH_ANNUAL_LIMIT}
              basis={basisGrowth}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-muted-foreground">生涯NISA枠</div>
            <div className="text-[10px] text-muted-foreground">上限 {yen(LIFETIME_LIMIT)}</div>
          </div>

          {lifetimeUsed === null ? (
            <div className="mt-3">
              <div className="text-2xl font-bold">未登録</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                「実績を編集」から生涯枠の利用済み額を登録すると、1,800万円のうち何円埋まっているか表示します。
              </div>
            </div>
          ) : (
            <>
              <div className="mt-3 flex items-end justify-between gap-4">
                <div>
                  <div className="text-[10px] text-muted-foreground">利用済み</div>
                  <div className="text-2xl font-bold tabular-nums">{yen(lifetimeUsed)}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {((lifetimeUsed / LIFETIME_LIMIT) * 100).toFixed(1)}% 消化
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground">残り</div>
                  <div className="text-lg font-bold tabular-nums">{yen(lifetimeRemaining ?? 0)}</div>
                </div>
              </div>
              <div className="mt-3">
                <ProgressBar value={lifetimeUsed} limit={LIFETIME_LIMIT} />
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground tabular-nums">
                {yen(lifetimeUsed)} / {yen(LIFETIME_LIMIT)}
              </div>
            </>
          )}
        </div>

        <details className="rounded-xl border border-border bg-background">
          <summary className="cursor-pointer px-3 py-2.5 text-xs font-medium text-muted-foreground">
            実績を編集
          </summary>
          <div className="border-t border-border p-3">
            <p className="mb-3 text-[11px] text-muted-foreground">
              評価額ではなく、NISAで実際に買い付けた取得価額を入力します。
            </p>
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
        </details>
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

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <WalletCards className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold text-[var(--color-heading)]">NISA</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          まず「毎月の積立額」と「今年の残り枠」を確認。詳細な枠内訳と生涯枠はその下に表示します。
        </p>
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
