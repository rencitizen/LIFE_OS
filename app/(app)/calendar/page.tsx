'use client'

import { useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { enumerateDateKeys, eventOverlapsDateRange, getJstDateKey } from '@/lib/date-utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { getJapaneseHolidayMap, getJapaneseHolidayName } from '@/lib/japanese-holidays'
import {
  useCalendarEvents,
  useCreateCalendarEvent,
  useCreateCalendarEvents,
  useDeleteCalendarEvent,
  useUpdateCalendarEvent,
} from '@/lib/hooks/use-calendar-events'
import { cn } from '@/lib/utils'
import { useCalendarStore } from '@/stores/calendar-store'
import { toast } from 'sonner'
import type { CalendarEvent, InsertTables } from '@/types'

type FilterMode = 'all' | 'mine' | 'partner'
type VisibilityMode = 'shared' | 'private'
type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly'

type MonthEventSegment = {
  event: CalendarEvent
  startIndex: number
  endIndex: number
  startsThisWeek: boolean
  endsThisWeek: boolean
}

const visibilityLabels: Record<VisibilityMode, string> = {
  shared: '共有',
  private: '個人',
}

const recurrenceLabels: Record<RecurrenceFrequency, string> = {
  daily: '毎日',
  weekly: '毎週',
  monthly: '毎月',
}

const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, index) => {
  const hour = String(Math.floor(index / 4)).padStart(2, '0')
  const minute = String((index % 4) * 15).padStart(2, '0')
  return `${hour}:${minute}`
})

function toStartIso(date: string, time?: string) {
  return new Date(`${date}T${time || '00:00'}:00+09:00`).toISOString()
}

function toEndIso(date: string, time?: string, allDay = false) {
  if (allDay) return new Date(`${date}T23:59:59.999+09:00`).toISOString()
  return new Date(`${date}T${time || '23:59'}:00+09:00`).toISOString()
}

function addByFrequency(date: Date, frequency: RecurrenceFrequency) {
  if (frequency === 'daily') return addDays(date, 1)
  if (frequency === 'weekly') return addWeeks(date, 1)
  return addMonths(date, 1)
}

function formatEventTime(event: CalendarEvent) {
  if (event.all_day) return '終日'
  const start = format(new Date(event.start_at), 'M/d HH:mm')
  if (!event.end_at) return start
  return `${start} - ${format(new Date(event.end_at), 'M/d HH:mm')}`
}

function chunkDays(days: Date[], size: number) {
  const chunks: Date[][] = []
  for (let index = 0; index < days.length; index += size) {
    chunks.push(days.slice(index, index + size))
  }
  return chunks
}

function getEventStartKey(event: CalendarEvent) {
  return getJstDateKey(event.start_at)
}

function getEventEndKey(event: CalendarEvent) {
  return event.end_at ? getJstDateKey(event.end_at) : getEventStartKey(event)
}

function clampDateKey(dateKey: string, minKey: string, maxKey: string) {
  if (dateKey < minKey) return minKey
  if (dateKey > maxKey) return maxKey
  return dateKey
}

function buildMonthEventRows(week: Date[], events: CalendarEvent[]) {
  const weekStartKey = getJstDateKey(week[0])
  const weekEndKey = getJstDateKey(week[week.length - 1])
  const rows: MonthEventSegment[][] = []

  const weekEvents = events
    .filter((event) => getEventStartKey(event) <= weekEndKey && getEventEndKey(event) >= weekStartKey)
    .sort((a, b) => {
      const startCompare = getEventStartKey(a).localeCompare(getEventStartKey(b))
      if (startCompare !== 0) return startCompare

      const endCompare = getEventEndKey(b).localeCompare(getEventEndKey(a))
      if (endCompare !== 0) return endCompare

      return a.title.localeCompare(b.title)
    })

  for (const event of weekEvents) {
    const startKey = getEventStartKey(event)
    const endKey = getEventEndKey(event)
    const visibleStartKey = clampDateKey(startKey, weekStartKey, weekEndKey)
    const visibleEndKey = clampDateKey(endKey, weekStartKey, weekEndKey)
    const startIndex = week.findIndex((day) => getJstDateKey(day) === visibleStartKey)
    const endIndex = week.findIndex((day) => getJstDateKey(day) === visibleEndKey)

    if (startIndex < 0 || endIndex < 0) continue

    const segment: MonthEventSegment = {
      event,
      startIndex,
      endIndex,
      startsThisWeek: startKey === visibleStartKey,
      endsThisWeek: endKey === visibleEndKey,
    }

    let rowIndex = rows.findIndex((row) =>
      row.every((item) => item.endIndex < segment.startIndex || item.startIndex > segment.endIndex)
    )

    if (rowIndex === -1) {
      rows.push([])
      rowIndex = rows.length - 1
    }

    rows[rowIndex].push(segment)
  }

  return rows
}

export default function CalendarPage() {
  const { user, couple, partner } = useAuth()
  const { selectedDate, view, setSelectedDate, setView } = useCalendarStore()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [filter, setFilter] = useState<FilterMode>('all')
  const [dialogOpen, setDialogOpen] = useState(false)

  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newStartDate, setNewStartDate] = useState('')
  const [newEndDate, setNewEndDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [newEndTime, setNewEndTime] = useState('')
  const [newAllDay, setNewAllDay] = useState(true)
  const [newLocation, setNewLocation] = useState('')
  const [newVisibility, setNewVisibility] = useState<VisibilityMode>('shared')
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [newIsRecurring, setNewIsRecurring] = useState(false)
  const [newRecurrenceFrequency, setNewRecurrenceFrequency] = useState<RecurrenceFrequency>('weekly')
  const [newRecurrenceEndDate, setNewRecurrenceEndDate] = useState('')

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  const monthWeeks = useMemo(() => chunkDays(days, 7), [days])

  const weekStart = startOfWeek(selectedDate)
  const weekEnd = endOfWeek(selectedDate)
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const { data: events } = useCalendarEvents(
    couple?.id,
    (view === 'week' ? weekStart : calendarStart).toISOString(),
    (view === 'week' ? weekEnd : calendarEnd).toISOString()
  )
  const createEvent = useCreateCalendarEvent()
  const createEvents = useCreateCalendarEvents()
  const updateEvent = useUpdateCalendarEvent()
  const deleteEvent = useDeleteCalendarEvent()

  const filteredEvents = useMemo(() => {
    return (events || []).filter((event) => {
      if (filter === 'mine') return event.created_by === user?.id
      if (filter === 'partner') return event.created_by === partner?.id
      return true
    })
  }, [events, filter, user?.id, partner?.id])

  const monthEventRows = useMemo(
    () => monthWeeks.map((week) => buildMonthEventRows(week, filteredEvents)),
    [filteredEvents, monthWeeks]
  )

  const visibleHolidayMap = useMemo(
    () => getJapaneseHolidayMap(view === 'week' ? weekStart : calendarStart, view === 'week' ? weekEnd : calendarEnd),
    [calendarEnd, calendarStart, view, weekEnd, weekStart]
  )
  const selectedHolidayName = useMemo(() => getJapaneseHolidayName(selectedDate), [selectedDate])

  const getEventsForDay = (day: Date) => {
    const dateKey = getJstDateKey(day)
    return filteredEvents.filter((event) => eventOverlapsDateRange(event.start_at, event.end_at, dateKey))
  }

  const selectedDayEvents = getEventsForDay(selectedDate)

  const getEventColor = (event: CalendarEvent) => {
    if (event.created_by === user?.id) return user?.color || '#093C5D'
    if (event.created_by === partner?.id) return partner?.color || '#3B7597'
    return event.color || '#093C5D'
  }

  const resetForm = (date = selectedDate) => {
    const dateKey = format(date, 'yyyy-MM-dd')
    setNewTitle('')
    setNewDescription('')
    setNewStartDate(dateKey)
    setNewEndDate(dateKey)
    setNewTime('09:00')
    setNewEndTime('10:00')
    setNewAllDay(true)
    setNewLocation('')
    setNewVisibility('shared')
    setNewIsRecurring(false)
    setNewRecurrenceFrequency('weekly')
    setNewRecurrenceEndDate('')
  }

  const openCreateDialog = (date = selectedDate) => {
    setSelectedDate(date)
    setEditingEventId(null)
    resetForm(date)
    setDialogOpen(true)
  }

  const openEditDialog = (event: CalendarEvent) => {
    const startDate = new Date(event.start_at)
    const endDate = event.end_at ? new Date(event.end_at) : startDate

    setSelectedDate(startDate)
    setEditingEventId(event.id)
    setNewTitle(event.title)
    setNewDescription(event.description || '')
    setNewStartDate(format(startDate, 'yyyy-MM-dd'))
    setNewEndDate(format(endDate, 'yyyy-MM-dd'))
    setNewTime(event.all_day ? '09:00' : format(startDate, 'HH:mm'))
    setNewEndTime(event.all_day ? '10:00' : format(endDate, 'HH:mm'))
    setNewAllDay(event.all_day)
    setNewLocation(event.location || '')
    setNewVisibility((event.visibility as VisibilityMode) || 'shared')
    setNewIsRecurring(false)
    setNewRecurrenceFrequency('weekly')
    setNewRecurrenceEndDate('')
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!newTitle.trim()) return toast.error('タイトルを入力してください')
    if (!newStartDate) return toast.error('開始日を入力してください')
    if (!user?.id || !couple?.id) return toast.error('ペア情報を確認してください')
    if (!editingEventId && newIsRecurring && !newRecurrenceEndDate) {
      return toast.error('繰り返し終了日を入力してください')
    }

    const safeEndDate = newEndDate && newEndDate >= newStartDate ? newEndDate : newStartDate

    try {
      const basePayload = {
        title: newTitle.trim(),
        description: newDescription || undefined,
        all_day: newAllDay,
        location: newLocation || undefined,
        visibility: newVisibility,
        color: user.color || '#093C5D',
      }

      const buildEvent = (startDate: string, endDate: string): InsertTables<'calendar_events'> => ({
        couple_id: couple.id,
        created_by: user.id,
        event_type: 'life',
        start_at: toStartIso(startDate, newAllDay ? '00:00' : newTime || '09:00'),
        end_at: toEndIso(endDate, newAllDay ? '23:59' : newEndTime || newTime || '10:00', newAllDay),
        is_recurring: newIsRecurring,
        recurrence_rule: newIsRecurring ? newRecurrenceFrequency : undefined,
        ...basePayload,
      })

      if (editingEventId) {
        await updateEvent.mutateAsync({
          id: editingEventId,
          start_at: toStartIso(newStartDate, newAllDay ? '00:00' : newTime || '09:00'),
          end_at: toEndIso(safeEndDate, newAllDay ? '23:59' : newEndTime || newTime || '10:00', newAllDay),
          ...basePayload,
        })
      } else if (!newIsRecurring) {
        await createEvent.mutateAsync(buildEvent(newStartDate, safeEndDate))
      } else {
        const lastDate = new Date(`${newRecurrenceEndDate}T23:59:59`)
        let startCursor = new Date(`${newStartDate}T00:00:00`)
        let endCursor = new Date(`${safeEndDate}T00:00:00`)

        if (isAfter(startCursor, lastDate)) {
          toast.error('繰り返し終了日は開始日以降にしてください')
          return
        }

        const eventsToCreate: InsertTables<'calendar_events'>[] = []
        while (!isAfter(startCursor, lastDate)) {
          eventsToCreate.push(buildEvent(
            format(startCursor, 'yyyy-MM-dd'),
            format(endCursor, 'yyyy-MM-dd')
          ))
          startCursor = addByFrequency(startCursor, newRecurrenceFrequency)
          endCursor = addByFrequency(endCursor, newRecurrenceFrequency)
        }

        await createEvents.mutateAsync(eventsToCreate)
      }

      setDialogOpen(false)
      setEditingEventId(null)
      toast.success(
        editingEventId
          ? '予定を更新しました'
          : newIsRecurring
            ? '繰り返し予定をまとめて追加しました'
            : '予定を追加しました'
      )
    } catch {
      toast.error(editingEventId ? '予定の更新に失敗しました' : '予定の追加に失敗しました')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteEvent.mutateAsync(id)
      toast.success('予定を削除しました')
    } catch {
      toast.error('予定の削除に失敗しました')
    }
  }

  const formatEventChipLabel = (event: CalendarEvent, day: Date) => {
    const dayKey = getJstDateKey(day)
    const spansMultipleDays = enumerateDateKeys(getEventStartKey(event), getEventEndKey(event)).length > 1

    if (event.all_day) {
      return event.title
    }

    if (getJstDateKey(event.start_at) === dayKey) {
      return `${event.title} ${format(new Date(event.start_at), 'HH:mm')}`
    }

    return spansMultipleDays ? event.title : event.title
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">カレンダー</h1>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-muted p-[3px]">
            <Button size="sm" variant={view === 'month' ? 'default' : 'ghost'} className="h-7" onClick={() => setView('month')}>
              月
            </Button>
            <Button size="sm" variant={view === 'week' ? 'default' : 'ghost'} className="h-7" onClick={() => setView('week')}>
              週
            </Button>
          </div>
          <Button size="sm" onClick={() => openCreateDialog()}>
            <Plus className="mr-1 h-4 w-4" />
            予定を追加
          </Button>
        </div>
      </div>

      <div className="flex gap-1">
        {([
          ['all', 'すべて'],
          ['mine', user?.display_name || '自分'],
          ['partner', partner?.display_name || 'パートナー'],
        ] as [FilterMode, string][]).map(([key, label]) => (
          <Button key={key} size="sm" variant={filter === key ? 'default' : 'outline'} onClick={() => setFilter(key)} className="text-xs">
            {label}
          </Button>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEventId ? '予定を編集' : '予定を追加'}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>タイトル</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="例: 引っ越し見積もり" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>開始日</Label>
                <Input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>終了日</Label>
                <Input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={newAllDay} onCheckedChange={setNewAllDay} />
              <Label>終日</Label>
            </div>

            {!editingEventId && (
              <div className="flex items-center gap-2">
                <Switch checked={newIsRecurring} onCheckedChange={setNewIsRecurring} />
                <Label>繰り返し</Label>
              </div>
            )}

            {!newAllDay && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>開始時刻</Label>
                  <Select value={newTime} onValueChange={(value) => setNewTime(value ?? '')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>終了時刻</Label>
                  <Select value={newEndTime} onValueChange={(value) => setNewEndTime(value ?? '')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {!editingEventId && newIsRecurring && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>頻度</Label>
                  <Select
                    value={newRecurrenceFrequency}
                    onValueChange={(value) => setNewRecurrenceFrequency(value as RecurrenceFrequency)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(recurrenceLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>繰り返し終了日</Label>
                  <Input type="date" value={newRecurrenceEndDate} onChange={(e) => setNewRecurrenceEndDate(e.target.value)} />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>公開範囲</Label>
              <Select value={newVisibility} onValueChange={(value) => setNewVisibility(value as VisibilityMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="shared">共有</SelectItem>
                  <SelectItem value="private">個人</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>場所</Label>
              <Input value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="任意" />
            </div>

            <div className="space-y-2">
              <Label>メモ</Label>
              <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={3} />
            </div>

            <Button
              onClick={handleSubmit}
              className="w-full"
              disabled={createEvent.isPending || createEvents.isPending || updateEvent.isPending}
            >
              {editingEventId ? '更新する' : newIsRecurring ? 'まとめて追加' : '追加する'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card tone="cyan">
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => view === 'week'
              ? setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 7))
              : setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-base">
            {view === 'week'
              ? `${format(weekStart, 'yyyy年M月d日', { locale: ja })} - ${format(weekEnd, 'M月d日', { locale: ja })}`
              : format(currentMonth, 'yyyy年M月', { locale: ja })}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => view === 'week'
              ? setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 7))
              : setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {view === 'month' ? (
            <>
              <div className="grid grid-cols-7 border-b">
                {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
                  <div key={day} className="py-2 text-center text-xs font-medium text-muted-foreground">{day}</div>
                ))}
              </div>
              <div>
                {monthWeeks.map((week, weekIndex) => {
                  const weekRows = monthEventRows[weekIndex] || []

                  return (
                    <div key={week[0]?.toISOString() || weekIndex} className="border-b last:border-b-0">
                      <div className="grid grid-cols-7">
                        {week.map((day) => {
                          const isSelected = isSameDay(day, selectedDate)
                          const holidayName = visibleHolidayMap.get(getJstDateKey(day))

                          return (
                            <div
                              key={day.toISOString()}
                              onClick={() => {
                                setSelectedDate(day)
                                openCreateDialog(day)
                              }}
                              className={cn(
                                'min-h-[72px] cursor-pointer border-r p-1 text-left transition-colors hover:bg-muted/40 last:border-r-0',
                                !isSameMonth(day, currentMonth) && 'text-muted-foreground/40',
                                isSelected && 'bg-primary/5 ring-1 ring-primary'
                              )}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedDate(day)
                                }}
                                className={cn(
                                  'inline-flex h-7 w-7 items-center justify-center rounded-full text-xs',
                                  getJstDateKey(day) === getJstDateKey(new Date()) && 'bg-primary text-primary-foreground'
                                )}
                              >
                                {format(day, 'd')}
                              </button>
                              {holidayName && (
                                <div className="mt-1 truncate px-1 text-[10px] font-medium text-destructive">
                                  {holidayName}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {weekRows.length > 0 && (
                        <div className="space-y-1 px-1 pb-1">
                          {weekRows.map((row, rowIndex) => (
                            <div key={`${week[0]?.toISOString() || weekIndex}-${rowIndex}`} className="grid grid-cols-7 gap-1">
                              {row.map((segment) => (
                                <button
                                  key={segment.event.id}
                                  type="button"
                                  onClick={() => openEditDialog(segment.event)}
                                  className={cn(
                                    'block truncate px-2 py-1 text-left text-[10px] font-medium text-white',
                                    segment.startsThisWeek ? 'rounded-l-md' : 'rounded-l-none',
                                    segment.endsThisWeek ? 'rounded-r-md' : 'rounded-r-none'
                                  )}
                                  style={{
                                    backgroundColor: getEventColor(segment.event),
                                    gridColumn: `${segment.startIndex + 1} / ${segment.endIndex + 2}`,
                                  }}
                                >
                                  {formatEventChipLabel(segment.event, week[segment.startIndex])}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7">
              {weekDays.map((day) => {
                const dayEvents = getEventsForDay(day)
                const isSelected = isSameDay(day, selectedDate)
                const holidayName = visibleHolidayMap.get(getJstDateKey(day))
                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      'min-h-[220px] border-b border-r p-3 transition-colors hover:bg-muted/40',
                      isSelected && 'bg-primary/5 ring-1 ring-primary'
                    )}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <button type="button" onClick={() => setSelectedDate(day)} className="text-left">
                        <div className="text-sm font-medium">{format(day, 'M/d (E)', { locale: ja })}</div>
                        {holidayName && <div className="mt-1 text-xs font-medium text-destructive">{holidayName}</div>}
                      </button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openCreateDialog(day)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {dayEvents.length > 0 ? dayEvents.map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => openEditDialog(event)}
                          className="block w-full rounded-md px-2 py-2 text-left text-xs text-white"
                          style={{ backgroundColor: getEventColor(event) }}
                        >
                          <div className="font-medium">{event.title}</div>
                          <div className="mt-1 opacity-90">{formatEventTime(event)}</div>
                        </button>
                      )) : (
                        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                          予定はありません
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card tone="mint">
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-base">{format(selectedDate, 'M月d日 (E)', { locale: ja })} の予定</CardTitle>
          <Button size="sm" variant="ghost" onClick={() => openCreateDialog(selectedDate)}>
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {selectedDayEvents.length > 0 || selectedHolidayName ? (
            <div className="space-y-3">
              {selectedHolidayName && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <p className="text-sm font-medium text-destructive">{selectedHolidayName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">日本の祝日</p>
                </div>
              )}
              {selectedDayEvents.map((event) => (
                <div key={event.id} className="group flex items-start gap-3 rounded-lg border p-3">
                  <div className="min-h-[52px] w-1 rounded-full" style={{ backgroundColor: getEventColor(event) }} />
                  <button type="button" className="flex-1 text-left" onClick={() => openEditDialog(event)}>
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{formatEventTime(event)}</p>
                    {event.description && <p className="mt-1 text-xs text-muted-foreground">{event.description}</p>}
                    {event.location && <p className="mt-1 text-xs text-muted-foreground">{event.location}</p>}
                  </button>
                  <div className="flex items-center gap-2">
                    <Badge variant={event.visibility === 'shared' ? 'secondary' : 'outline'} className="text-xs">
                      {visibilityLabels[(event.visibility as VisibilityMode) || 'shared']}
                    </Badge>
                    {event.created_by === user?.id && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(event.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">この日に重なる予定はありません</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
