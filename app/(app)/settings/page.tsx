'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, Loader2, UserPlus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { LIVING_MODE_LABELS, LIVING_MODES } from '@/lib/finance/constants'
import { formatYen } from '@/lib/finance/utils'
import { useAccountBalanceSummary } from '@/lib/hooks/use-accounts'
import { useAuth } from '@/lib/hooks/use-auth'
import { useLifePlanConfig, useSaveLifePlan } from '@/lib/hooks/use-life-plan'
import { createClient } from '@/lib/supabase/client'
import { useFinanceStore } from '@/stores/finance-store'
import { toast } from 'sonner'
import type { LivingMode } from '@/types'

const PROFILE_COLORS = [
  { value: '#105666', label: 'Teal' },
  { value: '#839958', label: 'Olive' },
  { value: '#d3968c', label: 'Clay' },
  { value: '#0a3323', label: 'Forest' },
  { value: '#f7f4d5', label: 'Cream' },
] as const

export default function SettingsPage() {
  const { user, couple, partner, signOut } = useAuth()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { livingMode, setLivingMode } = useFinanceStore()
  const lifePlanConfig = useLifePlanConfig(couple?.id)
  const saveLifePlan = useSaveLifePlan()
  const { data: accountSummary } = useAccountBalanceSummary(couple?.id)

  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#105666')
  const [editingProfile, setEditingProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [coupleName, setCoupleName] = useState('')
  const [creatingCouple, setCreatingCouple] = useState(false)

  const [joinDialogOpen, setJoinDialogOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [joiningCouple, setJoiningCouple] = useState(false)

  const [copied, setCopied] = useState(false)
  const [savingMode, setSavingMode] = useState(false)
  const [openingCash, setOpeningCash] = useState({ mine: '', partner: '' })

  useEffect(() => {
    if (couple?.living_mode) {
      setLivingMode(couple.living_mode as LivingMode)
    }
  }, [couple?.living_mode, setLivingMode])

  useEffect(() => {
    setOpeningCash({
      mine: String(lifePlanConfig.initialAssets.ren.cash || 0),
      partner: String(lifePlanConfig.initialAssets.hikaru.cash || 0),
    })
  }, [lifePlanConfig.initialAssets.hikaru.cash, lifePlanConfig.initialAssets.ren.cash])

  const copyInviteCode = () => {
    if (!couple?.invite_code) return
    navigator.clipboard.writeText(couple.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const startEditProfile = () => {
    setEditName(user?.display_name ?? '')
    setEditColor(user?.color ?? '#105666')
    setEditingProfile(true)
  }

  const handleSaveProfile = async () => {
    if (!user?.id) return toast.error('ログインが必要です')
    if (!editName.trim()) return toast.error('表示名を入力してください')

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

  const handleLivingModeChange = async (mode: LivingMode) => {
    setLivingMode(mode)

    if (!couple?.id) return

    setSavingMode(true)
    try {
      const { error } = await supabase
        .from('couples')
        .update({ living_mode: mode })
        .eq('id', couple.id)
      if (error) throw error

      await queryClient.invalidateQueries({ queryKey: ['auth-couple', couple.id] })
      toast.success('生活モードを更新しました')
    } catch {
      toast.error('生活モードの更新に失敗しました')
    } finally {
      setSavingMode(false)
    }
  }

  const handleCreateCouple = async () => {
    if (!user?.id) return toast.error('ログインが必要です')
    if (!coupleName.trim()) return toast.error('ペア名を入力してください')

    setCreatingCouple(true)
    try {
      const { data: newCouple, error } = await supabase
        .rpc('create_couple_for_current_user', { p_name: coupleName.trim() })
      if (error) throw error

      await queryClient.invalidateQueries({ queryKey: ['auth-profile'] })
      await queryClient.invalidateQueries({ queryKey: ['auth-couple', newCouple?.id] })
      await queryClient.invalidateQueries({ queryKey: ['auth-partner'] })
      setCreateDialogOpen(false)
      setCoupleName('')
      toast.success('ペアを作成しました')
    } catch {
      toast.error('ペア作成に失敗しました')
    } finally {
      setCreatingCouple(false)
    }
  }

  const handleJoinCouple = async () => {
    if (!user?.id) return toast.error('ログインが必要です')
    if (!inviteCode.trim()) return toast.error('招待コードを入力してください')

    setJoiningCouple(true)
    try {
      const { data: foundCouple, error } = await supabase
        .rpc('join_couple_for_current_user', { p_invite_code: inviteCode.trim().toUpperCase() })
      if (error || !foundCouple) {
        toast.error('招待コードが見つかりません')
        return
      }

      await queryClient.invalidateQueries({ queryKey: ['auth-profile'] })
      await queryClient.invalidateQueries({ queryKey: ['auth-couple', foundCouple.id] })
      await queryClient.invalidateQueries({ queryKey: ['auth-partner'] })
      setJoinDialogOpen(false)
      setInviteCode('')
      toast.success('ペアに参加しました')
    } catch {
      toast.error('参加処理に失敗しました')
    } finally {
      setJoiningCouple(false)
    }
  }

  const handleSaveOpeningCash = async () => {
    if (!couple?.id) return

    try {
      await saveLifePlan.mutateAsync({
        coupleId: couple.id,
        config: {
          ...lifePlanConfig,
          initialAssets: {
            ...lifePlanConfig.initialAssets,
            ren: {
              ...lifePlanConfig.initialAssets.ren,
              cash: Number(openingCash.mine || 0),
            },
            hikaru: {
              ...lifePlanConfig.initialAssets.hikaru,
              cash: Number(openingCash.partner || 0),
            },
          },
        },
      })
      toast.success('期首預金残高を更新しました')
    } catch {
      toast.error('期首預金残高の更新に失敗しました')
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">設定</h1>

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
                  backgroundColor: editingProfile ? editColor : user?.color || '#105666',
                  color: '#f7f4d5',
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
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              ) : (
                <Input value={user?.display_name ?? ''} readOnly />
              )}
            </div>
            <div className="space-y-2">
              <Label>テーマカラー</Label>
              {editingProfile ? (
                <div className="grid grid-cols-3 gap-2">
                  {PROFILE_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setEditColor(color.value)}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                        editColor === color.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                    >
                      <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: color.value }} />
                      <span>{color.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: user?.color ?? '#105666' }} />
                  <span className="text-sm">{PROFILE_COLORS.find((color) => color.value === (user?.color ?? '#105666'))?.label || 'Custom'}</span>
                </div>
              )}
            </div>
          </div>
          {editingProfile ? (
            <div className="flex gap-2">
              <Button onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">生活モード</CardTitle>
          <CardDescription>家計表示と生活前提を切り替えます</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {LIVING_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleLivingModeChange(mode)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  livingMode === mode ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
                }`}
                disabled={savingMode}
              >
                <p className="font-medium">{LIVING_MODE_LABELS[mode]}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mode === 'before_cohabiting' ? '個別支出や移行前の家計を前提に表示' : '共通家計を前提に予算と集計を表示'}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">期首預金残高</CardTitle>
          <CardDescription>5年計画の起点になる現預金を設定します</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{user?.display_name || '自分'}</Label>
              <Input
                inputMode="numeric"
                value={openingCash.mine}
                onChange={(event) => setOpeningCash((current) => ({ ...current, mine: event.target.value.replace(/[^\d]/g, '') }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{partner?.display_name || '相手'}</Label>
              <Input
                inputMode="numeric"
                value={openingCash.partner}
                onChange={(event) => setOpeningCash((current) => ({ ...current, partner: event.target.value.replace(/[^\d]/g, '') }))}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border px-3 py-3 text-sm">
              <span className="text-muted-foreground">設定中の合計</span>
              <span className="font-semibold">{formatYen(Number(openingCash.mine || 0) + Number(openingCash.partner || 0))}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-3 text-sm">
              <span className="text-muted-foreground">実績の現預金</span>
              <span className="font-medium">{formatYen(accountSummary?.cashLike || 0)}</span>
            </div>
          </div>
          <Button onClick={handleSaveOpeningCash} disabled={saveLifePlan.isPending || !couple?.id}>
            {saveLifePlan.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            保存
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ペア設定</CardTitle>
          <CardDescription>パートナーとの接続状態を管理します</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {couple ? (
            <>
              <div className="space-y-2">
                <Label>ペア名</Label>
                <Input value={couple.name ?? ''} readOnly />
              </div>
              <div className="space-y-2">
                <Label>招待コード</Label>
                <div className="flex gap-2">
                  <Input value={couple.invite_code} readOnly className="font-mono" />
                  <Button variant="outline" size="icon" onClick={copyInviteCode}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {partner ? (
                <div className="flex items-center gap-3 rounded-md bg-muted/50 p-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={partner.avatar_url || undefined} />
                    <AvatarFallback style={{ backgroundColor: `${partner.color}20`, color: partner.color }}>
                      {partner.display_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{partner.display_name}</p>
                    <p className="text-xs text-muted-foreground">パートナー</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-md border border-dashed p-3">
                  <UserPlus className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">招待コードを共有するとパートナーが参加できます</p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">まだペアがありません。新規作成するか、招待コードで参加してください。</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button onClick={() => setCreateDialogOpen(true)}>ペアを作成</Button>
                <Button variant="outline" onClick={() => setJoinDialogOpen(true)}>コードで参加</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">一般設定</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>通貨</Label>
            <Input value={couple?.currency ?? 'JPY'} readOnly />
          </div>
          <div className="space-y-2">
            <Label>タイムゾーン</Label>
            <Input value={couple?.timezone ?? 'Asia/Tokyo'} readOnly />
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">ログアウト</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={signOut}>
            ログアウト
          </Button>
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ペアを作成</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>ペア名</Label>
              <Input value={coupleName} onChange={(e) => setCoupleName(e.target.value)} />
            </div>
            <Button onClick={handleCreateCouple} className="w-full" disabled={creatingCouple}>
              {creatingCouple && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              作成
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>招待コードで参加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>招待コード</Label>
              <Input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="font-mono uppercase"
              />
            </div>
            <Button onClick={handleJoinCouple} className="w-full" disabled={joiningCouple}>
              {joiningCouple && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              参加
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
