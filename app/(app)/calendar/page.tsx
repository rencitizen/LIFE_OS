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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/hooks/use-auth'
import { useCalendarEvents, useCreateCalendarEvent, useDeleteCalendarEvent, useUpdateCalendarEvent } from '@/lib/hooks/use-calendar-events'
import { useCalendarStore } from '@/stores/calendar-store'
import { toast } from 'sonner'
import type { CalendarEvent } from '@/types'

type FilterMode = 'all' | 'mine' | 'partner'
type VisibilityMode = 'shared' | 'private'

const visibilityLabels: Record<VisibilityMode, string> = {
  shared: '共有予定',
  private: '個人予定',
}

const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, index) => {
  const hour = String(Math.floor(index / 4)).padStart(2, '0')
  const minute = String((index % 4) * 15).padStart(2, '0')
  return `${hour}:${minute}`
})

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
  const [newLocation, setNewLocation] = useState('')
  const [newVisibility, setNewVisibility] = useState<VisibilityMode>('shared')
  const [editingEventId, setEditingEventId] = useState<string | null>(null)

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
  const updateEvent = useUpdateCalendarEvent()
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
  const getEventColor = (event: CalendarEvent) => {
    if (event.created_by === user?.id) return user?.color || '#85A392'
    if (event.created_by === partner?.id) return partner?.color || '#3A6EA5'
    return event.color || '#85A392'
  }

  const openCreateDialog = (date = selectedDate) => {
    setSelectedDate(date)
    setEditingEventId(null)
    setNewDate(format(date, 'yyyy-MM-dd'))
    setNewTitle('')
    setNewDescription('')
    setNewTime('')
    setNewEndTime('')
    setNewAllDay(true)
    setNewLocation('')
    setNewVisibility('shared')
    setDialogOpen(true)
  }

  const openEditDialog = (event: CalendarEvent) => {
    const startDate = new Date(event.start_at)
    const endDate = event.end_at ? new Date(event.end_at) : null

    setSelectedDate(startDate)
    setEditingEventId(event.id)
    setNewDate(format(startDate, 'yyyy-MM-dd'))
    setNewTitle(event.title)
    setNewDescription(event.description || '')
    setNewTime(event.all_day ? '' : format(startDate, 'HH:mm'))
    setNewEndTime(!event.all_day && endDate ? format(endDate, 'HH:mm') : '')
    setNewAllDay(event.all_day)
    setNewLocation(event.location || '')
    setNewVisibility((event.visibility as VisibilityMode) || 'shared')
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
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

      if (editingEventId) {
        await updateEvent.mutateAsync({
          id: editingEventId,
          title: newTitle,
          description: newDescription || undefined,
          start_at: startAt,
          end_at: endAt,
          all_day: newAllDay,
          location: newLocation || undefined,
          visibility: newVisibility,
          color: user?.color || '#85A392',
        })
      } else {
        await createEvent.mutateAsync({
          couple_id: couple.id,
          created_by: user.id,
          title: newTitle,
          description: newDescription || undefined,
          start_at: startAt,
          end_at: endAt,
          all_day: newAllDay,
          location: newLocation || undefined,
          visibility: newVisibility,
          color: user?.color || '#85A392',
        })
      }
      setDialogOpen(false)
      setEditingEventId(null)
      toast.success(editingEventId ? '予定を更新しました' : '予定を追加しました')
    } catch {
      toast.error(editingEventId ? '予定の更新に失敗しました' : '予定の追加に失敗しました')
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

  const formatEventChipLabel = (event: CalendarEvent) => {
    if (event.all_day) return event.title
    return `${format(new Date(event.start_at), 'HH:mm')} ${event.title}`
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
          <Button size="sm" onClick={() => openCreateDialog()}>
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
            <DialogTitle>{editingEventId ? '予定を編集' : '予定を追加'}</DialogTitle>
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
                  <Select value={newTime} onValueChange={(value) => setNewTime(value ?? '')}>
                    <SelectTrigger>
                      <SelectValue placeholder="09:00" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>終了時刻</Label>
                  <Select value={newEndTime} onValueChange={(value) => setNewEndTime(value ?? '')}>
                    <SelectTrigger>
                      <SelectValue placeholder="10:00" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>公開範囲</Label>
              <Select value={newVisibility} onValueChange={(v) => v && setNewVisibility(v as VisibilityMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="shared">共有予定</SelectItem>
                  <SelectItem value="private">個人予定</SelectItem>
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
            <Button onClick={handleSubmit} className="w-full" disabled={createEvent.isPending || updateEvent.isPending}>
              {editingEventId ? '更新' : '追加'}
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
                <div
                  key={day.toISOString()}
                  className={cn(
                    'min-h-[60px] sm:min-h-[80px] p-1 border-b border-r text-left transition-colors hover:bg-muted/50',
                    !isSameMonth(day, currentMonth) && 'text-muted-foreground/50',
                    isSelected && 'bg-primary/5 ring-1 ring-primary'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => openCreateDialog(day)}
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs transition-colors hover:bg-primary/10',
                      isToday(day) && 'bg-primary text-primary-foreground font-bold'
                    )}
                  >
                    {format(day, 'd')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(day)}
                    className="mt-0.5 block w-full space-y-0.5 text-left"
                  >
                    {dayEvents.slice(0, 2).map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditDialog(event)
                        }}
                        className="block w-full truncate rounded px-1 text-left text-[10px] leading-tight text-white"
                        style={{ backgroundColor: getEventColor(event) }}
                      >
                        {formatEventChipLabel(event)}
                      </button>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{dayEvents.length - 2}件
                      </div>
                    )}
                  </button>
                </div>
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
          <Button size="sm" variant="ghost" onClick={() => openCreateDialog()}>
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {selectedDayEvents.length > 0 ? (
            <div className="space-y-3">
              {selectedDayEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 group">
                  <div className="w-1 h-full min-h-[40px] rounded-full" style={{ backgroundColor: getEventColor(event) }} />
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() => openEditDialog(event)}
                  >
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
                  </button>
                  <div className="flex items-center gap-1">
                    <Badge variant={event.visibility === 'shared' ? 'secondary' : 'outline'} className="text-xs shrink-0">
                      {visibilityLabels[(event.visibility as VisibilityMode) || 'shared'] || event.visibility}
                    </Badge>
                    {event.created_by === user?.id && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(event.id)
                        }}
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
