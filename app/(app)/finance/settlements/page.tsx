'use client'

import Link from 'next/link'
import { addMonths, format } from 'date-fns'
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { formatYen } from '@/lib/finance/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useCompleteMonthlySettlement, useMonthlySettlementPreview, useSettlements } from '@/lib/hooks/use-settlements'
import { useFinanceStore } from '@/stores/finance-store'

export default function SettlementsPage() {
  const { user, partner, couple } = useAuth()
  const { selectedMonth, setSelectedMonth } = useFinanceStore()
  const { data: preview, isLoading, isError } = useMonthlySettlementPreview(user?.id, selectedMonth)
  const { data: settlements } = useSettlements(couple?.id)
  const completeSettlement = useCompleteMonthlySettlement()

  const displayDate = new Date(`${selectedMonth}-01T00:00:00`)
  const navigateMonth = (direction: number) => setSelectedMonth(format(addMonths(displayDate, direction), 'yyyy-MM'))

  const memberName = (userId: string | null) => {
    if (!userId) return '—'
    if (userId === user?.id) return user.display_name
    if (userId === partner?.id) return partner.display_name
    return 'メンバー'
  }

  const handleComplete = async () => {
    if (!user?.id || !preview || preview.expense_count === 0) return
    try {
      const result = await completeSettlement.mutateAsync({ userId: user.id, yearMonth: selectedMonth })
      if (result.amount > 0) toast.success(`${memberName(result.from_user)} → ${memberName(result.to_user)} ${formatYen(result.amount)} を精算済みにしました`)
      else toast.success('送金不要として今月の対象支出を精算済みにしました')
    } catch (error) {
      console.error(error)
      toast.error('精算処理に失敗しました')
    }
  }

  const hasTargets = (preview?.expense_count || 0) > 0
  const transferRequired = hasTargets && (preview?.amount || 0) > 0

  return (
    <div className="mx-auto max-w-3xl space-y-9 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">精算</h1>
          <p className="mt-1 text-sm text-muted-foreground">二人の負担差額だけを確認します。</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[100px] text-center text-sm font-medium">{format(displayDate, 'yyyy年M月')}</span>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {isError ? (
        <p className="border-y py-6 text-sm text-destructive">精算データを取得できませんでした。</p>
      ) : (
        <section className="rounded-[22px] border bg-card px-5 py-6 md:px-7 md:py-7">
          {isLoading ? (
            <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 計算中
            </div>
          ) : !hasTargets ? (
            <div className="py-7 text-center">
              <CheckCircle2 className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 text-lg font-semibold">今月の精算はありません</p>
              <p className="mt-1 text-sm text-muted-foreground">未精算の対象支出は0件です。</p>
            </div>
          ) : (
            <>
              <div className="text-center">
                <p className="text-xs font-medium text-muted-foreground">今月の精算額</p>
                <p className="mt-2 text-[38px] font-semibold tracking-[-0.045em] tabular-nums">
                  {formatYen(preview?.amount || 0)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {transferRequired
                    ? `${memberName(preview?.from_user || null)} → ${memberName(preview?.to_user || null)}`
                    : '送金不要'}
                </p>
              </div>

              <div className="mt-7 grid grid-cols-2 divide-x border-y py-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">対象支出</p>
                  <p className="mt-1 text-base font-semibold tabular-nums">{formatYen(preview?.gross_amount || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">対象件数</p>
                  <p className="mt-1 text-base font-semibold tabular-nums">{preview?.expense_count || 0}件</p>
                </div>
              </div>

              <Button className="mt-5 w-full rounded-xl" onClick={handleComplete} disabled={completeSettlement.isPending}>
                {completeSettlement.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {transferRequired ? '精算完了にする' : '今月分を精算済みにする'}
              </Button>
            </>
          )}
        </section>
      )}

      <section>
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-base font-semibold">履歴</h2>
          <Link href="/finance/expenses" className="text-xs font-medium text-muted-foreground hover:text-foreground">明細を見る</Link>
        </div>
        {(settlements || []).length === 0 ? (
          <p className="py-8 text-sm text-muted-foreground">まだ精算履歴はありません。</p>
        ) : (
          <div className="divide-y">
            {(settlements || []).slice(0, 12).map((settlement) => (
              <div key={settlement.id} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {settlement.settlement_month ? format(new Date(`${settlement.settlement_month}T00:00:00`), 'yyyy年M月') : '月次精算'}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {memberName(settlement.from_user)} → {memberName(settlement.to_user)} · {settlement.status === 'done' ? '完了' : '未完了'}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums">{formatYen(Number(settlement.amount))}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
