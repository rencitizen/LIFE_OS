'use client'

import { useMemo, useState } from 'react'
import {
  format,
  isBefore,
  startOfToday,
} from 'date-fns'
import { CheckCircle2, Circle, Clock, Plus, Trash2 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { normalizeDateRange } from '@/lib/date-utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useCreateIdeaItem, useDeleteIdeaItem, useIdeaItems, useUpdateIdeaItem } from '@/lib/hooks/use-idea-items'
import { useCreateTodo, useCreateTodos, useDeleteTodo, useTodos, useUpdateTodo } from '@/lib/hooks/use-todos'
import { buildTodoProgressSummary } from '@/lib/todo-progress'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { IdeaItem, InsertTables, Todo, TodoTaskLevel } from '@/types'

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
  medium: 'bg-[var(--color-warning-soft)] text-[var(--color-info)]',
  low: 'bg-[var(--color-info-soft)] text-[var(--color-info)]',
}

const taskLevelLabels: Record<TodoTaskLevel, string> = {
  large: '大',
  medium: '中',
  small: '小',
}

const taskLevelColors: Record<TodoTaskLevel, string> = {
  large: 'bg-primary text-primary-foreground',
  medium: 'bg-secondary/15 text-secondary',
  small: 'bg-background text-foreground border border-border',
}

const taskLevelRank: Record<TodoTaskLevel, number> = {
  large: 0,
  medium: 1,
  small: 2,
}

const filterLabels = {
  all: 'すべて',
  mine: '自分',
  partner: 'パートナー',
  shared: '共有',
} as const

type FilterMode = keyof typeof filterLabels

function formatTodoPeriod(startDate?: string | null, endDate?: string | null, dueDate?: string | null) {
  const from = startDate ?? dueDate
  const to = endDate ?? dueDate ?? startDate
  if (!from) return '日付なし'
  if (from === to) return from
  return `${from} - ${to}`
}

function getTodoRange(todo: Todo) {
  const start = todo.start_date ?? todo.due_date ?? todo.end_date
  if (!start) return null

  return normalizeDateRange(start, todo.end_date ?? todo.due_date ?? start)
}

function compareTodos(a: Todo, b: Todo) {
  const aRange = getTodoRange(a)
  const bRange = getTodoRange(b)
  const aDate = aRange?.startDate ?? '9999-12-31'
  const bDate = bRange?.startDate ?? '9999-12-31'

  if (a.status === 'done' && b.status !== 'done') return 1
  if (a.status !== 'done' && b.status === 'done') return -1
  if (aDate !== bDate) return aDate.localeCompare(bDate)
  if (taskLevelRank[a.task_level as TodoTaskLevel] !== taskLevelRank[b.task_level as TodoTaskLevel]) {
    return taskLevelRank[a.task_level as TodoTaskLevel] - taskLevelRank[b.task_level as TodoTaskLevel]
  }

  return a.created_at.localeCompare(b.created_at)
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

  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkTitles, setBulkTitles] = useState('')
  const [newPriority, setNewPriority] = useState('medium')
  const [newAssignee, setNewAssignee] = useState('shared')
  const [newStartDate, setNewStartDate] = useState('')
  const [newEndDate, setNewEndDate] = useState('')
  const [newTaskLevel, setNewTaskLevel] = useState<TodoTaskLevel>('small')
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
  const [ideaDialogOpen, setIdeaDialogOpen] = useState(false)
  const [ideaTitle, setIdeaTitle] = useState('')
  const [ideaMemo, setIdeaMemo] = useState('')
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null)

  const today = startOfToday()

  const openCreateDialog = () => {
    setEditingTodoId(null)
    setNewTitle('')
    setNewDescription('')
    setBulkMode(false)
    setBulkTitles('')
    setNewPriority('medium')
    setNewAssignee('shared')
    setNewStartDate('')
    setNewEndDate('')
    setNewTaskLevel('small')
    setDialogOpen(true)
  }

  const openEditDialog = (todo: Todo) => {
    setEditingTodoId(todo.id)
    setNewTitle(todo.title)
    setNewDescription(todo.description || '')
    setBulkMode(false)
    setBulkTitles('')
    setNewPriority(todo.priority)
    setNewAssignee(!todo.assigned_to ? 'shared' : todo.assigned_to === user?.id ? 'me' : 'partner')
    setNewStartDate(todo.start_date || todo.due_date || '')
    setNewEndDate(todo.end_date || todo.due_date || todo.start_date || '')
    setNewTaskLevel((todo.task_level as TodoTaskLevel) || 'small')
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

  const filteredTodos = useMemo(() => {
    const rows = allTodos || []
    if (filterMode === 'mine') return rows.filter((todo) => todo.assigned_to === user?.id)
    if (filterMode === 'partner') return rows.filter((todo) => todo.assigned_to === partner?.id)
    if (filterMode === 'shared') return rows.filter((todo) => !todo.assigned_to)
    return rows
  }, [allTodos, filterMode, partner?.id, user?.id])

  const flatTodoRows = useMemo(() => [...filteredTodos].sort(compareTodos), [filteredTodos])

  const todoCounts = useMemo(() => {
    const rows = filteredTodos
    return {
      total: rows.length,
      done: rows.filter((todo) => todo.status === 'done').length,
      active: rows.filter((todo) => todo.status !== 'done').length,
      inProgress: rows.filter((todo) => todo.status === 'in_progress').length,
    }
  }, [filteredTodos])

  const todoMetrics = useMemo(() => buildTodoProgressSummary(filteredTodos, today), [filteredTodos, today])

  const handleSubmit = async () => {
    if (!user?.id || !couple?.id) return toast.error('アカウント情報を確認してください')
    if (editingTodoId) {
      if (!newTitle.trim()) return toast.error('タイトルを入力してください')
    } else if (bulkMode) {
      if (!bulkTitles.trim()) return toast.error('1行につき1件のタスクを入力してください')
    } else if (!newTitle.trim()) {
      return toast.error('タイトルを入力してください')
    }

    const normalizedRange = newStartDate
      ? normalizeDateRange(newStartDate, newEndDate || newStartDate)
      : null

    try {
      const payload = {
        description: newDescription.trim() || null,
        priority: newPriority,
        assigned_to: newAssignee === 'shared' ? null : newAssignee === 'me' ? user.id : partner?.id || null,
        due_date: normalizedRange?.endDate || null,
        start_date: normalizedRange?.startDate || null,
        end_date: normalizedRange?.endDate || null,
        task_level: newTaskLevel,
        parent_todo_id: null,
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
      setNewDescription('')
      setBulkMode(false)
      setBulkTitles('')
      setNewStartDate('')
      setNewEndDate('')
      toast.success(editingTodoId ? 'タスクを更新しました' : bulkMode ? 'タスクを作成しました' : 'タスクを作成しました')
    } catch {
      toast.error(editingTodoId ? 'タスクの更新に失敗しました' : 'タスクの保存に失敗しました')
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
      toast.error('ステータスの更新に失敗しました')
    }
  }

  const handleDeleteTodo = async () => {
    if (!editingTodoId) return

    try {
      await deleteTodo.mutateAsync(editingTodoId)
      setEditingTodoId(null)
      setDialogOpen(false)
      setNewTitle('')
      setNewDescription('')
      setBulkMode(false)
      setBulkTitles('')
      setNewStartDate('')
      setNewEndDate('')
      toast.success('タスクを削除しました')
    } catch {
      toast.error('タスクの削除に失敗しました')
    }
  }

  const handleIdeaSubmit = async () => {
    if (!ideaTitle.trim()) return toast.error('タイトルを入力してください')
    if (!user?.id || !couple?.id) return toast.error('アカウント情報を確認してください')

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
      toast.success(editingIdeaId ? 'アイデアを更新しました' : 'アイデアを作成しました')
    } catch {
      toast.error(editingIdeaId ? 'アイデアの更新に失敗しました' : 'アイデアの作成に失敗しました')
    }
  }

  const toggleIdeaStatus = async (idea: IdeaItem) => {
    try {
      await updateIdeaItem.mutateAsync({
        id: idea.id,
        status: idea.status === 'done' ? 'active' : 'done',
      })
    } catch {
      toast.error('アイデアの更新に失敗しました')
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
      toast.success('アイデアを削除しました')
    } catch {
      toast.error('アイデアの削除に失敗しました')
    }
  }

  const activeIdeas = (ideaItems || []).filter((idea) => idea.status !== 'done')
  const doneIdeas = (ideaItems || []).filter((idea) => idea.status === 'done')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">タスク</h1>
          <p className="text-sm text-muted-foreground">タスクを一覧で確認できます。</p>
        </div>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="mr-1 h-4 w-4" />
          タスクを追加
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(filterLabels) as FilterMode[]).map((mode) => (
          <Button
            key={mode}
            size="sm"
            variant={filterMode === mode ? 'default' : 'outline'}
            onClick={() => setFilterMode(mode)}
          >
            {filterLabels[mode]}
          </Button>
        ))}
        <Badge variant="outline">{todoCounts.total}件のタスク</Badge>
        <Badge variant="outline">{todoCounts.active}件が未完了</Badge>
        <Badge variant="outline">{todoCounts.done}件が完了</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card tone="mint">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">合計</p>
            <p className="mt-1 text-2xl font-semibold">{todoCounts.total}</p>
          </CardContent>
        </Card>
        <Card tone="cyan">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">未完了</p>
            <p className="mt-1 text-2xl font-semibold">{todoCounts.active}</p>
          </CardContent>
        </Card>
        <Card tone="blue">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">進行中</p>
            <p className="mt-1 text-2xl font-semibold">{todoCounts.inProgress}</p>
          </CardContent>
        </Card>
        <Card tone="navy">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">完了率</p>
            <p className="mt-1 text-2xl font-semibold">{todoMetrics.completionRate}%</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${todoMetrics.completionRate}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card tone="cyan">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">日別の完了推移</CardTitle>
          </CardHeader>
          <CardContent>
            {todoMetrics.doneCount > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={todoMetrics.dailySeries}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={28} />
                    <Tooltip />
                    <Bar dataKey="count" fill="var(--accent)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">タスクを完了すると日別の推移が表示されます。</p>
            )}
          </CardContent>
        </Card>

        <Card tone="mint">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">進捗</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">今日完了</p>
              <p className="mt-1 text-2xl font-semibold">{todoMetrics.doneToday}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">今週完了</p>
              <p className="mt-1 text-2xl font-semibold">{todoMetrics.doneThisWeek}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">連続達成</p>
              <p className="mt-1 text-2xl font-semibold">{todoMetrics.currentStreak}日</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">今月完了</p>
              <p className="mt-1 text-2xl font-semibold">{todoMetrics.doneThisMonth}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">週別の完了推移</CardTitle>
        </CardHeader>
        <CardContent>
          {todoMetrics.doneCount > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={todoMetrics.weeklySeries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={28} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--primary)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">完了履歴が増えると週別の棒グラフが表示されます。</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTodoId ? 'タスクを編集' : 'タスクを追加'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editingTodoId && (
              <div className="flex items-center gap-2">
                <input
                  id="bulk-mode"
                  type="checkbox"
                  checked={bulkMode}
                  onChange={(event) => setBulkMode(event.target.checked)}
                  className="h-4 w-4 rounded border"
                />
                <Label htmlFor="bulk-mode">複数タスクを作成</Label>
              </div>
            )}

            {bulkMode && !editingTodoId ? (
              <div className="space-y-2">
                <Label>タスクリスト</Label>
                <Textarea
                  value={bulkTitles}
                  onChange={(event) => setBulkTitles(event.target.value)}
                  placeholder={'1行につき1件\n候補を調べる\n提案書を作る\n詳細を確認する'}
                  rows={6}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>タイトル</Label>
                <Input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
              </div>
            )}

            <div className="space-y-2">
              <Label>説明</Label>
              <Textarea value={newDescription} onChange={(event) => setNewDescription(event.target.value)} rows={3} />
            </div>

            <div className="grid gap-3">
              <div className="space-y-2">
                <Label>タスク粒度</Label>
                <Select value={newTaskLevel} onValueChange={(value) => setNewTaskLevel(value as TodoTaskLevel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="large">大タスク</SelectItem>
                    <SelectItem value="medium">中タスク</SelectItem>
                    <SelectItem value="small">小タスク</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>開始日</Label>
                <Input type="date" value={newStartDate} onChange={(event) => setNewStartDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>終了日</Label>
                <Input type="date" value={newEndDate} onChange={(event) => setNewEndDate(event.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>優先度</Label>
                <Select value={newPriority} onValueChange={(value) => setNewPriority(value || 'medium')}>
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
                <Select value={newAssignee} onValueChange={(value) => setNewAssignee(value || 'shared')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shared">共有</SelectItem>
                    <SelectItem value="me">{user?.display_name || '自分'}</SelectItem>
                    {partner && <SelectItem value="partner">{partner.display_name}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              {editingTodoId && (
                <Button type="button" variant="outline" className="flex-1" onClick={handleDeleteTodo}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  削除
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                className="flex-1"
                disabled={createTodo.isPending || createTodos.isPending || updateTodo.isPending || deleteTodo.isPending}
              >
                {editingTodoId ? '更新' : 'タスクを作成'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">タスク一覧</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {flatTodoRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">タスクはまだありません。</p>
          ) : (
            flatTodoRows.map((todo) => {
              const StatusIcon = statusIcons[todo.status as keyof typeof statusIcons] || Circle
              const range = getTodoRange(todo)
              const isOverdue = range && todo.status !== 'done' && isBefore(new Date(`${range.endDate}T23:59:59`), today)

              return (
                <div key={todo.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <button
                    type="button"
                    onClick={() => cycleStatus(todo.id, todo.status)}
                    className="mt-0.5 shrink-0"
                    aria-label="ステータスを切り替え"
                  >
                    <StatusIcon
                      className={cn(
                        'h-5 w-5',
                        todo.status === 'done'
                          ? 'text-primary'
                          : todo.status === 'in_progress'
                            ? 'text-[var(--color-info)]'
                            : 'text-muted-foreground'
                      )}
                    />
                  </button>

                  <button type="button" onClick={() => openEditDialog(todo)} className="min-w-0 flex-1 text-left">
                    <p className={cn('truncate text-sm font-medium', todo.status === 'done' && 'line-through opacity-60')}>
                      {todo.title}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <Badge className={cn('text-[10px]', taskLevelColors[todo.task_level as TodoTaskLevel])}>
                        {taskLevelLabels[todo.task_level as TodoTaskLevel]}
                      </Badge>
                      <Badge className={cn('text-[10px]', priorityColors[todo.priority])}>
                        {priorityLabels[todo.priority]}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {todo.assigned_to === user?.id
                          ? user?.display_name || '自分'
                          : todo.assigned_to === partner?.id
                            ? partner?.display_name || 'パートナー'
                            : '共有'}
                      </Badge>
                    </div>
                    <p className={cn('mt-2 text-xs text-muted-foreground', isOverdue && 'text-destructive')}>
                      {formatTodoPeriod(todo.start_date, todo.end_date, todo.due_date)}
                    </p>
                  </button>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {todoMetrics.recentDone.length > 0 && (
        <Card tone="navy">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">完了ログ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {todoMetrics.recentDone.map((todo) => (
              <div key={todo.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium line-through opacity-70">{todo.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {todo.completed_at ? format(new Date(todo.completed_at), 'yyyy/MM/dd HH:mm') : '完了'}
                  </p>
                </div>
                <Badge variant="outline">完了</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={ideaDialogOpen} onOpenChange={setIdeaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingIdeaId ? 'アイデアを編集' : 'アイデアを追加'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>タイトル</Label>
              <Input value={ideaTitle} onChange={(event) => setIdeaTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>メモ</Label>
              <Textarea value={ideaMemo} onChange={(event) => setIdeaMemo(event.target.value)} rows={4} />
            </div>
            <div className="flex gap-2">
              {editingIdeaId && (
                <Button type="button" variant="outline" className="flex-1" onClick={handleDeleteIdea}>
                  <Trash2 className="mr-1 h-4 w-4" />削除</Button>
              )}
              <Button
                onClick={handleIdeaSubmit}
                className="flex-1"
                disabled={createIdeaItem.isPending || updateIdeaItem.isPending || deleteIdeaItem.isPending}
              >
                {editingIdeaId ? '更新' : '作成'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">アイデア</h2>
          <Button size="sm" variant="outline" onClick={openCreateIdeaDialog}>
            <Plus className="mr-1 h-4 w-4" />
            アイデアを追加
          </Button>
        </div>

        <Card tone="blue">
          <CardContent className="p-0">
            {activeIdeas.length === 0 && doneIdeas.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">アイデアはまだありません。</p>
            ) : (
              <div className="space-y-2">
                {activeIdeas.map((idea) => (
                  <div key={idea.id} className="flex items-start gap-3 rounded-md p-3 transition-colors hover:bg-muted/50">
                    <button onClick={() => toggleIdeaStatus(idea)} className="shrink-0 pt-0.5">
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    </button>
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openEditIdeaDialog(idea)}>
                      <p className="truncate text-sm font-medium">{idea.title}</p>
                      {idea.memo && <p className="text-xs text-muted-foreground">{idea.memo}</p>}
                    </button>
                  </div>
                ))}

                {doneIdeas.length > 0 && (
                  <details className="px-3 pb-3 pt-1">
                    <summary className="cursor-pointer text-xs text-muted-foreground">完了（{doneIdeas.length}）</summary>
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
