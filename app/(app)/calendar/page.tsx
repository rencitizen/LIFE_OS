'use client'

import { useState } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useCalendarEvents } from '@/lib/hooks/use-calendar-events'
import { useCalendarStore } from '@/stores/calendar-store'

const eventTypeColors: Record<string, string> = {
  life: 'bg-blue-500',
  financial: 'bg-green-500',
  anniversary: 'bg-pink-500',
  medical: 'bg-red-500',
  travel: 'bg-purple-500',
}

export default function CalendarPage() {
  const { couple } = useAuth()
  const { selectedDate, view, setSelectedDate, setView } = useCalendarStore()
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const { data: events } = useCalendarEvents(
    couple?.id,
    calendarStart.toISOString(),
    calendarEnd.toISOString()
  )

  const getEventsForDay = (day: Date) =>
    events?.filter((e) => isSameDay(new Date(e.start_at), day)) || []

  const selectedDayEvents = getEventsForDay(selectedDate)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">カレンダー</h1>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as 'month' | 'week')}>
            <TabsList>
              <TabsTrigger value="month">月</TabsTrigger>
              <TabsTrigger value="week">週</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            予定追加
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-base">
            {format(currentMonth, 'yyyy年M月', { locale: ja })}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b">
            {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
              <div key={day} className="py-2 text-center text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const dayEvents = getEventsForDay(day)
              const isSelected = isSameDay(day, selectedDate)
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    'min-h-[60px] sm:min-h-[80px] p-1 border-b border-r text-left transition-colors hover:bg-muted/50',
                    !isSameMonth(day, currentMonth) && 'text-muted-foreground/50',
                    isSelected && 'bg-primary/5 ring-1 ring-primary'
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
                      isToday(day) && 'bg-primary text-primary-foreground font-bold'
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  <div className="mt-0.5 space-y-0.5">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className={cn(
                          'text-[10px] leading-tight truncate rounded px-1',
                          eventTypeColors[event.event_type] || 'bg-blue-500',
                          'text-white'
                        )}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{dayEvents.length - 2}件
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected day events */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">
            {format(selectedDate, 'M月d日（E）', { locale: ja })}の予定
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedDayEvents.length > 0 ? (
            <div className="space-y-3">
              {selectedDayEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50">
                  <div className={cn('w-1 h-full min-h-[40px] rounded-full', eventTypeColors[event.event_type] || 'bg-blue-500')} />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.all_day ? '終日' : `${format(new Date(event.start_at), 'HH:mm')}${event.end_at ? ` - ${format(new Date(event.end_at), 'HH:mm')}` : ''}`}
                    </p>
                    {event.location && (
                      <p className="text-xs text-muted-foreground mt-0.5">{event.location}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">{event.event_type}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">この日の予定はありません</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
