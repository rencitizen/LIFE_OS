'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Circle, Clock, Pencil, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { normalizeDateRange } from '@/lib/date-utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useCreateIdeaItem, useDeleteIdeaItem, useIdeaItems, useUpdateIdeaItem } from '@/lib/hooks/use-idea-items'
import { useCreateTodo, useCreateTodos, useDeleteTodo, useTodos, useUpdateTodo } from '@/lib/hooks/use-todos'
import { toast } from 'sonner'
import type { IdeaItem, InsertTables } from '@/types'

const statusIcons = {
  pending: Circle,
  in_progress: Clock,
  done: CheckCircle2,
}

const priorityLabels: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

const priorityColors: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive',
  medium: 'bg-[var(--color-expense-soft)] text-[var(--color-expense)]',
  low: 'bg-[var(--color-info-soft)] text-[var(--color-info)]',
}

function formatTodoPeriod(startDate?: string | null, endDate?: string | null, dueDate?: string | null) {
  const from = startDate ?? dueDate
  const to = endDate ?? dueDate ?? startDate
  if (!from) return '日付未設定'
  if (from === to) return from
  return `${from} - ${to}`
}

export default function TodosPage() {
  const { user, couple, partner } = useAuth()
  const { data: allTodos } = useTodos(couple?.id)
  const { data: ideaItems } = useIdeaItems(couple?.id)
  const createTodo = useCreateTodo()
  const createTodos = useCreateTodos()
  const updateTodo = useUpdateTodo()
  const deleteTodo = useDeleteTodo()
  const createIdeaItem = useCreateIdeaItem()
  const updateIdeaItem = useUpdateIdeaItem()
  const deleteIdeaItem = useDeleteIdeaItem()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkTitles, setBulkTitles] = useState('')
  const [newPriority, setNewPriority] = useState('medium')
  const [newAssignee, setNewAssignee] = useState('shared')
  const [newStartDate, setNewStartDate] = useState('')
  const [newEndDate, setNewEndDate] = useState('')
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
  const [ideaDialogOpen, setIdeaDialogOpen] = useState(false)
  const [ideaTitle, setIdeaTitle] = useState('')
  const [ideaMemo, setIdeaMemo] = useState('')
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null)

  const openCreateDialog = () => {
    setEditingTodoId(null)
    setNewTitle('')
    setBulkMode(false)
    setBulkTitles('')
    setNewPriority('medium')
    setNewAssignee('shared')
    setNewStartDate('')
    setNewEndDate('')
    setDialogOpen(true)
  }

  const openEditDialog = (todo: NonNullable<typeof allTodos>[number]) => {
    setEditingTodoId(todo.id)
    setNewTitle(todo.title)
    setBulkMode(false)
    setBulkTitles('')
    setNewPriority(todo.priority)
    setNewAssignee(!todo.assigned_to ? 'shared' : todo.assigned_to === user?.id ? 'me' : 'partner')
    setNewStartDate(todo.start_date || todo.due_date || '')
    setNewEndDate(todo.end_date || todo.due_date || todo.start_date || '')
    setDialogOpen(true)
  }

  const openCreateIdeaDialog = () => {
    setEditingIdeaId(null)
    setIdeaTitle('')
    setIdeaMemo('')
    setIdeaDialogOpen(true)
  }

  const openEditIdeaDialog = (idea: IdeaItem) => {
    setEditingIdeaId(idea.id)
    setIdeaTitle(idea.title)
    setIdeaMemo(idea.memo || '')
    setIdeaDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!user?.id || !couple?.id) return toast.error('ペア情報を確認してください')
    if (editingTodoId) {
      if (!newTitle.trim()) return toast.error('タイトルを入力してください')
    } else if (bulkMode) {
      if (!bulkTitles.trim()) return toast.error('TODOを1件以上入力してください')
    } else if (!newTitle.trim()) {
      return toast.error('タイトルを入力してください')
    }

    const normalizedRange = newStartDate
      ? normalizeDateRange(newStartDate, newEndDate || newStartDate)
      : null

    try {
      const payload = {
        priority: newPriority,
        assigned_to: newAssignee === 'shared' ? null : newAssignee === 'me' ? user.id : partner?.id || null,
        due_date: normalizedRange?.endDate || null,
        start_date: normalizedRange?.startDate || null,
        end_date: normalizedRange?.endDate || null,
      }

      if (editingTodoId) {
        await updateTodo.mutateAsync({ id: editingTodoId, title: newTitle.trim(), ...payload })
      } else if (bulkMode) {
        const titles = bulkTitles
          .split('\n')
          .map((title) => title.trim())
          .filter(Boolean)

        const todosToCreate: InsertTables<'todos'>[] = titles.map((title) => ({
          couple_id: couple.id,
          created_by: user.id,
          title,
          status: 'pending',
          ...payload,
        }))

        await createTodos.mutateAsync(todosToCreate)
      } else {
        await createTodo.mutateAsync({
          couple_id: couple.id,
          created_by: user.id,
          title: newTitle.trim(),
          status: 'pending',
          ...payload,
        })
      }

      setDialogOpen(false)
      setEditingTodoId(null)
      setNewTitle('')
      setBulkMode(false)
      setBulkTitles('')
      setNewStartDate('')
      setNewEndDate('')
      toast.success(editingTodoId ? 'TODOを更新しました' : bulkMode ? 'TODOをまとめて追加しました' : 'TODOを追加しました')
    } catch {
      toast.error(editingTodoId ? 'TODOの更新に失敗しました' : 'TODOの追加に失敗しました')
    }
  }

  const cycleStatus = async (todoId: string, current: string) => {
    const next = current === 'pending' ? 'in_progress' : current === 'in_progress' ? 'done' : 'pending'

    try {
      await updateTodo.mutateAsync({
        id: todoId,
        status: next,
        completed_at: next === 'done' ? new Date().toISOString() : null,
      })
    } catch {
      toast.error('ステータス更新に失敗しました')
    }
  }

  const handleDeleteTodo = async () => {
    if (!editingTodoId) return

    try {
      await deleteTodo.mutateAsync(editingTodoId)
      setEditingTodoId(null)
      setDialogOpen(false)
      setNewTitle('')
      setBulkMode(false)
      setBulkTitles('')
      setNewStartDate('')
      setNewEndDate('')
      toast.success('TODOを削除しました')
    } catch {
      toast.error('TODOの削除に失敗しました')
    }
  }

  const handleIdeaSubmit = async () => {
    if (!ideaTitle.trim()) return toast.error('やりたいことを入力してください')
    if (!user?.id || !couple?.id) return toast.error('ペア情報を確認してください')

    try {
      const payload = {
        title: ideaTitle.trim(),
        memo: ideaMemo.trim() || null,
      }

      if (editingIdeaId) {
        await updateIdeaItem.mutateAsync({ id: editingIdeaId, ...payload })
      } else {
        await createIdeaItem.mutateAsync({
          couple_id: couple.id,
          created_by: user.id,
          status: 'active',
          ...payload,
        })
      }

      setIdeaDialogOpen(false)
      setEditingIdeaId(null)
      setIdeaTitle('')
      setIdeaMemo('')
      toast.success(editingIdeaId ? 'やりたいことを更新しました' : 'やりたいことを追加しました')
    } catch {
      toast.error(editingIdeaId ? 'やりたいことの更新に失敗しました' : 'やりたいことの追加に失敗しました')
    }
  }

  const toggleIdeaStatus = async (idea: IdeaItem) => {
    try {
      await updateIdeaItem.mutateAsync({
        id: idea.id,
        status: idea.status === 'done' ? 'active' : 'done',
      })
    } catch {
      toast.error('状態の更新に失敗しました')
    }
  }

  const handleDeleteIdea = async () => {
    if (!editingIdeaId) return

    try {
      await deleteIdeaItem.mutateAsync(editingIdeaId)
      setEditingIdeaId(null)
      setIdeaDialogOpen(false)
      setIdeaTitle('')
      setIdeaMemo('')
      toast.success('やりたいことを削除しました')
    } catch {
      toast.error('やりたいことの削除に失敗しました')
    }
  }

  const filterTodos = (tab: string) => {
    if (!allTodos) return []
    switch (tab) {
      case 'mine':
        return allTodos.filter((todo) => todo.assigned_to === user?.id)
      case 'partner':
        return allTodos.filter((todo) => todo.assigned_to === partner?.id)
      case 'shared':
        return allTodos.filter((todo) => !todo.assigned_to)
      default:
        return allTodos
    }
  }

  const sortedTodos = useMemo(() => {
    return (todos: typeof allTodos) => {
      return [...(todos || [])].sort((a, b) => {
        const aDate = a.start_date || a.due_date || ''
        const bDate = b.start_date || b.due_date || ''
        if (a.status === 'done' && b.status !== 'done') return 1
        if (a.status !== 'done' && b.status === 'done') return -1
        return aDate.localeCompare(bDate)
      })
    }
  }, [])

  const renderTodoList = (todos: typeof allTodos) => {
    const rows = sortedTodos(todos)
    if (!rows.length) {
      return <p className="p-4 text-sm text-muted-foreground">TODOはありません</p>
    }

    const pending = rows.filter((todo) => todo.status !== 'done')
    const done = rows.filter((todo) => todo.status === 'done')

    return (
      <div className="space-y-2">
        {pending.map((todo) => {
          const StatusIcon = statusIcons[todo.status as keyof typeof statusIcons] || Circle
          return (
            <div key={todo.id} className="flex items-start gap-3 rounded-md p-3 transition-colors hover:bg-muted/50">
              <button onClick={() => cycleStatus(todo.id, todo.status)} className="shrink-0 pt-0.5">
                <StatusIcon className={cn('h-5 w-5', todo.status === 'in_progress' ? 'text-[var(--color-info)]' : 'text-muted-foreground')} />
              </button>
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openEditDialog(todo)}>
                <p className="flex items-center gap-1 truncate text-sm font-medium">
                  <span>{todo.title}</span>
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatTodoPeriod(todo.start_date, todo.end_date, todo.due_date)}
                </p>
              </button>
              <Badge className={cn('text-xs', priorityColors[todo.priority])}>
                {priorityLabels[todo.priority]}
              </Badge>
            </div>
          )
        })}

        {done.length > 0 && (
          <details className="pt-2">
            <summary className="cursor-pointer text-xs text-muted-foreground">完了済み ({done.length}件)</summary>
            <div className="mt-2 space-y-1">
              {done.map((todo) => (
                <div key={todo.id} className="flex items-center gap-3 p-2 opacity-50 transition-opacity hover:opacity-80">
                  <button onClick={() => cycleStatus(todo.id, todo.status)}>
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </button>
                  <div>
                    <p className="text-sm line-through">{todo.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {todo.completed_at ? format(new Date(todo.completed_at), 'yyyy/MM/dd HH:mm') : '完了'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    )
  }

  const activeIdeas = (ideaItems || []).filter((idea) => idea.status !== 'done')
  const doneIdeas = (ideaItems || []).filter((idea) => idea.status === 'done')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">TODO</h1>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="mr-1 h-4 w-4" />
          TODOを追加
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTodoId ? 'TODOを編集' : 'TODOを追加'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingTodoId && (
              <div className="flex items-center gap-2">
                <input
                  id="bulk-mode"
                  type="checkbox"
                  checked={bulkMode}
                  onChange={(e) => setBulkMode(e.target.checked)}
                  className="h-4 w-4 rounded border"
                />
                <Label htmlFor="bulk-mode">まとめて追加</Label>
              </div>
            )}
            {bulkMode && !editingTodoId ? (
              <div className="space-y-2">
                <Label>TODO一覧</Label>
                <Textarea
                  value={bulkTitles}
                  onChange={(e) => setBulkTitles(e.target.value)}
                  placeholder={'1行に1件ずつ入力\n例:\n食材を買う\n固定費を見直す\n保険を確認する'}
                  rows={6}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>タイトル</Label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>開始日</Label>
                <Input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>終了日</Label>
                <Input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>優先度</Label>
              <Select value={newPriority} onValueChange={(value) => setNewPriority(value ?? 'medium')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="medium">中</SelectItem>
                  <SelectItem value="low">低</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>担当</Label>
              <Select value={newAssignee} onValueChange={(value) => setNewAssignee(value ?? 'shared')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="shared">共有</SelectItem>
                  <SelectItem value="me">{user?.display_name || '自分'}</SelectItem>
                  {partner && <SelectItem value="partner">{partner.display_name}</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              {editingTodoId && (
                <Button type="button" variant="outline" className="flex-1" onClick={handleDeleteTodo}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  削除
                </Button>
              )}
              <Button onClick={handleSubmit} className="flex-1" disabled={createTodo.isPending || createTodos.isPending || updateTodo.isPending || deleteTodo.isPending}>
                {editingTodoId ? '更新' : bulkMode ? 'まとめて保存' : '保存'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={ideaDialogOpen} onOpenChange={setIdeaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingIdeaId ? 'やりたいことを編集' : 'やりたいことを追加'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>やりたいこと</Label>
              <Input value={ideaTitle} onChange={(e) => setIdeaTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>メモ</Label>
              <Textarea value={ideaMemo} onChange={(e) => setIdeaMemo(e.target.value)} rows={4} />
            </div>
            <div className="flex gap-2">
              {editingIdeaId && (
                <Button type="button" variant="outline" className="flex-1" onClick={handleDeleteIdea}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  削除
                </Button>
              )}
              <Button
                onClick={handleIdeaSubmit}
                className="flex-1"
                disabled={createIdeaItem.isPending || updateIdeaItem.isPending || deleteIdeaItem.isPending}
              >
                {editingIdeaId ? '更新' : '保存'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">すべて</TabsTrigger>
          <TabsTrigger value="mine">自分</TabsTrigger>
          <TabsTrigger value="partner">{partner?.display_name || 'パートナー'}</TabsTrigger>
          <TabsTrigger value="shared">共有</TabsTrigger>
        </TabsList>
        {['all', 'mine', 'partner', 'shared'].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardContent className="p-0">{renderTodoList(filterTodos(tab))}</CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">やりたいこと</h2>
          <Button size="sm" variant="outline" onClick={openCreateIdeaDialog}>
            <Plus className="mr-1 h-4 w-4" />
            やりたいことを追加
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {activeIdeas.length === 0 && doneIdeas.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">やりたいことはまだありません</p>
            ) : (
              <div className="space-y-2">
                {activeIdeas.map((idea) => (
                  <div key={idea.id} className="flex items-start gap-3 rounded-md p-3 transition-colors hover:bg-muted/50">
                    <button onClick={() => toggleIdeaStatus(idea)} className="shrink-0 pt-0.5">
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    </button>
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openEditIdeaDialog(idea)}>
                      <p className="flex items-center gap-1 truncate text-sm font-medium">
                        <span>{idea.title}</span>
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </p>
                      {idea.memo && <p className="text-xs text-muted-foreground">{idea.memo}</p>}
                    </button>
                  </div>
                ))}

                {doneIdeas.length > 0 && (
                  <details className="px-3 pb-3 pt-1">
                    <summary className="cursor-pointer text-xs text-muted-foreground">完了済み ({doneIdeas.length}件)</summary>
                    <div className="mt-2 space-y-1">
                      {doneIdeas.map((idea) => (
                        <div key={idea.id} className="flex items-center gap-3 p-2 opacity-50 transition-opacity hover:opacity-80">
                          <button onClick={() => toggleIdeaStatus(idea)}>
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          </button>
                          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openEditIdeaDialog(idea)}>
                            <p className="text-sm line-through">{idea.title}</p>
                            {idea.memo && <p className="text-xs text-muted-foreground">{idea.memo}</p>}
                          </button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
