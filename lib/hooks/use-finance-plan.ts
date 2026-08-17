'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export type FinancePlanHorizon = 'short' | 'medium' | 'long'
export type FinancePlanPriority = 'high' | 'medium' | 'low'
export type FinancePlanStatus = 'active' | 'achieved' | 'paused' | 'cancelled'

export type FinancePlanItem = {
  id: string
  couple_id: string
  created_by: string | null
  horizon: FinancePlanHorizon
  title: string
  description: string | null
  category: string | null
  target_date: string | null
  target_amount: number | null
  current_amount: number | null
  priority: FinancePlanPriority
  status: FinancePlanStatus
  source: 'manual' | 'chatgpt'
  raw_input: string | null
  created_at: string
  updated_at: string
}

export function useFinancePlanItems(coupleId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['finance-plan-items', coupleId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('finance_plan_items')
        .select('*')
        .eq('couple_id', coupleId!)
        .neq('status', 'cancelled')
        .order('target_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return ((data || []) as any[]).map((row) => ({
        ...row,
        target_amount: row.target_amount == null ? null : Number(row.target_amount),
        current_amount: row.current_amount == null ? null : Number(row.current_amount),
      })) as FinancePlanItem[]
    },
    enabled: !!coupleId,
  })
}
