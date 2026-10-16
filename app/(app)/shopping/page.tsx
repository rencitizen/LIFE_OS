'use client'

import { useState } from 'react'
import { Plus, ShoppingCart, Check, Undo2, Pencil, ReceiptText } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/hooks/use-auth'
import { useShoppingLists, useShoppingItems, useCreateShoppingList, useCreateShoppingItem, useToggleShoppingItem, useUpdateShoppingList, useUpdateShoppingItem } from '@/lib/hooks/use-shopping'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const categoryLabels: Record<string, string> = {
  food: '食材',
  daily: '日用品',
  other: 'その他',
  general: '全般',
}

const priorityColors: Record<string, string> = {
  high: 'text-destructive',
  medium: 'text-[var(--color-blue)]',
  low: 'text-muted-foreground',
}

export default function ShoppingPage() {
  const { user, couple } = useAuth()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { data: lists } = useShoppingLists(couple?.id)
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const { data: items } = useShoppingItems(selectedListId || undefined)
  const createList = useCreateShoppingList()
  const createItem = useCreateShoppingItem()
  const toggleItem = useToggleShoppingItem()
  const updateList = useUpdateShoppingList()
  const updateItem = useUpdateShoppingItem()

  const [newListName, setNewListName] = useState('')
  const [newListCategory, setNewListCategory] = useState('general')
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const [editingListName, setEditingListName] = useState('')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingItemName, setEditingItemName] = useState('')
  const [editingItemPrice, setEditingItemPrice] = useState('')

  const handleCreateList = async () => {
    if (!newListName) { toast.error('リスト名を入力してください'); return }
    if (!user?.id) { toast.error('ログインが必要です'); return }
    if (!couple?.id) { toast.error('先にカップルを作成または参加してください'); return }
    try {
      const result = await createList.mutateAsync({
        couple_id: couple.id,
        created_by: user.id,
        name: newListName,
        category: newListCategory,
      })
      setNewListName('')
      setDialogOpen(false)
      setSelectedListId(result.id)
      toast.success('リストを作成しました')
    } catch {
      toast.error('リストの作成に失敗しました')
    }
  }

  const handleAddItem = async () => {
    if (!newItemName) { toast.error('アイテム名を入力してください'); return }
    if (!selectedListId) { toast.error('リストを選択してください'); return }

    const parsedPrice = newItemPrice.trim() === '' ? null : Number(newItemPrice)
    if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      toast.error('金額は0以上の数値で入力してください')
      return
    }

    try {
      await createItem.mutateAsync({
        list_id: selectedListId,
        name: newItemName,
        estimated_price: parsedPrice,
      })
      setNewItemName('')
      setNewItemPrice('')
    } catch {
      toast.error('アイテムの追加に失敗しました')
    }
  }

  const handleToggle = async (itemId: string, currentChecked: boolean) => {
    if (!user?.id) return
    try {
      await toggleItem.mutateAsync({
        id: itemId,
        is_checked: !currentChecked,
        checked_by: user.id,
      })
    } catch {
      toast.error('更新に失敗しました')
    }
  }

  const handleSaveListName = async () => {
    if (!editingListId || !editingListName.trim()) {
      setEditingListId(null)
      return
    }
    try {
      await updateList.mutateAsync({ id: editingListId, name: editingListName.trim() })
      toast.success('リスト名を更新しました')
    } catch {
      toast.error('リスト名の更新に失敗しました')
    } finally {
      setEditingListId(null)
      setEditingListName('')
    }
  }

  const handleSaveItemName = async () => {
    if (!editingItemId || !editingItemName.trim()) {
      setEditingItemId(null)
      setEditingItemPrice('')
      return
    }

    const parsedPrice = editingItemPrice.trim() === '' ? null : Number(editingItemPrice)
    if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      toast.error('金額は0以上の数値で入力してください')
      return
    }

    try {
      await updateItem.mutateAsync({
        id: editingItemId,
        name: editingItemName.trim(),
        estimated_price: parsedPrice,
      })
      toast.success('アイテムを更新しました')
    } catch {
      toast.error('アイテムの更新に失敗しました')
    } finally {
      setEditingItemId(null)
      setEditingItemName('')
      setEditingItemPrice('')
    }
  }

  const uncheckedCount = items?.filter((i) => !i.is_checked).length || 0
  const checkedCount = items?.filter((i) => i.is_checked).length || 0
  const readyToExpenseItems = (items || []).filter((item) => item.is_checked && !item.expense_created && Number(item.estimated_price ?? 0) > 0)

  const handleCreateExpensesFromCheckedItems = async () => {
    if (!user?.id || !couple?.id) {
      toast.error('ログイン状態とカップル情報を確認してください')
      return
    }

    const itemsToConvert = (items || []).filter((item) => item.is_checked && !item.expense_created)
    const validItems = itemsToConvert.filter((item) => Number(item.estimated_price ?? 0) > 0)

    if (validItems.length === 0) {
      toast.info('支出化できる購入済みアイテムがありません')
      return
    }

    try {
      const { data, error } = await supabase.rpc('convert_shopping_items_to_expenses', {
        p_item_ids: validItems.map((item) => item.id),
        p_paid_by: user.id,
      })

      if (error) throw error

      await queryClient.invalidateQueries({ queryKey: ['shopping-items'] })
      await queryClient.invalidateQueries({ queryKey: ['expenses'] })
      await queryClient.invalidateQueries({ queryKey: ['expense-summary'] })

      toast.success(`${Number(data ?? validItems.length)}件を支出として登録しました`)
    } catch {
      toast.error('支出の登録に失敗しました')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">買い物リスト</h1>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          新しいリスト
        </Button>
      </div>

      {/* Create List Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>リスト作成</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>リスト名</Label>
              <Input
                placeholder="今週の買い物"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
              />
            </div>
            <div className="space-y-2">
              <Label>カテゴリ</Label>
              <Select value={newListCategory} onValueChange={(v) => v && setNewListCategory(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="food">食材</SelectItem>
                  <SelectItem value="daily">日用品</SelectItem>
                  <SelectItem value="other">その他</SelectItem>
                  <SelectItem value="general">全般</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreateList} className="w-full" disabled={createList.isPending}>
              作成
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Lists */}
        <div className="space-y-2">
          {lists && lists.length > 0 ? (
            lists.map((list) => (
              <Card
                key={list.id}
                className={cn(
                  'cursor-pointer transition-colors hover:bg-muted/50',
                  selectedListId === list.id && 'ring-1 ring-primary'
                )}
                onClick={() => setSelectedListId(list.id)}
                tone="blue"
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    {editingListId === list.id ? (
                      <Input
                        value={editingListName}
                        onChange={(e) => setEditingListName(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={handleSaveListName}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveListName()
                          if (e.key === 'Escape') {
                            setEditingListId(null)
                            setEditingListName('')
                          }
                        }}
                        autoFocus
                        className="h-8 text-sm"
                      />
                    ) : (
                      <button
                        type="button"
                        className="flex items-center gap-1 text-left"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingListId(list.id)
                          setEditingListName(list.name)
                        }}
                      >
                        <span className="font-medium text-sm">{list.name}</span>
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {categoryLabels[list.category] || list.category}
                    </p>
                  </div>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-sm text-muted-foreground p-4">リストがありません</p>
          )}
        </div>

        {/* Items */}
        <div className="lg:col-span-2">
          {selectedListId ? (
            <Card tone="cyan">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    アイテム
                    {uncheckedCount > 0 && (
                      <Badge variant="secondary" className="ml-2">{uncheckedCount}件</Badge>
                    )}
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleCreateExpensesFromCheckedItems}
                    disabled={readyToExpenseItems.length === 0}
                  >
                    <ReceiptText className="h-4 w-4 mr-1" />
                    支出に変換
                  </Button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                  <Input
                    placeholder="アイテムを追加..."
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="10"
                    placeholder="金額"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                  />
                  <Button size="sm" onClick={handleAddItem} disabled={createItem.isPending}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {items && items.length > 0 ? (
                  <div className="space-y-2">
                    {items
                      .filter((i) => !i.is_checked)
                      .map((item) => (
                        <div key={item.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                          <Checkbox
                            checked={item.is_checked}
                            onCheckedChange={() => handleToggle(item.id, item.is_checked)}
                          />
                          <div className="flex-1">
                            {editingItemId === item.id ? (
                              <div className="space-y-2">
                                <Input
                                  value={editingItemName}
                                  onChange={(e) => setEditingItemName(e.target.value)}
                                  onBlur={handleSaveItemName}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveItemName()
                                    if (e.key === 'Escape') {
                                      setEditingItemId(null)
                                      setEditingItemName('')
                                      setEditingItemPrice('')
                                    }
                                  }}
                                  autoFocus
                                  className="h-8 text-sm"
                                />
                                <Input
                                  type="number"
                                  min="0"
                                  step="10"
                                  value={editingItemPrice}
                                  placeholder="金額"
                                  onChange={(e) => setEditingItemPrice(e.target.value)}
                                  onBlur={handleSaveItemName}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveItemName()
                                  }}
                                  className="h-8 text-sm"
                                />
                              </div>
                            ) : (
                              <button
                                type="button"
                                className={cn('flex items-center gap-1 text-left text-sm', priorityColors[item.priority])}
                                onClick={() => {
                                  setEditingItemId(item.id)
                                  setEditingItemName(item.name)
                                  setEditingItemPrice(item.estimated_price != null ? String(item.estimated_price) : '')
                                }}
                              >
                                <span>{item.name}</span>
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </button>
                            )}
                            {item.memo && <p className="text-xs text-muted-foreground">{item.memo}</p>}
                          </div>
                          {item.estimated_price !== null && item.estimated_price !== undefined && Number(item.estimated_price) > 0 && (
                            <span className="text-xs text-muted-foreground">
                              ¥{Number(item.estimated_price).toLocaleString()}
                            </span>
                          )}
                        </div>
                      ))}

                    {checkedCount > 0 && (
                      <>
                        <div className="flex items-center gap-2 py-2">
                          <Check className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            完了済み ({checkedCount}件)
                          </span>
                        </div>
                        {items
                          .filter((i) => i.is_checked)
                          .map((item) => (
                            <div key={item.id} className="flex items-center gap-3 p-2 rounded-md opacity-50 hover:opacity-80 transition-opacity group">
                              <Checkbox
                                checked={item.is_checked}
                                onCheckedChange={() => handleToggle(item.id, item.is_checked)}
                              />
                              <p className="text-sm line-through flex-1">{item.name}</p>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleToggle(item.id, item.is_checked)}
                              >
                                <Undo2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">アイテムがありません</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card tone="mint">
              <CardContent className="flex items-center justify-center p-12">
                <p className="text-sm text-muted-foreground">リストを選択してください</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
