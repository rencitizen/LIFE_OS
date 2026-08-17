'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export type LifeActivity = {
  id: string
  module: 'finance' | 'calendar' | 'shopping' | 'ideas'
  action: string
  entityId: string | null
  rawInput: string | null
  createdAt: string
}

export function useRecentLifeActivity(coupleId: string | undefined, limit = 10) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['life-activity', coupleId, limit],
    queryFn: async () => {
      const [financeResult, lifeResult] = await Promise.all([
        supabase
          .from('finance_action_logs')
          .select('id, action, expense_id, settlement_id, raw_input, created_at')
          .eq('couple_id', coupleId!)
          .eq('status', 'executed')
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase
          .from('chatgpt_action_logs')
          .select('id, entity_type, entity_id, action, raw_input, created_at')
          .eq('couple_id', coupleId!)
          .eq('status', 'executed')
          .order('created_at', { ascending: false })
          .limit(limit),
      ])

      if (financeResult.error) throw financeResult.error
      if (lifeResult.error) throw lifeResult.error

      const financeRows: LifeActivity[] = (financeResult.data || []).map((row) => ({
        id: row.id,
        module: 'finance',
        action: row.action,
        entityId: row.expense_id || row.settlement_id || null,
        rawInput: row.raw_input,
        createdAt: row.created_at,
      }))

      const lifeRows: LifeActivity[] = (lifeResult.data || []).map((row) => ({
        id: row.id,
        module: row.entity_type === 'calendar_event'
          ? 'calendar'
          : row.entity_type === 'shopping_item' || row.entity_type === 'shopping_list'
            ? 'shopping'
            : 'ideas',
        action: row.action,
        entityId: row.entity_id,
        rawInput: row.raw_input,
        createdAt: row.created_at,
      }))

      return [...financeRows, ...lifeRows]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit)
    },
    enabled: !!coupleId,
  })
}
