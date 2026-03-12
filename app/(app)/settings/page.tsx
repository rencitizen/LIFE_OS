'use client'

import { useState } from 'react'
import { Copy, Check, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/lib/hooks/use-auth'

export default function SettingsPage() {
  const { user, couple, partner, signOut } = useAuth()
  const [copied, setCopied] = useState(false)

  const copyInviteCode = () => {
    if (couple?.invite_code) {
      navigator.clipboard.writeText(couple.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">設定</h1>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">プロフィール</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user?.avatar_url || undefined} />
              <AvatarFallback
                className="text-lg"
                style={{
                  backgroundColor: (user?.color || '#4F46E5') + '20',
                  color: user?.color || '#4F46E5',
                }}
              >
                {user?.display_name?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{user?.display_name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>表示名</Label>
              <Input defaultValue={user?.display_name || ''} />
            </div>
            <div className="space-y-2">
              <Label>テーマカラー</Label>
              <Input type="color" defaultValue={user?.color || '#4F46E5'} className="h-10" />
            </div>
          </div>
          <Button>保存</Button>
        </CardContent>
      </Card>

      {/* Pair Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ペア設定</CardTitle>
          <CardDescription>パートナーとの接続を管理</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {couple ? (
            <>
              <div className="space-y-2">
                <Label>カップル名</Label>
                <Input defaultValue={couple.name || ''} placeholder="田中家" />
              </div>
              <div className="space-y-2">
                <Label>招待コード</Label>
                <div className="flex gap-2">
                  <Input value={couple.invite_code} readOnly className="font-mono" />
                  <Button variant="outline" size="icon" onClick={copyInviteCode}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  このコードをパートナーに送ってペアリングしてください
                </p>
              </div>
              {partner ? (
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={partner.avatar_url || undefined} />
                    <AvatarFallback
                      style={{
                        backgroundColor: partner.color + '20',
                        color: partner.color,
                      }}
                    >
                      {partner.display_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{partner.display_name}</p>
                    <p className="text-xs text-muted-foreground">パートナー</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-md border border-dashed">
                  <UserPlus className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">パートナー未参加</p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                カップルを作成するか、招待コードで参加してください
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button>カップル作成</Button>
                <Button variant="outline">コードで参加</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">一般設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>通貨</Label>
              <Input defaultValue={couple?.currency || 'JPY'} />
            </div>
            <div className="space-y-2">
              <Label>タイムゾーン</Label>
              <Input defaultValue={couple?.timezone || 'Asia/Tokyo'} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-base text-destructive">ログアウト</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={signOut}>
            ログアウト
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
