'use client'

import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, CheckSquare, ShoppingCart, Wallet, TrendingUp } from 'lucide-react'
import { useAuth } from '@/lib/hooks/use-auth'
import { useCalendarEvents } from '@/lib/hooks/use-calendar-events'
import { useTodos } from '@/lib/hooks/use-todos'
import { useMonthlyExpenseSummary } from '@/lib/hooks/use-expenses'
import { useBudget } from '@/lib/hooks/use-budgets'

export default function HomePage() {
  const { user, couple, partner } = useAuth()
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const monthStr = format(today, 'yyyy-MM')

  const { data: events } = useCalendarEvents(
    couple?.id,
    `${todayStr}T00:00:00`,
    `${todayStr}T23:59:59`
  )
  const { data: todos } = useTodos(couple?.id, { status: 'pending' })
  const { data: summary } = useMonthlyExpenseSummary(couple?.id, monthStr)
  const { data: budget } = useBudget(couple?.id, monthStr)

  const remainingBudget = budget?.total_limit
    ? Number(budget.total_limit) - (summary?.total || 0)
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          おかえり、{user?.display_name || 'ユーザー'}さん
        </h1>
        <p className="text-muted-foreground">
          {format(today, 'yyyy年M月d日（E）', { locale: ja })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Today's Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">今日の予定</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{events?.length || 0}件</div>
            {events && events.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {events[0].title}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Pending TODOs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">未完了のTODO</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todos?.length || 0}件</div>
            {todos && todos.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {todos[0].title}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Monthly Expenses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">今月の支出</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? `¥${summary.total.toLocaleString()}` : '¥0'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.count || 0}件の支出
            </p>
          </CardContent>
        </Card>

        {/* Remaining Budget */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">残予算</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {remainingBudget !== null ? (
              <>
                <div className={`text-2xl font-bold ${remainingBudget < 0 ? 'text-destructive' : ''}`}>
                  ¥{remainingBudget.toLocaleString()}
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, ((summary?.total || 0) / Number(budget!.total_limit)) * 100))}%`,
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-muted-foreground">未設定</div>
                <p className="text-xs text-muted-foreground mt-1">予算を設定しましょう</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Today's Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">今日のスケジュール</CardTitle>
          </CardHeader>
          <CardContent>
            {events && events.length > 0 ? (
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="flex items-center gap-3">
                    <div
                      className="w-1 h-8 rounded-full"
                      style={{ backgroundColor: event.color || '#4F46E5' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.all_day
                          ? '終日'
                          : format(new Date(event.start_at), 'HH:mm')}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {event.event_type}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">予定はありません</p>
            )}
          </CardContent>
        </Card>

        {/* Pending TODOs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">やることリスト</CardTitle>
          </CardHeader>
          <CardContent>
            {todos && todos.length > 0 ? (
              <div className="space-y-3">
                {todos.slice(0, 5).map((todo) => (
                  <div key={todo.id} className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        todo.priority === 'high'
                          ? 'bg-destructive'
                          : todo.priority === 'medium'
                          ? 'bg-yellow-500'
                          : 'bg-muted-foreground'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{todo.title}</p>
                    </div>
                    {todo.assigned_to && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {todo.assigned_to === user?.id ? '自分' : partner?.display_name || 'パートナー'}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">未完了のタスクはありません</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
