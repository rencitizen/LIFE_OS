'use client'

import { useState } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useCalendarEvents, useCreateCalendarEvent, useDeleteCalendarEvent } from '@/lib/hooks/use-calendar-events'
import { useCalendarStore } from '@/stores/calendar-store'
import { toast } from 'sonner'

const eventTypeColors: Record<string, string> = {
  life: 'bg-[#85B59B]',
  financial: 'bg-[#1E5945]',
  anniversary: 'bg-[#133929]',
  medical: 'bg-destructive',
  travel: 'bg-[#1E5945]/70',
}

const eventTypeLabels: Record<string, string> = {
  life: '生活',
  financial: '家計',
  anniversary: '記念日',
  medical: '医療',
  travel: '旅行',
}

type FilterMode = 'all' | 'mine' | 'partner'

export default function CalendarPage() {
  const { user, couple, partner } = useAuth()
  const { selectedDate, view, setSelectedDate, setView } = useCalendarStore()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [filter, setFilter] = useState<FilterMode>('all')
  const [dialogOpen, setDialogOpen] = useState(false)

  // Form state
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [newEndTime, setNewEndTime] = useState('')
  const [newAllDay, setNewAllDay] = useState(true)
  const [newEventType, setNewEventType] = useState('life')
  const [newLocation, setNewLocation] = useState('')

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
  const createEvent = useCreateCalendarEvent()
  const deleteEvent = useDeleteCalendarEvent()

  // Filter events by creator
  const filteredEvents = events?.filter((e) => {
    if (filter === 'mine') return e.created_by === user?.id
    if (filter === 'partner') return e.created_by === partner?.id
    return true
  })

  const getEventsForDay = (day: Date) =>
    filteredEvents?.filter((e) => isSameDay(new Date(e.start_at), day)) || []

  const selectedDayEvents = getEventsForDay(selectedDate)

  const openCreateDialog = () => {
    setNewDate(format(selectedDate, 'yyyy-MM-dd'))
    setNewTitle('')
    setNewDescription('')
    setNewTime('')
    setNewEndTime('')
    setNewAllDay(true)
    setNewEventType('life')
    setNewLocation('')
    setDialogOpen(true)
  }

  const handleCreate = async () => {
    if (!newTitle) { toast.error('タイトルを入力してください'); return }
    if (!newDate) { toast.error('日付を選択してください'); return }
    if (!user?.id) { toast.error('ログインが必要です'); return }
    if (!couple?.id) { toast.error('先にカップルを作成または参加してください'); return }
    try {
      const startAt = newAllDay
        ? new Date(`${newDate}T00:00:00`).toISOString()
        : new Date(`${newDate}T${newTime || '09:00'}`).toISOString()
      const endAt = !newAllDay && newEndTime
        ? new Date(`${newDate}T${newEndTime}`).toISOString()
        : undefined

      await createEvent.mutateAsync({
        couple_id: couple.id,
        created_by: user.id,
        title: newTitle,
        description: newDescription || undefined,
        start_at: startAt,
        end_at: endAt,
        all_day: newAllDay,
        event_type: newEventType,
        location: newLocation || undefined,
        visibility: 'shared',
      })
      setDialogOpen(false)
      toast.success('予定を追加しました')
    } catch {
      toast.error('予定の追加に失敗しました')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteEvent.mutateAsync(id)
      toast.success('予定を削除しました')
    } catch {
      toast.error('削除に失敗しました')
    }
  }

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
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-1" />
            予定追加
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1">
        {([
          ['all', 'すべて'],
          ['mine', user?.display_name || '自分'],
          ['partner', partner?.display_name || 'パートナー'],
        ] as [FilterMode, string][]).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={filter === key ? 'default' : 'outline'}
            onClick={() => setFilter(key)}
            className="text-xs"
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Create Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>予定を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>タイトル</Label>
              <Input
                placeholder="予定のタイトル"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>日付</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={newAllDay} onCheckedChange={setNewAllDay} />
              <Label>終日</Label>
            </div>
            {!newAllDay && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>開始時刻</Label>
                  <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>終了時刻</Label>
                  <Input type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>タイプ</Label>
              <Select value={newEventType} onValueChange={(v) => v && setNewEventType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(eventTypeLabels).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>場所</Label>
              <Input placeholder="場所（任意）" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>メモ</Label>
              <Textarea placeholder="メモ（任意）" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={2} />
            </div>
            <Button onClick={handleCreate} className="w-full" disabled={createEvent.isPending}>
              追加
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                          eventTypeColors[event.event_type] || 'bg-[#85B59B]',
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
        <CardHeader className="py-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {format(selectedDate, 'M月d日（E）', { locale: ja })}の予定
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {selectedDayEvents.length > 0 ? (
            <div className="space-y-3">
              {selectedDayEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 group">
                  <div className={cn('w-1 h-full min-h-[40px] rounded-full', eventTypeColors[event.event_type] || 'bg-[#85B59B]')} />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.all_day ? '終日' : `${format(new Date(event.start_at), 'HH:mm')}${event.end_at ? ` - ${format(new Date(event.end_at), 'HH:mm')}` : ''}`}
                    </p>
                    {event.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                    )}
                    {event.location && (
                      <p className="text-xs text-muted-foreground mt-0.5">📍 {event.location}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs shrink-0">
                      {eventTypeLabels[event.event_type] || event.event_type}
                    </Badge>
                    {event.created_by === user?.id && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDelete(event.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
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
