'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Settlement } from '@/types'

export type MonthlySettlementPreview = {
  couple_id: string
  settlement_month: string
  from_user: string | null
  to_user: string | null
  amount: number
  expense_count: number
  gross_amount: number
}

export type CompletedMonthlySettlement = Omit<MonthlySettlementPreview, 'couple_id'> & {
  settlement_id: string
}

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

export function useMonthlySettlementPreview(userId: string | undefined, yearMonth: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['monthly-settlement-preview', userId, yearMonth],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('preview_monthly_settlement', {
        p_user_id: userId!,
        p_month: `${yearMonth}-01`,
      })
      if (error) throw error

      const row = data?.[0]
      if (!row) return null

      return {
        couple_id: row.couple_id,
        settlement_month: row.settlement_month,
        from_user: row.from_user ?? null,
        to_user: row.to_user ?? null,
        amount: Number(row.amount || 0),
        expense_count: Number(row.expense_count || 0),
        gross_amount: Number(row.gross_amount || 0),
      } satisfies MonthlySettlementPreview
    },
    enabled: !!userId && !!yearMonth,
  })
}

export function useCompleteMonthlySettlement() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      yearMonth,
      memo,
    }: {
      userId: string
      yearMonth: string
      memo?: string | null
    }) => {
      const { data, error } = await (supabase as any).rpc('complete_monthly_settlement', {
        p_user_id: userId,
        p_month: `${yearMonth}-01`,
        p_memo: memo || null,
      })
      if (error) throw error

      const row = data?.[0]
      if (!row) throw new Error('settlement_result_missing')

      return {
        settlement_id: row.settlement_id,
        settlement_month: row.settlement_month,
        from_user: row.from_user ?? null,
        to_user: row.to_user ?? null,
        amount: Number(row.amount || 0),
        expense_count: Number(row.expense_count || 0),
        gross_amount: Number(row.gross_amount || 0),
      } satisfies CompletedMonthlySettlement
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-settlement-preview'] })
      queryClient.invalidateQueries({ queryKey: ['settlements'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}
