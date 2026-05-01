'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { Calendar, Flame, CheckSquare, TrendingUp, Wallet } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getBudgetLimitTotal, getLifePlanMonthlyBudget } from '@/lib/budget-utils'
import { enumerateDateKeys, eventOverlapsDateRange, getJstDayRange, getTodayJstDateKey } from '@/lib/date-utils'
import { LIVING_MODE_LABELS } from '@/lib/finance/constants'
import { formatYen } from '@/lib/finance/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useBudget, useBudgetMemberLimits } from '@/lib/hooks/use-budgets'
import { useCalendarEvents } from '@/lib/hooks/use-calendar-events'
import { useMonthlyExpenseSummary } from '@/lib/hooks/use-expenses'
import { useLifePlanConfig } from '@/lib/hooks/use-life-plan'
import { useTodos } from '@/lib/hooks/use-todos'
import { buildTodoProgressSummary } from '@/lib/todo-progress'

function formatEventTime(startAt: string, endAt?: string | null, allDay?: boolean) {
  if (allDay) return 'All day'
  return `${format(new Date(startAt), 'HH:mm')}${endAt ? ` - ${format(new Date(endAt), 'HH:mm')}` : ''}`
}

export default function HomePage() {
  const { user, couple } = useAuth()
  const today = new Date()
  const monthStr = format(today, 'yyyy-MM')
  const lifePlanConfig = useLifePlanConfig(couple?.id)
  const todayKey = getTodayJstDateKey()
  const weekDateKeys = useMemo(
    () => enumerateDateKeys(todayKey, format(new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')),
    [today, todayKey]
  )
  const weekRange = useMemo(() => getJstDayRange(weekDateKeys[weekDateKeys.length - 1]), [weekDateKeys])

  const { data: events } = useCalendarEvents(
    couple?.id,
    getJstDayRange(todayKey).start.toISOString(),
    weekRange.end.toISOString()
  )
  const { data: todos } = useTodos(couple?.id)
  const { data: summary } = useMonthlyExpenseSummary(couple?.id, monthStr)
  const { data: budget } = useBudget(couple?.id, monthStr)
  const { data: budgetMemberLimits } = useBudgetMemberLimits(budget?.id)
  const lifePlanBudget = getLifePlanMonthlyBudget(lifePlanConfig, monthStr)
  const budgetLimit = getBudgetLimitTotal(budget, budgetMemberLimits) || lifePlanBudget.total

  const remainingBudget = budgetLimit > 0 ? budgetLimit - (summary?.total || 0) : null

  const groupedUpcomingEvents = useMemo(
    () =>
      weekDateKeys
        .map((dateKey) => ({
          dateKey,
          items: (events || []).filter((event) => eventOverlapsDateRange(event.start_at, event.end_at, dateKey)),
        }))
        .filter((group) => group.items.length > 0),
    [events, weekDateKeys]
  )

  const todoProgress = useMemo(() => buildTodoProgressSummary(todos || [], today), [today, todos])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {user?.display_name || 'User'}</h1>
          <p className="text-muted-foreground">{format(today, 'yyyy/MM/dd')}</p>
        </div>
        {couple?.living_mode && (
          <Badge className="border border-[var(--color-info)]/20 bg-[var(--color-info-soft)] text-[var(--color-info)]">
            {LIVING_MODE_LABELS[couple.living_mode as keyof typeof LIVING_MODE_LABELS] ?? 'Not set'}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Done today</CardTitle>
            <CheckSquare className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todoProgress.doneToday}</div>
            <p className="mt-1 text-xs text-muted-foreground">Tasks completed today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Done this week</CardTitle>
            <TrendingUp className="h-4 w-4 text-[var(--color-info)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todoProgress.doneThisWeek}</div>
            <p className="mt-1 text-xs text-muted-foreground">Tasks completed this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Current streak</CardTitle>
            <Flame className="h-4 w-4 text-[var(--color-expense)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todoProgress.currentStreak} days</div>
            <p className="mt-1 text-xs text-muted-foreground">Consecutive days with completed tasks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completion rate</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todoProgress.completionRate}%</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {todoProgress.doneCount} done / {todoProgress.total} total
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${todoProgress.completionRate}%` }} />
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
            {todoProgress.doneCount > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={todoProgress.dailySeries}>
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
            {todoProgress.recentDone.length > 0 ? (
              <div className="space-y-3">
                {todoProgress.recentDone.map((todo) => (
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

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weekly pace</CardTitle>
          </CardHeader>
          <CardContent>
            {todoProgress.doneCount > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={todoProgress.weeklySeries}>
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
            <CardTitle className="text-base">Task momentum</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">In progress</p>
              <p className="mt-1 text-2xl font-semibold">{todoProgress.inProgressCount}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Open tasks</p>
              <p className="mt-1 text-2xl font-semibold">{todoProgress.activeCount}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Done this month</p>
              <p className="mt-1 text-2xl font-semibold">{todoProgress.doneThisMonth}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Finance snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">This month spend</p>
                <Wallet className="h-4 w-4 text-[var(--color-expense)]" />
              </div>
              <p className="mt-1 text-xl font-semibold">{formatYen(summary?.total || 0)}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Budget left</p>
              <p className={`mt-1 text-xl font-semibold ${remainingBudget !== null && remainingBudget < 0 ? 'text-destructive' : 'text-primary'}`}>
                {remainingBudget !== null ? formatYen(remainingBudget) : 'Not set'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {groupedUpcomingEvents.length > 0 ? (
            <div className="space-y-3">
              {groupedUpcomingEvents.map((group) => (
                <div key={group.dateKey} className="rounded-lg border p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      {format(new Date(`${group.dateKey}T00:00:00+09:00`), 'MM/dd')}
                    </p>
                    <Badge variant="outline">{group.items.length}</Badge>
                  </div>

                  <div className="space-y-3">
                    {group.items.map((event) => (
                      <div key={`${group.dateKey}-${event.id}`} className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
                        <div className="mt-1 h-8 w-1 rounded-full" style={{ backgroundColor: event.color || '#3B82F6' }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{event.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatEventTime(event.start_at, event.end_at, event.all_day)}
                          </p>
                          {event.location && <p className="mt-1 text-xs text-muted-foreground">{event.location}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming events in the next 7 days.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
