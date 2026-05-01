'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
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

function formatTodoPeriod(startDate?: string | null, endDate?: string | null, dueDate?: string | null) {
  const from = startDate ?? dueDate
  const to = endDate ?? from
  if (!from) return 'No date'
  if (from === to) return from
  return `${from} - ${to}`
}

function formatEventTime(startAt: string, endAt?: string | null, allDay?: boolean) {
  if (allDay) return 'All day'
  return `${format(new Date(startAt), 'HH:mm')}${endAt ? ` - ${format(new Date(endAt), 'HH:mm')}` : ''}`
}

export default function HomePage() {
  const { user, couple, partner } = useAuth()
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

  const todoSummary = useMemo(() => {
    const rows = todos || []
    const done = rows.filter((todo) => todo.status === 'done')
    const active = rows.filter((todo) => todo.status !== 'done')
    const inProgress = rows.filter((todo) => todo.status === 'in_progress')

    return {
      total: rows.length,
      active,
      done,
      inProgress,
      completionRate: rows.length > 0 ? Math.round((done.length / rows.length) * 100) : 0,
      recentDone: [...done]
        .sort((a, b) => (b.completed_at || b.created_at).localeCompare(a.completed_at || a.created_at))
        .slice(0, 5),
    }
  }, [todos])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{user?.display_name || 'User'}さん、おかえりなさい</h1>
          <p className="text-muted-foreground">{format(today, 'yyyy年M月d日 EEEE', { locale: ja })}</p>
        </div>
        {couple?.living_mode && (
          <Badge className="border border-[var(--color-info)]/20 bg-[var(--color-info-soft)] text-[var(--color-info)]">
            {LIVING_MODE_LABELS[couple.living_mode as keyof typeof LIVING_MODE_LABELS] ?? '未設定'}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Next 7 days</CardTitle>
            <Calendar className="h-4 w-4 text-[var(--color-info)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{events?.length || 0}件</div>
            {events?.[0] && <p className="mt-1 truncate text-xs text-muted-foreground">{events[0].title}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">TODO progress</CardTitle>
            <CheckSquare className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todoSummary.total}件</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {todoSummary.active.length} active / {todoSummary.done.length} done
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${todoSummary.completionRate}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">This month spend</CardTitle>
            <Wallet className="h-4 w-4 text-[var(--color-expense)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatYen(summary?.total || 0)}</div>
            <p className="mt-1 text-xs text-muted-foreground">{summary?.count || 0}件の支出</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Budget left</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {remainingBudget !== null ? (
              <>
                <div className={`text-2xl font-bold ${remainingBudget < 0 ? 'text-destructive' : 'text-primary'}`}>
                  {formatYen(remainingBudget)}
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[var(--color-expense)] transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, ((summary?.total || 0) / budgetLimit) * 100))}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">予算未設定</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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
                        {format(new Date(`${group.dateKey}T00:00:00+09:00`), 'M月d日 EEE', { locale: ja })}
                      </p>
                      <Badge variant="outline">{group.items.length}件</Badge>
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
              <p className="text-sm text-muted-foreground">直近1週間の予定はありません</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Task accumulation</CardTitle>
          </CardHeader>
          <CardContent>
            {todoSummary.total > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Active</p>
                    <p className="mt-1 text-xl font-semibold">{todoSummary.active.length}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">In progress</p>
                    <p className="mt-1 text-xl font-semibold">{todoSummary.inProgress.length}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Done</p>
                    <p className="mt-1 text-xl font-semibold">{todoSummary.done.length}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {todoSummary.active.slice(0, 3).map((todo) => (
                    <div key={todo.id} className="flex items-start gap-3 rounded-lg border p-3">
                      <div
                        className={`mt-1 h-2.5 w-2.5 rounded-full ${
                          todo.priority === 'high'
                            ? 'bg-destructive'
                            : todo.priority === 'medium'
                              ? 'bg-[var(--color-expense)]'
                              : 'bg-[var(--color-info)]'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{todo.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTodoPeriod(todo.start_date, todo.end_date, todo.due_date)}
                        </p>
                      </div>
                      {todo.assigned_to && (
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {todo.assigned_to === user?.id ? '自分' : partner?.display_name || 'パートナー'}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>

                {todoSummary.recentDone.length > 0 && (
                  <div className="rounded-lg border border-dashed p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Recent done</p>
                      <Badge variant="outline">{todoSummary.completionRate}%</Badge>
                    </div>
                    <div className="space-y-2">
                      {todoSummary.recentDone.map((todo) => (
                        <div key={todo.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckSquare className="h-4 w-4 text-primary" />
                          <span className="truncate line-through">{todo.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">まだTODOはありません</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
