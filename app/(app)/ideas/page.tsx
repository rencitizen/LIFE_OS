'use client'

import { useMemo, useState } from 'react'
import { Check, Lightbulb, Plus, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/hooks/use-auth'
import { useCreateIdeaItem, useIdeaItems, useUpdateIdeaItem } from '@/lib/hooks/use-idea-items'

export default function IdeasPage() {
  const { couple, user } = useAuth()
  const { data: ideas, isLoading } = useIdeaItems(couple?.id)
  const createIdea = useCreateIdeaItem()
  const updateIdea = useUpdateIdeaItem()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [memo, setMemo] = useState('')

  const activeIdeas = useMemo(() => (ideas || []).filter((idea) => idea.status === 'active'), [ideas])
  const doneIdeas = useMemo(() => (ideas || []).filter((idea) => idea.status === 'done'), [ideas])

  const resetForm = () => {
    setTitle('')
    setMemo('')
  }

  const handleCreate = async () => {
    if (!couple?.id || !user?.id) return toast.error('ペア情報を確認してください')
    if (!title.trim()) return toast.error('タイトルを入力してください')

    try {
      await createIdea.mutateAsync({
        couple_id: couple.id,
        created_by: user.id,
        title: title.trim(),
        memo: memo.trim() || null,
        status: 'active',
      })
      resetForm()
      setDialogOpen(false)
      toast.success('アイデアを追加しました')
    } catch (error) {
      console.error(error)
      toast.error('アイデアの追加に失敗しました')
    }
  }

  const setStatus = async (id: string, status: 'active' | 'done') => {
    try {
      await updateIdea.mutateAsync({ id, status })
      toast.success(status === 'done' ? '完了にしました' : 'アクティブに戻しました')
    } catch (error) {
      console.error(error)
      toast.error('更新に失敗しました')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">思考・アイデア</h1>
          <p className="text-sm text-muted-foreground">
            思考テーマや、あとで掘り下げたいアイデアを残します。
          </p>
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="mr-1 h-4 w-4" />
            追加
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>思考・アイデアを追加</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>タイトル</Label>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例：所有欲" />
              </div>
              <div className="space-y-2">
                <Label>メモ</Label>
                <Textarea
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                  placeholder="考えたい理由や会話の要点など"
                />
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={createIdea.isPending}>
                保存
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card tone="cyan">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">アクティブ</p>
            <p className="mt-1 text-2xl font-semibold">{activeIdeas.length}</p>
          </CardContent>
        </Card>
        <Card tone="mint">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">完了</p>
            <p className="mt-1 text-2xl font-semibold">{doneIdeas.length}</p>
          </CardContent>
        </Card>
        <Card tone="blue">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">合計</p>
            <p className="mt-1 text-2xl font-semibold">{(ideas || []).length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card tone="cyan">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4" />
              アクティブ
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">読み込み中...</p>
            ) : activeIdeas.length > 0 ? (
              <div className="space-y-3">
                {activeIdeas.map((idea) => (
                  <div key={idea.id} className="rounded-lg border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{idea.title}</p>
                        {idea.memo && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{idea.memo}</p>}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setStatus(idea.id, 'done')}>
                        <Check className="mr-1 h-4 w-4" />
                        完了
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                まだありません。ChatGPTで「これは思考テーマとして残して」と伝えた内容もここに保存できます。
              </p>
            )}
          </CardContent>
        </Card>

        <Card tone="mint">
          <CardHeader>
            <CardTitle className="text-base">完了・区切り済み</CardTitle>
          </CardHeader>
          <CardContent>
            {doneIdeas.length > 0 ? (
              <div className="space-y-3">
                {doneIdeas.map((idea) => (
                  <div key={idea.id} className="rounded-lg border bg-muted/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium line-through opacity-70">{idea.title}</p>
                          <Badge variant="outline">完了</Badge>
                        </div>
                        {idea.memo && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{idea.memo}</p>}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setStatus(idea.id, 'active')}>
                        <RotateCcw className="mr-1 h-4 w-4" />
                        戻す
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">完了したアイデアはまだありません。</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
