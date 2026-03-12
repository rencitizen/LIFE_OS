'use client'

import { useState } from 'react'
import { Plus, Circle, Clock, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/hooks/use-auth'
import { useTodos, useCreateTodo, useUpdateTodo } from '@/lib/hooks/use-todos'
import { cn } from '@/lib/utils'

const statusIcons = {
  pending: Circle,
  in_progress: Clock,
  done: CheckCircle2,
}

const priorityLabels: Record<string, string> = { high: '高', medium: '中', low: '低' }
const priorityColors: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-muted text-muted-foreground',
}

export default function TodosPage() {
  const { user, couple, partner } = useAuth()
  const { data: allTodos } = useTodos(couple?.id)
  const createTodo = useCreateTodo()
  const updateTodo = useUpdateTodo()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState('medium')
  const [newAssignee, setNewAssignee] = useState('shared')

  const handleCreate = async () => {
    if (!newTitle || !couple?.id || !user?.id) return
    await createTodo.mutateAsync({
      couple_id: couple.id,
      created_by: user.id,
      title: newTitle,
      priority: newPriority,
      assigned_to: newAssignee === 'shared' ? undefined : newAssignee === 'me' ? user.id : partner?.id,
    })
    setNewTitle('')
    setDialogOpen(false)
  }

  const cycleStatus = async (todoId: string, current: string) => {
    const next = current === 'pending' ? 'in_progress' : current === 'in_progress' ? 'done' : 'pending'
    await updateTodo.mutateAsync({
      id: todoId,
      status: next,
      completed_at: next === 'done' ? new Date().toISOString() : null,
    })
  }

  const filterTodos = (tab: string) => {
    if (!allTodos) return []
    switch (tab) {
      case 'mine': return allTodos.filter((t) => t.assigned_to === user?.id)
      case 'partner': return allTodos.filter((t) => t.assigned_to === partner?.id)
      case 'shared': return allTodos.filter((t) => !t.assigned_to)
      default: return allTodos
    }
  }

  const renderTodoList = (todos: typeof allTodos) => {
    if (!todos || todos.length === 0) {
      return <p className="text-sm text-muted-foreground p-4">タスクはありません</p>
    }

    const pending = todos.filter((t) => t.status !== 'done')
    const done = todos.filter((t) => t.status === 'done')

    return (
      <div className="space-y-2">
        {pending.map((todo) => {
          const StatusIcon = statusIcons[todo.status as keyof typeof statusIcons] || Circle
          return (
            <div key={todo.id} className="flex items-center gap-3 p-3 rounded-md hover:bg-muted/50 transition-colors">
              <button onClick={() => cycleStatus(todo.id, todo.status)} className="shrink-0">
                <StatusIcon className={cn('h-5 w-5', todo.status === 'in_progress' ? 'text-blue-500' : 'text-muted-foreground')} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{todo.title}</p>
                {todo.due_date && (
                  <p className="text-xs text-muted-foreground">
                    期限: {format(new Date(todo.due_date), 'M/d')}
                  </p>
                )}
              </div>
              <Badge className={cn('text-xs', priorityColors[todo.priority])}>
                {priorityLabels[todo.priority]}
              </Badge>
            </div>
          )
        })}
        {done.length > 0 && (
          <details className="pt-2">
            <summary className="text-xs text-muted-foreground cursor-pointer">
              完了済み ({done.length}件)
            </summary>
            <div className="space-y-1 mt-2">
              {done.map((todo) => (
                <div key={todo.id} className="flex items-center gap-3 p-2 opacity-50">
                  <button onClick={() => cycleStatus(todo.id, todo.status)}>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </button>
                  <p className="text-sm line-through">{todo.title}</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">TODO</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={<Button size="sm" />}
          >
            <Plus className="h-4 w-4 mr-1" />
            タスク追加
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新しいタスク</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>タイトル</Label>
                <Input
                  placeholder="やること..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>優先度</Label>
                <Select value={newPriority} onValueChange={(v) => v && setNewPriority(v)}>
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
                <Select value={newAssignee} onValueChange={(v) => v && setNewAssignee(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shared">共有</SelectItem>
                    <SelectItem value="me">{user?.display_name || '自分'}</SelectItem>
                    {partner && <SelectItem value="partner">{partner.display_name}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={createTodo.isPending}>
                作成
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
              <CardContent className="p-0">
                {renderTodoList(filterTodos(tab))}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
