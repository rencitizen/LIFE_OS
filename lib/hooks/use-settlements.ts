'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Settlement, InsertTables, UpdateTables } from '@/types'

export function useSettlements(coupleId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['settlements', coupleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settlements')
        .select('*')
        .eq('couple_id', coupleId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as Settlement[]
    },
    enabled: !!coupleId,
  })
}

export function useUnsettledBalance(coupleId: string | undefined, userId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['unsettled-balance', coupleId, userId],
    queryFn: async () => {
      // Get all advance expenses that haven't been fully settled
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('couple_id', coupleId!)
        .eq('expense_type', 'advance')
      if (error) throw error

      const expenses = data as unknown as { paid_by: string; amount: number }[]
      let balance = 0
      for (const exp of expenses) {
        if (exp.paid_by === userId) {
          balance += Number(exp.amount) / 2 // partner owes half
        } else {
          balance -= Number(exp.amount) / 2 // I owe half
        }
      }
      return balance
    },
    enabled: !!coupleId && !!userId,
  })
}

export function useCreateSettlement() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (settlement: InsertTables<'settlements'>) => {
      const { data, error } = await supabase
        .from('settlements')
        .insert(settlement)
        .select()
        .single()
      if (error) throw error
      return data as unknown as Settlement
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements'] })
      queryClient.invalidateQueries({ queryKey: ['unsettled-balance'] })
    },
  })
}

export function useUpdateSettlement() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTables<'settlements'> & { id: string }) => {
      const { data, error } = await supabase
        .from('settlements')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as unknown as Settlement
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements'] })
      queryClient.invalidateQueries({ queryKey: ['unsettled-balance'] })
    },
  })
}
