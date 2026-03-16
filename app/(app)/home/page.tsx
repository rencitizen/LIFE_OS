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
  if (!from) return '日付未設定'
  if (from === to) return from
  return `${from} - ${to}`
}

function formatEventTime(startAt: string, endAt?: string | null, allDay?: boolean) {
  if (allDay) return '終日'
  return `${format(new Date(startAt), 'HH:mm')}${endAt ? ` - ${format(new Date(endAt), 'HH:mm')}` : ''}`
}

export default function HomePage() {
  const { user, couple, partner } = useAuth()
  const today = new Date()
  const monthStr = format(today, 'yyyy-MM')
  const lifePlanConfig = useLifePlanConfig(couple?.id)
  const todayKey = getTodayJstDateKey()
  const weekDateKeys = useMemo(() => enumerateDateKeys(todayKey, format(new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')), [today, todayKey])
  const weekRange = useMemo(() => getJstDayRange(weekDateKeys[weekDateKeys.length - 1]), [weekDateKeys])

  const { data: events } = useCalendarEvents(
    couple?.id,
    getJstDayRange(todayKey).start.toISOString(),
    weekRange.end.toISOString()
  )
  const { data: todos } = useTodos(couple?.id, { status: 'pending' })
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{user?.display_name || 'User'}さん、おかえりなさい</h1>
          <p className="text-muted-foreground">{format(today, 'yyyy年M月d日 EEEE', { locale: ja })}</p>
        </div>
        {couple?.living_mode && (
          <Badge className="border border-[var(--color-info)]/20 bg-[var(--color-info-soft)] text-[var(--color-info)]">
            {LIVING_MODE_LABELS[couple.living_mode as keyof typeof LIVING_MODE_LABELS] ?? '同棲前'}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">1週間の予定</CardTitle>
            <Calendar className="h-4 w-4 text-[var(--color-info)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{events?.length || 0}件</div>
            {events?.[0] && <p className="mt-1 truncate text-xs text-muted-foreground">{events[0].title}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">未完了のTODO</CardTitle>
            <CheckSquare className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todos?.length || 0}件</div>
            {todos?.[0] && <p className="mt-1 truncate text-xs text-muted-foreground">{todos[0].title}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">今月の支出</CardTitle>
            <Wallet className="h-4 w-4 text-[var(--color-expense)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatYen(summary?.total || 0)}</div>
            <p className="mt-1 text-xs text-muted-foreground">{summary?.count || 0}件の支出</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">予算残り</CardTitle>
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
            <CardTitle className="text-base">今日から1週間のスケジュール</CardTitle>
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
              <p className="text-sm text-muted-foreground">今日から1週間の予定はありません</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">やることリスト</CardTitle>
          </CardHeader>
          <CardContent>
            {todos && todos.length > 0 ? (
              <div className="space-y-3">
                {todos.slice(0, 5).map((todo) => (
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
            ) : (
              <p className="text-sm text-muted-foreground">未完了のTODOはありません</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
