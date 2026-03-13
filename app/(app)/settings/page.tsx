'use client'

import { useState } from 'react'
import { Copy, Check, UserPlus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/lib/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export default function SettingsPage() {
  const { user, couple, partner, signOut } = useAuth()
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Profile editing
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editingProfile, setEditingProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  // Couple creation
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [coupleName, setCoupleName] = useState('')
  const [creatingCouple, setCreatingCouple] = useState(false)

  // Join by code
  const [joinDialogOpen, setJoinDialogOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [joiningCouple, setJoiningCouple] = useState(false)

  // Copy invite code
  const [copied, setCopied] = useState(false)
  const copyInviteCode = () => {
    if (couple?.invite_code) {
      navigator.clipboard.writeText(couple.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Start editing profile
  const startEditProfile = () => {
    setEditName(user?.display_name ?? '')
    setEditColor(user?.color ?? '#85B59B')
    setEditingProfile(true)
  }

  // Save profile
  const handleSaveProfile = async () => {
    if (!user?.id) { toast.error('ログインが必要です'); return }
    if (!editName.trim()) { toast.error('表示名を入力してください'); return }
    setSavingProfile(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({ display_name: editName.trim(), color: editColor })
        .eq('id', user.id)
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['auth-profile'] })
      setEditingProfile(false)
      toast.success('プロフィールを更新しました')
    } catch {
      toast.error('プロフィールの更新に失敗しました')
    } finally {
      setSavingProfile(false)
    }
  }

  // Create couple
  const handleCreateCouple = async () => {
    if (!user?.id) { toast.error('ログインが必要です'); return }
    if (!coupleName.trim()) { toast.error('カップル名を入力してください'); return }
    setCreatingCouple(true)
    try {
      // Generate a random 8-char invite code
      const code = Math.random().toString(36).slice(2, 10).toUpperCase()
      const { data: newCouple, error: coupleErr } = await supabase
        .from('couples')
        .insert({ name: coupleName.trim(), invite_code: code })
        .select()
        .single()
      if (coupleErr) throw coupleErr

      // Link user to the new couple
      const { error: userErr } = await supabase
        .from('users')
        .update({ couple_id: newCouple.id })
        .eq('id', user.id)
      if (userErr) throw userErr

      await queryClient.invalidateQueries({ queryKey: ['auth-profile'] })
      await queryClient.invalidateQueries({ queryKey: ['auth-couple'] })
      setCreateDialogOpen(false)
      setCoupleName('')
      toast.success('カップルを作成しました')
    } catch {
      toast.error('カップルの作成に失敗しました')
    } finally {
      setCreatingCouple(false)
    }
  }

  // Join couple by invite code
  const handleJoinCouple = async () => {
    if (!user?.id) { toast.error('ログインが必要です'); return }
    if (!inviteCode.trim()) { toast.error('招待コードを入力してください'); return }
    setJoiningCouple(true)
    try {
      // Find couple by invite code
      const { data: foundCouple, error: findErr } = await supabase
        .from('couples')
        .select('id')
        .eq('invite_code', inviteCode.trim().toUpperCase())
        .single()
      if (findErr || !foundCouple) {
        toast.error('招待コードが見つかりません')
        return
      }

      // Link user to the couple
      const { error: userErr } = await supabase
        .from('users')
        .update({ couple_id: foundCouple.id })
        .eq('id', user.id)
      if (userErr) throw userErr

      await queryClient.invalidateQueries({ queryKey: ['auth-profile'] })
      await queryClient.invalidateQueries({ queryKey: ['auth-couple'] })
      await queryClient.invalidateQueries({ queryKey: ['auth-partner'] })
      setJoinDialogOpen(false)
      setInviteCode('')
      toast.success('カップルに参加しました')
    } catch {
      toast.error('参加に失敗しました')
    } finally {
      setJoiningCouple(false)
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
                  backgroundColor: (editingProfile ? editColor : user?.color || '#85B59B') + '20',
                  color: editingProfile ? editColor : user?.color || '#85B59B',
                }}
              >
                {(editingProfile ? editName : user?.display_name)?.[0] || '?'}
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
              {editingProfile ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="表示名"
                />
              ) : (
                <Input value={user?.display_name ?? ''} readOnly />
              )}
            </div>
            <div className="space-y-2">
              <Label>テーマカラー</Label>
              {editingProfile ? (
                <Input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="h-10"
                />
              ) : (
                <Input type="color" value={user?.color ?? '#85B59B'} readOnly className="h-10" />
              )}
            </div>
          </div>
          {editingProfile ? (
            <div className="flex gap-2">
              <Button onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                保存
              </Button>
              <Button variant="outline" onClick={() => setEditingProfile(false)}>
                キャンセル
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={startEditProfile}>
              編集
            </Button>
          )}
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
                <Input value={couple.name ?? ''} readOnly placeholder="田中家" />
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
                  <p className="text-sm text-muted-foreground">パートナー未参加 — 招待コードを共有してください</p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                カップルを作成するか、招待コードで参加してください
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button onClick={() => setCreateDialogOpen(true)}>カップル作成</Button>
                <Button variant="outline" onClick={() => setJoinDialogOpen(true)}>コードで参加</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Couple Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>カップルを作成</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>カップル名</Label>
              <Input
                placeholder="例: 田中家"
                value={coupleName}
                onChange={(e) => setCoupleName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCouple()}
              />
            </div>
            <Button onClick={handleCreateCouple} className="w-full" disabled={creatingCouple}>
              {creatingCouple && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              作成
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join Couple Dialog */}
      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>招待コードで参加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>招待コード</Label>
              <Input
                placeholder="例: A1B2C3D4"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinCouple()}
                className="font-mono uppercase"
              />
            </div>
            <Button onClick={handleJoinCouple} className="w-full" disabled={joiningCouple}>
              {joiningCouple && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              参加
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">一般設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>通貨</Label>
              <Input value={couple?.currency ?? 'JPY'} readOnly />
            </div>
            <div className="space-y-2">
              <Label>タイムゾーン</Label>
              <Input value={couple?.timezone ?? 'Asia/Tokyo'} readOnly />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logout */}
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
