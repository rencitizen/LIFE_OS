'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SettlementsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">立替精算は現在使用していません</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            この機能は v3 では非表示化しています。支出は「共通」または「個人」で管理してください。
          </p>
          <Link href="/finance/expenses">
            <Button size="sm">収入・支出へ戻る</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
