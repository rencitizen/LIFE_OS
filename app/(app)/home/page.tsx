'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { format } from 'date-fns'
import {
  ArrowRight,
  Bot,
  Calendar,
  CheckSquare,
  CircleAlert,
  Lightbulb,
  ShoppingCart,
  Wallet,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { enumerateDateKeys, eventOverlapsDateRange, getJstDayRange, getTodayJstDateKey } from '@/lib/date-utils'
import { formatYen } from '@/lib/finance/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useBudget } from '@/lib/hooks/use-budgets'
import { useCalendarEvents } from '@/lib/hooks/use-calendar-events'
import { useExpenses } from '@/lib/hooks/use-expenses'
import { useRecentLifeActivity, type LifeActivity } from '@/lib/hooks/use-life-activity'
import { useMonthlySettlementPreview } from '@/lib/hooks/use-settlements'
import { useTodos } from '@/lib/hooks/use-todos'

function getTaskAnchorDate(startDate?: string | null, dueDate?: string | null, endDate?: string | null) {
  return startDate ?? dueDate ?? endDate ?? null
}

function formatTaskWindow(startDate?: string | null, dueDate?: string | null, endDate?: string | null) {
  const from = startDate ?? dueDate ?? endDate
  const to = endDate ?? dueDate ?? startDate
  if (!from) return '日付なし'
  if (from === to) return from
  return `${from} - ${to}`
}

function formatEventTime(startAt: string, endAt?: string | null, allDay?: boolean) {
  if (allDay) return '終日'
  return `${format(new Date(startAt), 'HH:mm')}${endAt ? ` - ${format(new Date(endAt), 'HH:mm')}` : ''}`
}

const MODULE_META: Record<LifeActivity['module'], { label: string; href: string }> = {
  finance: { label: '家計', href: '/finance/dashboard' },
  todo: { label: 'タスク', href: '/todos' },
  calendar: { label: 'カレンダー', href: '/calendar' },
  shopping: { label: '買い物', href: '/shopping' },
  ideas: { label: '思考', href: '/ideas' },
}

function activityActionLabel(activity: LifeActivity) {
  if (activity.module === 'finance') {
    if (activity.action === 'create_expense') return '支出を登録'
    if (activity.action === 'update_expense') return '支出を更新'
    if (activity.action === 'complete_settlement') return '精算を完了'
    if (activity.action === 'update_split_profile') return '負担割合を更新'
  }
  if (activity.action === 'create') return '登録'
  if (activity.action === 'update') return '更新'
  if (activity.action === 'complete') return '完了'
  if (activity.action === 'delete') return '削除'
  return activity.action.replaceAll('_', ' ')
}

function moduleIcon(module: LifeActivity['module']) {
  if (module === 'finance') return Wallet
  if (module === 'todo') return CheckSquare
  if (module === 'calendar') return Calendar
  if (module === 'shopping') return ShoppingCart
  return Lightbulb
}

export default function HomePage() {
  const { user, couple } = useAuth()
  const todayKey = getTodayJstDateKey()
  const monthStr = todayKey.slice(0, 7)
  const weekDateKeys = useMemo(() => {
    const today = new Date(`${todayKey}T00:00:00+09:00`)
    const end = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000)
    return enumerateDateKeys(todayKey, format(end, 'yyyy-MM-dd'))
  }, [todayKey])
  const weekEndKey = weekDateKeys[weekDateKeys.length - 1]
  const weekRange = useMemo(() => getJstDayRange(weekEndKey), [weekEndKey])

  const { data: events } = useCalendarEvents(
    couple?.id,
    getJstDayRange(todayKey).start.toISOString(),
    weekRange.end.toISOString()
  )
  const { data: todos } = useTodos(couple?.id)
  const { data: expenses } = useExpenses(couple?.id, monthStr)
  const { data: budget } = useBudget(couple?.id, monthStr)
  const { data: settlement } = useMonthlySettlementPreview(user?.id, monthStr)
  const { data: lifeActivity } = useRecentLifeActivity(couple?.id, 8)

  const todayEvents = useMemo(
    () => (events || []).filter((event) => eventOverlapsDateRange(event.start_at, event.end_at, todayKey)),
    [events, todayKey]
  )

  const openTodos = useMemo(() => (todos || []).filter((todo) => todo.status !== 'done'), [todos])
  const overdueTodos = useMemo(
    () => openTodos.filter((todo) => {
      const anchor = getTaskAnchorDate(todo.start_date, todo.due_date, todo.end_date)
      return Boolean(anchor && anchor < todayKey)
    }),
    [openTodos, todayKey]
  )
  const todayTodos = useMemo(
    () => openTodos.filter((todo) => getTaskAnchorDate(todo.start_date, todo.due_date, todo.end_date) === todayKey),
    [openTodos, todayKey]
  )
  const upcomingTodos = useMemo(
    () => openTodos
      .filter((todo) => {
        const anchor = getTaskAnchorDate(todo.start_date, todo.due_date, todo.end_date)
        return Boolean(anchor && anchor > todayKey && anchor <= weekEndKey)
      })
      .sort((a, b) => {
        const left = getTaskAnchorDate(a.start_date, a.due_date, a.end_date) || '9999-12-31'
        const right = getTaskAnchorDate(b.start_date, b.due_date, b.end_date) || '9999-12-31'
        return left.localeCompare(right)
      }),
    [openTodos, todayKey, weekEndKey]
  )

  const groupedUpcomingEvents = useMemo(
    () => weekDateKeys
      .map((dateKey) => ({
        dateKey,
        items: (events || []).filter((event) => eventOverlapsDateRange(event.start_at, event.end_at, dateKey)),
      }))
      .filter((group) => group.items.length > 0),
    [events, weekDateKeys]
  )

  const todayExpense = useMemo(
    () => (expenses || [])
      .filter((expense) => expense.expense_date === todayKey)
      .reduce((sum, expense) => sum + Number(expense.amount), 0),
    [expenses, todayKey]
  )
  const monthExpense = useMemo(
    () => (expenses || []).reduce((sum, expense) => sum + Number(expense.amount), 0),
    [expenses]
  )
  const budgetLimit = Number(budget?.total_limit || 0)
  const budgetRemaining = budgetLimit > 0 ? budgetLimit - monthExpense : null

  const attentionCount = overdueTodos.length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">今日のまとめ</h1>
            <Badge variant="outline" className="gap-1">
              <Bot className="h-3 w-3" /> ChatGPT連携中
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{todayKey} · LIFE_OSは会話から更新されています。</p>
        </div>
        {attentionCount > 0 && (
          <Badge className="gap-1 bg-amber-500/10 text-amber-700 hover:bg-amber-500/10">
            <CircleAlert className="h-3.5 w-3.5" /> 要確認 {attentionCount}件
          </Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link href="/calendar" className="block">
          <Card tone="cyan" className="h-full transition-transform hover:-translate-y-0.5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">今日の予定</CardTitle>
              <Calendar className="h-4 w-4 text-[var(--color-info)]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{todayEvents.length}</div>
              <p className="mt-1 text-xs text-muted-foreground">今後7日間は {events?.length || 0}件</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/todos" className="block">
          <Card tone="navy" className="h-full transition-transform hover:-translate-y-0.5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">今日のタスク</CardTitle>
              <CheckSquare className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{todayTodos.length}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {overdueTodos.length > 0 ? `期限超過 ${overdueTodos.length}件` : '期限超過なし'}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/finance/dashboard" className="block">
          <Card tone="blue" className="h-full transition-transform hover:-translate-y-0.5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">今日の支出</CardTitle>
              <Wallet className="h-4 w-4 text-[var(--color-expense)]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatYen(todayExpense)}</div>
              <p className="mt-1 text-xs text-muted-foreground">今月 {formatYen(monthExpense)}</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/finance/dashboard" className="block">
          <Card tone="cyan" className="h-full transition-transform hover:-translate-y-0.5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">家計の余力</CardTitle>
              <Wallet className="h-4 w-4 text-[var(--color-info)]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {budgetRemaining !== null ? formatYen(budgetRemaining) : '予算未設定'}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                精算 {formatYen(settlement?.amount || 0)} · {settlement?.expense_count || 0}件
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>今日と次の予定</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">今後7日間の流れ</p>
            </div>
            <Link href="/calendar" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
              カレンダー <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {groupedUpcomingEvents.length > 0 ? (
              <div className="space-y-4">
                {groupedUpcomingEvents.slice(0, 4).map((group) => (
                  <div key={group.dateKey}>
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">
                      {group.dateKey === todayKey ? '今日' : format(new Date(`${group.dateKey}T00:00:00+09:00`), 'MM/dd')}
                    </p>
                    <div className="space-y-2">
                      {group.items.slice(0, 3).map((event) => (
                        <div key={`${group.dateKey}-${event.id}`} className="flex items-start gap-3 rounded-lg border p-3">
                          <div className="mt-1 h-8 w-1 rounded-full bg-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{event.title}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{formatEventTime(event.start_at, event.end_at, event.all_day)}</p>
                            {event.location && <p className="mt-0.5 truncate text-xs text-muted-foreground">{event.location}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">今後7日間の予定はありません。</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>いまやること</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">期限超過 → 今日 → 今週の順</p>
            </div>
            <Link href="/todos" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
              タスク <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {[...overdueTodos, ...todayTodos, ...upcomingTodos].length > 0 ? (
              <div className="space-y-2">
                {[...overdueTodos, ...todayTodos, ...upcomingTodos].slice(0, 8).map((todo) => {
                  const anchor = getTaskAnchorDate(todo.start_date, todo.due_date, todo.end_date)
                  const overdue = Boolean(anchor && anchor < todayKey)
                  const today = anchor === todayKey
                  return (
                    <div key={todo.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{todo.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatTaskWindow(todo.start_date, todo.due_date, todo.end_date)}</p>
                      </div>
                      <Badge variant={overdue ? 'destructive' : today ? 'default' : 'secondary'}>
                        {overdue ? '期限超過' : today ? '今日' : '今週'}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">今週対応するタスクはありません。</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2"><Bot className="h-4 w-4" /> ChatGPTからの更新</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">会話からLIFE_OSへ反映された直近の操作</p>
            </div>
            <Badge variant="outline">反映済み</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {lifeActivity && lifeActivity.length > 0 ? (
            <div className="divide-y">
              {lifeActivity.map((activity) => {
                const meta = MODULE_META[activity.module]
                const Icon = moduleIcon(activity.module)
                return (
                  <Link
                    key={`${activity.module}-${activity.id}`}
                    href={meta.href}
                    className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="mt-0.5 rounded-full bg-muted p-2"><Icon className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{meta.label}</Badge>
                        <p className="text-sm font-semibold">{activityActionLabel(activity)}</p>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {activity.rawInput || 'ChatGPTから更新'}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{format(new Date(activity.createdAt), 'MM/dd HH:mm')}</span>
                  </Link>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">ChatGPTからの更新履歴はまだありません。</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}