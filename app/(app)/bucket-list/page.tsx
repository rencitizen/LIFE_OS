'use client'

import { useState } from 'react'
import { Heart, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/hooks/use-auth'
import {
  useBucketListItems,
  useCreateBucketListItem,
  useDeleteBucketListItem,
  useUpdateBucketListItem,
} from '@/lib/hooks/use-bucket-list-items'
import type { BucketListItem } from '@/types'

export default function BucketListPage() {
  const { couple, user } = useAuth()
  const { data: items, isLoading } = useBucketListItems(couple?.id)
  const createItem = useCreateBucketListItem()
  const updateItem = useUpdateBucketListItem()
  const deleteItem = useDeleteBucketListItem()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<BucketListItem | null>(null)
  const [title, setTitle] = useState('')
  const [memo, setMemo] = useState('')
  const [category, setCategory] = useState('')

  const resetForm = () => {
    setEditingItem(null)
    setTitle('')
    setMemo('')
    setCategory('')
  }

  const openEdit = (item: BucketListItem) => {
    setEditingItem(item)
    setTitle(item.title)
    setMemo(item.memo ?? '')
    setCategory(item.category ?? '')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!couple?.id || !user?.id) return toast.error('ペア情報を確認してください')
    if (!title.trim()) return toast.error('タイトルを入力してください')

    try {
      if (editingItem) {
        await updateItem.mutateAsync({
          id: editingItem.id,
          title: title.trim(),
          memo: memo.trim() || null,
          category: category.trim() || null,
        })
        toast.success('心メモを更新しました')
      } else {
        await createItem.mutateAsync({
          couple_id: couple.id,
          created_by: user.id,
          title: title.trim(),
          memo: memo.trim() || null,
          category: category.trim() || null,
        })
        toast.success('やりたいことを残しました')
      }

      resetForm()
      setDialogOpen(false)
    } catch (error) {
      console.error(error)
      toast.error('保存に失敗しました')
    }
  }

  const handleDelete = async (item: BucketListItem) => {
    if (!window.confirm(`「${item.title}」を削除しますか？`)) return

    try {
      await deleteItem.mutateAsync(item.id)
      toast.success('削除しました')
    } catch (error) {
      console.error(error)
      toast.error('削除に失敗しました')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            <h1 className="text-2xl font-bold">やりたいこと</h1>
          </div>
          <p className="text-sm text-muted-foreground">思いついたときに残す。急がない。忘れない。</p>
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogTrigger render={<Button size="sm" onClick={resetForm} />}>
            <Plus className="mr-1 h-4 w-4" />
            残す
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? '心メモを編集' : 'やりたいことを残す'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>やりたいこと</Label>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="例：アイスランドでオーロラを見る"
                />
              </div>
              <div className="space-y-2">
                <Label>カテゴリ（任意）</Label>
                <Input
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="旅行 / 体験 / 趣味 / 学び / 食 / 二人 など"
                />
              </div>
              <div className="space-y-2">
                <Label>メモ（任意）</Label>
                <Textarea
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                  placeholder="なぜ惹かれたか、どんな景色を見たいか、思いついたきっかけなど"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleSave}
                disabled={createItem.isPending || updateItem.isPending}
              >
                保存
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      ) : (items || []).length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(items || []).map((item) => (
            <Card key={item.id} tone="rose">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {item.category && <Badge variant="outline">{item.category}</Badge>}
                    <p className="mt-3 text-base font-semibold leading-relaxed">{item.title}</p>
                    {item.memo && (
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{item.memo}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)} aria-label="編集">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item)} aria-label="削除">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card tone="rose">
          <CardContent className="p-8 text-center">
            <Heart className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              まだ何もありません。やりたいと思った瞬間だけ、ここに残しておけば十分です。
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
