'use client'

import Link from 'next/link'
import { addMonths, format } from 'date-fns'
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatYen } from '@/lib/finance/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useCompleteMonthlySettlement, useMonthlySettlementPreview } from '@/lib/hooks/use-settlements'
import { useFinanceStore } from '@/stores/finance-store'

export default function SettlementsPage() {
  const { user, partner } = useAuth()
  const { selectedMonth, setSelectedMonth } = useFinanceStore()
  const { data: preview, isLoading, isError } = useMonthlySettlementPreview(user?.id, selectedMonth)
  const completeSettlement = useCompleteMonthlySettlement()

  const displayDate = new Date(`${selectedMonth}-01T00:00:00`)

  const navigateMonth = (direction: number) => {
    setSelectedMonth(format(addMonths(displayDate, direction), 'yyyy-MM'))
  }

  const memberName = (userId: string | null) => {
    if (!userId) return '—'
    if (userId === user?.id) return user.display_name
    if (userId === partner?.id) return partner.display_name
    return 'メンバー'
  }

  const handleComplete = async () => {
    if (!user?.id || !preview || preview.expense_count === 0) return

    try {
      const result = await completeSettlement.mutateAsync({
        userId: user.id,
        yearMonth: selectedMonth,
      })

      if (result.amount > 0) {
        toast.success(`${memberName(result.from_user)} → ${memberName(result.to_user)} ${formatYen(result.amount)} を精算済みにしました`)
      } else {
        toast.success('送金不要として今月の対象支出を精算済みにしました')
      }
    } catch (error) {
      console.error(error)
      toast.error('精算処理に失敗しました')
    }
  }

  const hasTargets = (preview?.expense_count || 0) > 0
  const transferRequired = hasTargets && (preview?.amount || 0) > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">月次精算</h1>
          <p className="text-sm text-muted-foreground">
            精算対象として登録された支出を、支払額と負担額の差額でネットします。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[120px] text-center text-sm font-medium">{format(displayDate, 'yyyy年M月')}</span>
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            精算データを取得できませんでした。
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">対象支出</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{isLoading ? '—' : formatYen(preview?.gross_amount || 0)}</p>
                <p className="mt-1 text-xs text-muted-foreground">未精算の対象支出合計</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">対象件数</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{isLoading ? '—' : `${preview?.expense_count || 0}件`}</p>
                <p className="mt-1 text-xs text-muted-foreground">splitが作成された支出のみ</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">精算額</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{isLoading ? '—' : formatYen(preview?.amount || 0)}</p>
                <p className="mt-1 text-xs text-muted-foreground">相互の負担を差し引いた最終送金額</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">今月の精算</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  精算額を計算しています
                </div>
              ) : !hasTargets ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    未精算の対象支出はありません
                  </div>
                  <p className="text-xs text-muted-foreground">
                    過去の一括取込データなど、負担額のsplitを持たない支出は自動精算には含めません。
                  </p>
                </div>
              ) : transferRequired ? (
                <div className="space-y-4">
                  <div className="rounded-xl border bg-muted/20 p-5 text-center">
                    <p className="text-sm text-muted-foreground">送金方向</p>
                    <p className="mt-2 text-xl font-semibold">
                      {memberName(preview?.from_user || null)} → {memberName(preview?.to_user || null)}
                    </p>
                    <p className="mt-1 text-3xl font-bold">{formatYen(preview?.amount || 0)}</p>
                  </div>
                  <Button className="w-full" onClick={handleComplete} disabled={completeSettlement.isPending}>
                    {completeSettlement.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    精算完了にする
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border bg-muted/20 p-5 text-center">
                    <p className="text-sm text-muted-foreground">ネット後の精算額</p>
                    <p className="mt-2 text-2xl font-semibold">送金不要</p>
                    <p className="mt-1 text-sm text-muted-foreground">支払額と負担額が相殺されています。</p>
                  </div>
                  <Button className="w-full" onClick={handleComplete} disabled={completeSettlement.isPending}>
                    {completeSettlement.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    今月分を精算済みにする
                  </Button>
                </div>
              )}

              <div className="border-t pt-4">
                <Link href="/finance/expenses">
                  <Button variant="outline" size="sm">収入・支出を確認</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
