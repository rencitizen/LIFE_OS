'use client'

import {
  differenceInCalendarDays,
  eachDayOfInterval,
  eachWeekOfInterval,
  endOfDay,
  endOfWeek,
  format,
  isAfter,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subWeeks,
} from 'date-fns'
import type { Todo } from '@/types'

type ProgressBucket = {
  label: string
  count: number
}

type TodoProgressSummary = {
  total: number
  activeCount: number
  doneCount: number
  inProgressCount: number
  completionRate: number
  doneToday: number
  doneThisWeek: number
  doneThisMonth: number
  currentStreak: number
  recentDone: Todo[]
  dailySeries: ProgressBucket[]
  weeklySeries: ProgressBucket[]
}

function getCompletedDate(todo: Todo) {
  if (todo.status !== 'done') return null
  const value = todo.completed_at || todo.created_at
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function buildDailySeries(completedDates: Date[], today: Date, days: number) {
  const start = subDays(startOfDay(today), days - 1)
  const end = endOfDay(today)
  const range = eachDayOfInterval({ start, end })

  return range.map((day) => {
    const count = completedDates.filter((completedAt) => differenceInCalendarDays(completedAt, day) === 0).length

    return {
      label: format(day, 'MM/dd'),
      count,
    }
  })
}

function buildWeeklySeries(completedDates: Date[], today: Date, weeks: number) {
  const start = startOfWeek(subWeeks(today, weeks - 1), { weekStartsOn: 1 })
  const end = endOfWeek(today, { weekStartsOn: 1 })
  const weeksInRange = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 })

  return weeksInRange.map((weekStart) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
    const count = completedDates.filter(
      (completedAt) => !isAfter(weekStart, completedAt) && !isAfter(completedAt, weekEnd)
    ).length

    return {
      label: format(weekStart, 'M/d'),
      count,
    }
  })
}

function calculateCurrentStreak(completedDates: Date[], today: Date) {
  const completedDayKeys = new Set(completedDates.map((date) => format(date, 'yyyy-MM-dd')))
  let cursor = startOfDay(today)
  let streak = 0

  while (completedDayKeys.has(format(cursor, 'yyyy-MM-dd'))) {
    streak += 1
    cursor = subDays(cursor, 1)
  }

  return streak
}

export function buildTodoProgressSummary(todos: Todo[], today = new Date()): TodoProgressSummary {
  const doneTodos = todos
    .filter((todo) => todo.status === 'done')
    .sort((a, b) => (b.completed_at || b.created_at).localeCompare(a.completed_at || a.created_at))
  const activeTodos = todos.filter((todo) => todo.status !== 'done')
  const inProgressTodos = todos.filter((todo) => todo.status === 'in_progress')
  const completedDates = doneTodos
    .map(getCompletedDate)
    .filter((date): date is Date => date !== null)
  const todayStart = startOfDay(today)
  const weekStart = startOfWeek(todayStart, { weekStartsOn: 1 })
  const monthStart = startOfMonth(todayStart)

  const doneToday = completedDates.filter((date) => differenceInCalendarDays(date, todayStart) === 0).length
  const doneThisWeek = completedDates.filter((date) => !isAfter(weekStart, date)).length
  const doneThisMonth = completedDates.filter((date) => !isAfter(monthStart, date)).length

  return {
    total: todos.length,
    activeCount: activeTodos.length,
    doneCount: doneTodos.length,
    inProgressCount: inProgressTodos.length,
    completionRate: todos.length > 0 ? Math.round((doneTodos.length / todos.length) * 100) : 0,
    doneToday,
    doneThisWeek,
    doneThisMonth,
    currentStreak: calculateCurrentStreak(completedDates, todayStart),
    recentDone: doneTodos.slice(0, 6),
    dailySeries: buildDailySeries(completedDates, todayStart, 14),
    weeklySeries: buildWeeklySeries(completedDates, todayStart, 8),
  }
}
