'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { Calendar, Flame, CheckSquare, TrendingUp } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/hooks/use-auth'
import { useTodos } from '@/lib/hooks/use-todos'
import { buildTodoProgressSummary } from '@/lib/todo-progress'

export default function HabitsPage() {
  const { user, couple } = useAuth()
  const today = new Date()
  const { data: todos } = useTodos(couple?.id)
  const progress = useMemo(() => buildTodoProgressSummary(todos || [], today), [today, todos])

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">習慣ビュー</h1>
        <p className="text-sm text-muted-foreground">
          完了したタスクから作成した進捗: {user?.display_name || 'ユーザー'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card tone="mint">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">今日完了</CardTitle>
            <CheckSquare className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{progress.doneToday}</div>
            <p className="mt-1 text-xs text-muted-foreground">今日完了したタスク</p>
          </CardContent>
        </Card>

        <Card tone="cyan">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">今週完了</CardTitle>
            <TrendingUp className="h-4 w-4 text-[var(--color-info)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{progress.doneThisWeek}</div>
            <p className="mt-1 text-xs text-muted-foreground">今週完了したタスク</p>
          </CardContent>
        </Card>

        <Card tone="blue">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">連続達成</CardTitle>
            <Flame className="h-4 w-4 text-[var(--color-expense)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{progress.currentStreak}日</div>
            <p className="mt-1 text-xs text-muted-foreground">タスク完了が続いている日数</p>
          </CardContent>
        </Card>

        <Card tone="navy">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">完了率</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{progress.completionRate}%</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {progress.doneCount}件完了 / {progress.total}件合計
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress.completionRate}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card tone="cyan">
          <CardHeader>
            <CardTitle className="text-base">日別の完了推移</CardTitle>
          </CardHeader>
          <CardContent>
            {progress.doneCount > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={progress.dailySeries}>
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
          <CardHeader>
            <CardTitle className="text-base">最近の完了</CardTitle>
          </CardHeader>
          <CardContent>
            {progress.recentDone.length > 0 ? (
              <div className="space-y-3">
                {progress.recentDone.map((todo) => (
                  <div key={todo.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium line-through opacity-70">{todo.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {todo.completed_at ? format(new Date(todo.completed_at), 'MM/dd HH:mm') : '完了'}
                        </p>
                      </div>
                      <Badge variant="outline">完了</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">完了したタスクはまだありません。</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card tone="blue">
          <CardHeader>
            <CardTitle className="text-base">週別ペース</CardTitle>
          </CardHeader>
          <CardContent>
            {progress.doneCount > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={progress.weeklySeries}>
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

        <Card tone="navy">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">進捗</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">進行中</p>
              <p className="mt-1 text-2xl font-semibold">{progress.inProgressCount}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">未完了タスク</p>
              <p className="mt-1 text-2xl font-semibold">{progress.activeCount}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">今月完了</p>
              <p className="mt-1 text-2xl font-semibold">{progress.doneThisMonth}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
