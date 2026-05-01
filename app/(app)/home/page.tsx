'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { Calendar, CheckSquare, TrendingUp, Wallet } from 'lucide-react'
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

function getTaskAnchorDate(startDate?: string | null, dueDate?: string | null, endDate?: string | null) {
  return startDate ?? dueDate ?? endDate ?? null
}

function formatTaskWindow(startDate?: string | null, dueDate?: string | null, endDate?: string | null) {
  const from = startDate ?? dueDate ?? endDate
  const to = endDate ?? dueDate ?? startDate
  if (!from) return 'No date'
  if (from === to) return from
  return `${from} - ${to}`
}

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

  const upcomingTasks = useMemo(() => {
    const start = todayKey
    const end = weekDateKeys[weekDateKeys.length - 1]

    return (todos || [])
      .filter((todo) => todo.status !== 'done')
      .filter((todo) => {
        const anchor = getTaskAnchorDate(todo.start_date, todo.due_date, todo.end_date)
        return !!anchor && anchor >= start && anchor <= end
      })
      .sort((a, b) => {
        const left = getTaskAnchorDate(a.start_date, a.due_date, a.end_date) || '9999-12-31'
        const right = getTaskAnchorDate(b.start_date, b.due_date, b.end_date) || '9999-12-31'
        if (left !== right) return left.localeCompare(right)
        return a.created_at.localeCompare(b.created_at)
      })
      .slice(0, 6)
  }, [todayKey, todos, weekDateKeys])

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
        <Card tone="sky">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Upcoming events</CardTitle>
            <Calendar className="h-4 w-4 text-[var(--color-info)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{events?.length || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">Events in the next 7 days</p>
          </CardContent>
        </Card>

        <Card tone="violet">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Upcoming tasks</CardTitle>
            <CheckSquare className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingTasks.length}</div>
            <p className="mt-1 text-xs text-muted-foreground">Tasks scheduled from today through the next 7 days</p>
          </CardContent>
        </Card>

        <Card tone="amber">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">This month spend</CardTitle>
            <Wallet className="h-4 w-4 text-[var(--color-expense)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatYen(summary?.total || 0)}</div>
            <p className="mt-1 text-xs text-muted-foreground">{summary?.count || 0} transactions this month</p>
          </CardContent>
        </Card>

        <Card tone="mint">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Budget left</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {remainingBudget !== null ? (
              <div className={`text-2xl font-bold ${remainingBudget < 0 ? 'text-destructive' : 'text-primary'}`}>
                {formatYen(remainingBudget)}
              </div>
            ) : (
              <div className="text-2xl font-bold">Not set</div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Budget remaining this month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card tone="sky">
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

        <Card tone="violet">
          <CardHeader>
            <CardTitle className="text-base">Upcoming tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingTasks.length > 0 ? (
              upcomingTasks.map((todo) => (
                <div key={todo.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{todo.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatTaskWindow(todo.start_date, todo.due_date, todo.end_date)}</p>
                    </div>
                    <Badge variant={todo.status === 'in_progress' ? 'default' : 'outline'}>
                      {todo.status === 'in_progress' ? 'in progress' : 'pending'}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No tasks scheduled between today and the next 7 days.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
