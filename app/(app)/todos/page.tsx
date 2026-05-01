'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isBefore,
  isSameDay,
  startOfToday,
  subMonths,
} from 'date-fns'
import { CheckCircle2, Circle, Clock, Plus, Trash2 } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { IdeaItem, InsertTables, Todo, TodoTaskLevel } from '@/types'

const statusIcons = {
  pending: Circle,
  in_progress: Clock,
  done: CheckCircle2,
}

const priorityLabels: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const priorityColors: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive',
  medium: 'bg-[var(--color-expense-soft)] text-[var(--color-expense)]',
  low: 'bg-[var(--color-info-soft)] text-[var(--color-info)]',
}

const taskLevelLabels: Record<TodoTaskLevel, string> = {
  large: 'Large',
  medium: 'Medium',
  small: 'Small',
}

const taskLevelColors: Record<TodoTaskLevel, string> = {
  large: 'bg-slate-900 text-white',
  medium: 'bg-slate-200 text-slate-700',
  small: 'bg-white text-slate-700 border border-slate-200',
}

const taskLevelRank: Record<TodoTaskLevel, number> = {
  large: 0,
  medium: 1,
  small: 2,
}

const filterLabels = {
  all: 'All',
  mine: 'Mine',
  partner: 'Partner',
  shared: 'Shared',
} as const

const CELL_WIDTH = 28
const LEFT_COLUMN_WIDTH = 320

type FilterMode = keyof typeof filterLabels

type TodoTreeRow = {
  todo: Todo
  depth: number
  hasChildren: boolean
  childCount: number
  ancestorTitles: string[]
}

function formatTodoPeriod(startDate?: string | null, endDate?: string | null, dueDate?: string | null) {
  const from = startDate ?? dueDate
  const to = endDate ?? dueDate ?? startDate
  if (!from) return 'No date'
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

function canAssignParent(parentLevel: TodoTaskLevel, childLevel: TodoTaskLevel) {
  if (childLevel === 'large') return false
  if (childLevel === 'medium') return parentLevel === 'large'
  return parentLevel === 'large' || parentLevel === 'medium'
}

function collectDescendantIds(todoId: string, childrenMap: Map<string, Todo[]>, result = new Set<string>()) {
  const children = childrenMap.get(todoId) || []
  for (const child of children) {
    if (result.has(child.id)) continue
    result.add(child.id)
    collectDescendantIds(child.id, childrenMap, result)
  }
  return result
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
  const [newParentTodoId, setNewParentTodoId] = useState('')
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
  const [ideaDialogOpen, setIdeaDialogOpen] = useState(false)
  const [ideaTitle, setIdeaTitle] = useState('')
  const [ideaMemo, setIdeaMemo] = useState('')
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null)

  const today = startOfToday()
  const timelineStart = subMonths(today, 1)
  const timelineEnd = addMonths(today, 2)

  const timelineDays = useMemo(
    () => eachDayOfInterval({ start: timelineStart, end: timelineEnd }),
    [timelineEnd, timelineStart]
  )

  const monthSegments = useMemo(() => {
    const result: { key: string; label: string; startIndex: number; span: number }[] = []

    timelineDays.forEach((day, index) => {
      const key = format(day, 'yyyy-MM')
      const last = result[result.length - 1]
      if (!last || last.key !== key) {
        result.push({
          key,
          label: format(day, 'yyyy MMM'),
          startIndex: index,
          span: 1,
        })
        return
      }

      last.span += 1
    })

    return result
  }, [timelineDays])

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
    setNewParentTodoId('')
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
    setNewParentTodoId(todo.parent_todo_id || '')
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

  const filteredTodoMap = useMemo(
    () => new Map(filteredTodos.map((todo) => [todo.id, todo])),
    [filteredTodos]
  )

  const allChildrenMap = useMemo(() => {
    const map = new Map<string, Todo[]>()
    for (const todo of allTodos || []) {
      if (!todo.parent_todo_id) continue
      const siblings = map.get(todo.parent_todo_id) || []
      siblings.push(todo)
      map.set(todo.parent_todo_id, siblings)
    }
    return map
  }, [allTodos])

  const visibleChildrenMap = useMemo(() => {
    const map = new Map<string | null, Todo[]>()

    for (const todo of filteredTodos) {
      const visibleParentId = todo.parent_todo_id && filteredTodoMap.has(todo.parent_todo_id) ? todo.parent_todo_id : null
      const siblings = map.get(visibleParentId) || []
      siblings.push(todo)
      map.set(visibleParentId, siblings)
    }

    return map
  }, [filteredTodoMap, filteredTodos])

  const treeRows = useMemo(() => {
    const rows: TodoTreeRow[] = []
    const visited = new Set<string>()

    const getAncestorTitles = (todo: Todo) => {
      const titles: string[] = []
      const seen = new Set<string>()
      let parentId = todo.parent_todo_id

      while (parentId && filteredTodoMap.has(parentId) && !seen.has(parentId)) {
        seen.add(parentId)
        const parent = filteredTodoMap.get(parentId)
        if (!parent) break
        titles.unshift(parent.title)
        parentId = parent.parent_todo_id
      }

      return titles
    }

    const visit = (todo: Todo, depth: number) => {
      if (visited.has(todo.id)) return
      visited.add(todo.id)

      const children = [...(visibleChildrenMap.get(todo.id) || [])].sort(compareTodos)
      rows.push({
        todo,
        depth,
        hasChildren: children.length > 0,
        childCount: children.length,
        ancestorTitles: getAncestorTitles(todo),
      })

      children.forEach((child) => visit(child, depth + 1))
    }

    const roots = [...(visibleChildrenMap.get(null) || [])].sort(compareTodos)
    roots.forEach((todo) => visit(todo, 0))

    filteredTodos
      .filter((todo) => !visited.has(todo.id))
      .sort(compareTodos)
      .forEach((todo) => visit(todo, 0))

    return rows
  }, [filteredTodoMap, filteredTodos, visibleChildrenMap])

  const parentOptions = useMemo(() => {
    const childLevel = newTaskLevel
    const blockedIds = editingTodoId ? collectDescendantIds(editingTodoId, allChildrenMap) : new Set<string>()
    if (editingTodoId) blockedIds.add(editingTodoId)

    return (allTodos || [])
      .filter((todo) => !blockedIds.has(todo.id))
      .filter((todo) => canAssignParent(todo.task_level as TodoTaskLevel, childLevel))
      .sort(compareTodos)
  }, [allChildrenMap, allTodos, editingTodoId, newTaskLevel])

  useEffect(() => {
    if (!newParentTodoId) return
    if (!parentOptions.some((todo) => todo.id === newParentTodoId)) {
      setNewParentTodoId('')
    }
  }, [newParentTodoId, parentOptions])

  const todoCounts = useMemo(() => {
    const rows = filteredTodos
    return {
      total: rows.length,
      done: rows.filter((todo) => todo.status === 'done').length,
      active: rows.filter((todo) => todo.status !== 'done').length,
      inProgress: rows.filter((todo) => todo.status === 'in_progress').length,
    }
  }, [filteredTodos])

  const todoMetrics = useMemo(() => {
    const rows = filteredTodos
    const completionRate = rows.length > 0 ? Math.round((todoCounts.done / rows.length) * 100) : 0
    const recentDone = [...rows]
      .filter((todo) => todo.status === 'done')
      .sort((a, b) => (b.completed_at || b.created_at).localeCompare(a.completed_at || a.created_at))
      .slice(0, 5)

    return {
      completionRate,
      recentDone,
    }
  }, [filteredTodos, todoCounts.done])

  const handleSubmit = async () => {
    if (!user?.id || !couple?.id) return toast.error('Account context is missing')
    if (editingTodoId) {
      if (!newTitle.trim()) return toast.error('Title is required')
    } else if (bulkMode) {
      if (!bulkTitles.trim()) return toast.error('Enter one task per line')
    } else if (!newTitle.trim()) {
      return toast.error('Title is required')
    }

    const parentTodo = newParentTodoId ? allTodos?.find((todo) => todo.id === newParentTodoId) : null
    if (newParentTodoId && !parentTodo) {
      return toast.error('Selected parent task is no longer available')
    }
    if (parentTodo && !canAssignParent(parentTodo.task_level as TodoTaskLevel, newTaskLevel)) {
      return toast.error('The selected parent cannot contain this task level')
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
        parent_todo_id: newParentTodoId || null,
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
      setNewParentTodoId('')
      toast.success(editingTodoId ? 'Task updated' : bulkMode ? 'Tasks created' : 'Task created')
    } catch {
      toast.error(editingTodoId ? 'Failed to update task' : 'Failed to save task')
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
      toast.error('Failed to update status')
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
      setNewParentTodoId('')
      toast.success('Task deleted')
    } catch {
      toast.error('Failed to delete task')
    }
  }

  const handleIdeaSubmit = async () => {
    if (!ideaTitle.trim()) return toast.error('Title is required')
    if (!user?.id || !couple?.id) return toast.error('Account context is missing')

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
      toast.success(editingIdeaId ? 'Idea updated' : 'Idea created')
    } catch {
      toast.error(editingIdeaId ? 'Failed to update idea' : 'Failed to create idea')
    }
  }

  const toggleIdeaStatus = async (idea: IdeaItem) => {
    try {
      await updateIdeaItem.mutateAsync({
        id: idea.id,
        status: idea.status === 'done' ? 'active' : 'done',
      })
    } catch {
      toast.error('Failed to update idea')
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
      toast.success('Idea deleted')
    } catch {
      toast.error('Failed to delete idea')
    }
  }

  const activeIdeas = (ideaItems || []).filter((idea) => idea.status !== 'done')
  const doneIdeas = (ideaItems || []).filter((idea) => idea.status === 'done')

  const gridTemplateColumns = `${LEFT_COLUMN_WIDTH}px repeat(${timelineDays.length}, ${CELL_WIDTH}px)`
  const totalGridWidth = LEFT_COLUMN_WIDTH + timelineDays.length * CELL_WIDTH

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">TODO Timeline</h1>
          <p className="text-sm text-muted-foreground">
            {format(timelineStart, 'yyyy/MM/dd')} - {format(timelineEnd, 'yyyy/MM/dd')} centered on today
          </p>
        </div>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="mr-1 h-4 w-4" />
          Add task
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
        <Badge variant="outline">{todoCounts.total} tasks</Badge>
        <Badge variant="outline">{todoCounts.active} active</Badge>
        <Badge variant="outline">{todoCounts.done} done</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="mt-1 text-2xl font-semibold">{todoCounts.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="mt-1 text-2xl font-semibold">{todoCounts.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">In progress</p>
            <p className="mt-1 text-2xl font-semibold">{todoCounts.inProgress}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Completion</p>
            <p className="mt-1 text-2xl font-semibold">{todoMetrics.completionRate}%</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${todoMetrics.completionRate}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTodoId ? 'Edit task' : 'Add task'}</DialogTitle>
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
                <Label htmlFor="bulk-mode">Create multiple tasks</Label>
              </div>
            )}

            {bulkMode && !editingTodoId ? (
              <div className="space-y-2">
                <Label>Task list</Label>
                <Textarea
                  value={bulkTitles}
                  onChange={(event) => setBulkTitles(event.target.value)}
                  placeholder={'One task per line\nResearch options\nDraft proposal\nReview details'}
                  rows={6}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
              </div>
            )}

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={newDescription} onChange={(event) => setNewDescription(event.target.value)} rows={3} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Task level</Label>
                <Select value={newTaskLevel} onValueChange={(value) => setNewTaskLevel(value as TodoTaskLevel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="large">Large task</SelectItem>
                    <SelectItem value="medium">Medium task</SelectItem>
                    <SelectItem value="small">Small task</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Parent task</Label>
                <Select
                  value={newParentTodoId || 'none'}
                  onValueChange={(value) => setNewParentTodoId(!value || value === 'none' ? '' : value)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No parent</SelectItem>
                    {parentOptions.map((todo) => (
                      <SelectItem key={todo.id} value={todo.id}>
                        {taskLevelLabels[todo.task_level as TodoTaskLevel]} / {todo.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input type="date" value={newStartDate} onChange={(event) => setNewStartDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <Input type="date" value={newEndDate} onChange={(event) => setNewEndDate(event.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={newPriority} onValueChange={(value) => setNewPriority(value || 'medium')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assignee</Label>
                <Select value={newAssignee} onValueChange={(value) => setNewAssignee(value || 'shared')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shared">Shared</SelectItem>
                    <SelectItem value="me">{user?.display_name || 'Me'}</SelectItem>
                    {partner && <SelectItem value="partner">{partner.display_name}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              {editingTodoId && (
                <Button type="button" variant="outline" className="flex-1" onClick={handleDeleteTodo}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                className="flex-1"
                disabled={createTodo.isPending || createTodos.isPending || updateTodo.isPending || deleteTodo.isPending}
              >
                {editingTodoId ? 'Update' : bulkMode ? 'Create tasks' : 'Create task'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Gantt view</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {treeRows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No tasks yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-fit" style={{ width: totalGridWidth }}>
                <div className="grid border-b bg-muted/30" style={{ gridTemplateColumns }}>
                  <div className="sticky left-0 z-30 border-r bg-background px-4 py-3 text-sm font-medium">
                    Task
                  </div>
                  {monthSegments.map((segment) => (
                    <div
                      key={segment.key}
                      className="border-r px-2 py-2 text-center text-xs font-medium text-muted-foreground"
                      style={{ gridColumn: `${segment.startIndex + 2} / span ${segment.span}` }}
                    >
                      {segment.label}
                    </div>
                  ))}
                </div>

                <div className="grid border-b bg-background/80" style={{ gridTemplateColumns }}>
                  <div className="sticky left-0 z-20 border-r bg-background px-4 py-2 text-xs text-muted-foreground">
                    Hierarchy
                  </div>
                  {timelineDays.map((day, index) => (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'border-r px-1 py-2 text-center text-[10px] text-muted-foreground',
                        isSameDay(day, today) && 'bg-primary/10 font-semibold text-primary'
                      )}
                      style={{ gridColumn: index + 2 }}
                    >
                      <div>{format(day, 'd')}</div>
                      <div>{format(day, 'EEEEE')}</div>
                    </div>
                  ))}
                </div>

                {treeRows.map(({ todo, depth, hasChildren, childCount, ancestorTitles }) => {
                  const StatusIcon = statusIcons[todo.status as keyof typeof statusIcons] || Circle
                  const range = getTodoRange(todo)
                  const timelineVisible =
                    range &&
                    !(range.endDate < format(timelineStart, 'yyyy-MM-dd') || range.startDate > format(timelineEnd, 'yyyy-MM-dd'))
                  const startIndex = range
                    ? Math.max(0, differenceInCalendarDays(new Date(`${range.startDate}T00:00:00`), timelineStart))
                    : 0
                  const endIndex = range
                    ? Math.min(
                        timelineDays.length - 1,
                        differenceInCalendarDays(new Date(`${range.endDate}T00:00:00`), timelineStart)
                      )
                    : 0
                  const isOverdue = range && todo.status !== 'done' && isBefore(new Date(`${range.endDate}T23:59:59`), today)

                  return (
                    <div key={todo.id} className="grid border-b last:border-b-0" style={{ gridTemplateColumns }}>
                      <div className="sticky left-0 z-10 flex min-h-[64px] items-center border-r bg-background px-3 py-2 hover:bg-muted/40">
                        <div className="flex w-full items-start gap-3">
                          <div className="relative mt-0.5 h-5 shrink-0" style={{ width: Math.max(12, depth * 18 + 12) }}>
                            {Array.from({ length: depth }).map((_, index) => (
                              <span
                                key={`${todo.id}-branch-${index}`}
                                className="absolute top-[-10px] bottom-[-28px] w-px bg-border"
                                style={{ left: index * 18 + 8 }}
                              />
                            ))}
                            {depth > 0 && (
                              <>
                                <span
                                  className="absolute h-px bg-border"
                                  style={{ left: (depth - 1) * 18 + 8, top: 10, width: 12 }}
                                />
                                <span
                                  className="absolute w-px bg-border"
                                  style={{ left: (depth - 1) * 18 + 8, top: -10, height: 20 }}
                                />
                              </>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              cycleStatus(todo.id, todo.status)
                            }}
                            className="mt-0.5 shrink-0"
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
                            {ancestorTitles.length > 0 && (
                              <p className="truncate text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                                {ancestorTitles.join(' / ')}
                              </p>
                            )}
                            <div className="flex items-center gap-2">
                              <p className={cn('truncate text-sm font-medium', todo.status === 'done' && 'line-through opacity-60')}>
                                {todo.title}
                              </p>
                              {hasChildren && (
                                <span className="text-xs text-muted-foreground">
                                  {depth === 0 ? 'Root' : 'Parent'} {childCount > 0 ? `(${childCount})` : ''}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              <Badge className={cn('text-[10px]', taskLevelColors[todo.task_level as TodoTaskLevel])}>
                                {taskLevelLabels[todo.task_level as TodoTaskLevel]}
                              </Badge>
                              <Badge className={cn('text-[10px]', priorityColors[todo.priority])}>
                                {priorityLabels[todo.priority]}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {todo.assigned_to === user?.id
                                  ? user?.display_name || 'Me'
                                  : todo.assigned_to === partner?.id
                                    ? partner?.display_name || 'Partner'
                                    : 'Shared'}
                              </Badge>
                            </div>
                            <p className={cn('mt-1 text-xs text-muted-foreground', isOverdue && 'text-destructive')}>
                              {formatTodoPeriod(todo.start_date, todo.end_date, todo.due_date)}
                            </p>
                          </button>
                        </div>
                      </div>

                      {timelineDays.map((day, index) => (
                        <div
                          key={`${todo.id}-${day.toISOString()}`}
                          className={cn(
                            'min-h-[64px] border-r',
                            isSameDay(day, today) && 'bg-primary/5'
                          )}
                          style={{ gridColumn: index + 2 }}
                        />
                      ))}

                      {range && timelineVisible ? (
                        <button
                          type="button"
                          onClick={() => openEditDialog(todo)}
                          className={cn(
                            'z-[1] mx-0.5 my-3 flex items-center rounded-md px-2 text-left text-[11px] font-medium text-white shadow-sm',
                            todo.status === 'done' && 'opacity-60'
                          )}
                          style={{
                            gridColumn: `${startIndex + 2} / ${endIndex + 3}`,
                            backgroundColor:
                              todo.task_level === 'large'
                                ? '#0f172a'
                                : todo.task_level === 'medium'
                                  ? '#475569'
                                  : '#64748b',
                          }}
                        >
                          <span className="truncate">{todo.title}</span>
                        </button>
                      ) : (
                        <div
                          className="z-[1] flex items-center px-3 text-xs text-muted-foreground"
                          style={{ gridColumn: `2 / span ${timelineDays.length}` }}
                        >
                          {range ? 'Outside current window' : 'No date set'}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {todoMetrics.recentDone.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Completed log</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {todoMetrics.recentDone.map((todo) => (
              <div key={todo.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium line-through opacity-70">{todo.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {todo.completed_at ? format(new Date(todo.completed_at), 'yyyy/MM/dd HH:mm') : 'Completed'}
                  </p>
                </div>
                <Badge variant="outline">done</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={ideaDialogOpen} onOpenChange={setIdeaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingIdeaId ? 'Edit idea' : 'Add idea'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={ideaTitle} onChange={(event) => setIdeaTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Memo</Label>
              <Textarea value={ideaMemo} onChange={(event) => setIdeaMemo(event.target.value)} rows={4} />
            </div>
            <div className="flex gap-2">
              {editingIdeaId && (
                <Button type="button" variant="outline" className="flex-1" onClick={handleDeleteIdea}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete
                </Button>
              )}
              <Button
                onClick={handleIdeaSubmit}
                className="flex-1"
                disabled={createIdeaItem.isPending || updateIdeaItem.isPending || deleteIdeaItem.isPending}
              >
                {editingIdeaId ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Ideas</h2>
          <Button size="sm" variant="outline" onClick={openCreateIdeaDialog}>
            <Plus className="mr-1 h-4 w-4" />
            Add idea
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {activeIdeas.length === 0 && doneIdeas.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No ideas yet.</p>
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
                    <summary className="cursor-pointer text-xs text-muted-foreground">Done ({doneIdeas.length})</summary>
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
