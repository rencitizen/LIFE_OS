'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { CalendarEvent, InsertTables, UpdateTables } from '@/types'

export function useCalendarEvents(coupleId: string | undefined, startDate: string, endDate: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['calendar-events', coupleId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('couple_id', coupleId!)
        .lte('start_at', endDate)
        .or(`end_at.gte.${startDate},end_at.is.null`)
        .order('start_at')
      if (error) throw error
      return data as unknown as CalendarEvent[]
    },
    enabled: !!coupleId,
  })
}

export function useCreateCalendarEvent() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (event: InsertTables<'calendar_events'>) => {
      const { data, error } = await supabase
        .from('calendar_events')
        .insert(event)
        .select()
        .single()
      if (error) throw error
      return data as unknown as CalendarEvent
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
    },
  })
}

export function useUpdateCalendarEvent() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTables<'calendar_events'> & { id: string }) => {
      const { data, error } = await supabase
        .from('calendar_events')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as unknown as CalendarEvent
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
    },
  })
}

export function useDeleteCalendarEvent() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
    },
  })
}
