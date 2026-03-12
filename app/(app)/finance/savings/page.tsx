'use client'

import { PiggyBank } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function SavingsPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">目的別積立</h2>
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <PiggyBank className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Phase 2で実装予定</p>
          <p className="text-sm text-muted-foreground mt-1">
            旅行・結婚・引越しなどの目標に向けた積立管理ができるようになります
          </p>
          <Badge variant="outline" className="mt-4">Coming Soon</Badge>
        </CardContent>
      </Card>
    </div>
  )
}
