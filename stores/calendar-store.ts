import { create } from 'zustand'

type CalendarView = 'month' | 'week'

interface CalendarState {
  selectedDate: Date
  view: CalendarView
  setSelectedDate: (date: Date) => void
  setView: (view: CalendarView) => void
}

export const useCalendarStore = create<CalendarState>((set) => ({
  selectedDate: new Date(),
  view: 'month',
  setSelectedDate: (date) => set({ selectedDate: date }),
  setView: (view) => set({ view }),
}))
