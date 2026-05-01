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
        <h1 className="text-2xl font-bold">Habit view</h1>
        <p className="text-sm text-muted-foreground">
          Progress built from completed TODOs for {user?.display_name || 'User'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Done today</CardTitle>
            <CheckSquare className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{progress.doneToday}</div>
            <p className="mt-1 text-xs text-muted-foreground">Tasks completed today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Done this week</CardTitle>
            <TrendingUp className="h-4 w-4 text-[var(--color-info)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{progress.doneThisWeek}</div>
            <p className="mt-1 text-xs text-muted-foreground">Tasks completed this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Current streak</CardTitle>
            <Flame className="h-4 w-4 text-[var(--color-expense)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{progress.currentStreak} days</div>
            <p className="mt-1 text-xs text-muted-foreground">Consecutive days with completed tasks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completion rate</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{progress.completionRate}%</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {progress.doneCount} done / {progress.total} total
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress.completionRate}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily completion trend</CardTitle>
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
                    <Bar dataKey="count" fill="#85A392" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Complete a few tasks to start building your daily trend.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent wins</CardTitle>
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
                          {todo.completed_at ? format(new Date(todo.completed_at), 'MM/dd HH:mm') : 'Completed'}
                        </p>
                      </div>
                      <Badge variant="outline">done</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No completed tasks yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weekly pace</CardTitle>
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
                    <Bar dataKey="count" fill="#F59E0B" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Weekly bars appear after you build up completion history.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Momentum</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">In progress</p>
              <p className="mt-1 text-2xl font-semibold">{progress.inProgressCount}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Open tasks</p>
              <p className="mt-1 text-2xl font-semibold">{progress.activeCount}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Done this month</p>
              <p className="mt-1 text-2xl font-semibold">{progress.doneThisMonth}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
