'use client'

import { format } from 'date-fns'
import { ArrowRight, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/hooks/use-auth'
import { useSettlements, useUnsettledBalance, useUpdateSettlement } from '@/lib/hooks/use-settlements'

const statusLabels: Record<string, string> = {
  requested: 'リクエスト中',
  confirmed: '確認済み',
  done: '完了',
}

const statusColors: Record<string, string> = {
  requested: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
}

export default function SettlementsPage() {
  const { user, couple, partner } = useAuth()
  const { data: settlements } = useSettlements(couple?.id)
  const { data: balance } = useUnsettledBalance(couple?.id, user?.id)
  const updateSettlement = useUpdateSettlement()

  const handleConfirm = async (id: string) => {
    await updateSettlement.mutateAsync({
      id,
      status: 'confirmed',
    })
  }

  const handleComplete = async (id: string) => {
    await updateSettlement.mutateAsync({
      id,
      status: 'done',
      settled_at: format(new Date(), 'yyyy-MM-dd'),
    })
  }

  return (
    <div className="space-y-6">
      {/* Balance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">精算バランス</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4 py-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{user?.display_name}</p>
            </div>
            <div className="flex flex-col items-center">
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <p className={`text-xl font-bold mt-1 ${(balance || 0) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                ¥{Math.abs(balance || 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                {(balance || 0) >= 0 ? '受け取り' : '支払い'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{partner?.display_name || 'パートナー'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settlement History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">精算履歴</CardTitle>
        </CardHeader>
        <CardContent>
          {settlements && settlements.length > 0 ? (
            <div className="space-y-3">
              {settlements.map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-md border">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {s.from_user === user?.id ? user?.display_name : partner?.display_name}
                      </span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="text-sm font-medium">
                        {s.to_user === user?.id ? user?.display_name : partner?.display_name}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(s.created_at), 'M/d')}
                      {s.memo && ` · ${s.memo}`}
                    </p>
                  </div>
                  <span className="font-bold">¥{Number(s.amount).toLocaleString()}</span>
                  <Badge className={statusColors[s.status]}>{statusLabels[s.status]}</Badge>
                  {s.status === 'requested' && s.to_user === user?.id && (
                    <Button size="sm" variant="outline" onClick={() => handleConfirm(s.id)}>
                      確認
                    </Button>
                  )}
                  {s.status === 'confirmed' && (
                    <Button size="sm" onClick={() => handleComplete(s.id)}>
                      完了
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">精算履歴はありません</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
