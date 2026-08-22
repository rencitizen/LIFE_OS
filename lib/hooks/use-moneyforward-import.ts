'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export type MoneyForwardImportRow = {
  expense_date: string
  amount: number
  description: string
  category_name: string
  parent_category_name?: string | null
  external_id?: string | null
  payment_method?: 'cash' | 'card' | 'transfer' | null
  is_settlement_target?: boolean
  raw_payload?: Record<string, unknown>
}

export type MoneyForwardImportResult = {
  run_id: string
  rows_total: number
  inserted_count: number
  linked_existing_count: number
  unchanged_count: number
  failed_count: number
  errors: Array<{ row?: number; external_id?: string | null; description?: string | null; message?: string }>
}

export type MoneyForwardImportRun = {
  id: string
  file_name: string | null
  rows_total: number
  inserted_count: number
  linked_existing_count: number
  unchanged_count: number
  failed_count: number
  errors: unknown
  created_at: string
}

type ImportRpcRow = {
  run_id: string
  rows_total: number | string
  inserted_count: number | string
  linked_existing_count: number | string
  unchanged_count: number | string
  failed_count: number | string
  errors: unknown
}

export function useMoneyForwardImportRuns(coupleId: string | undefined) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['moneyforward-import-runs', coupleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('moneyforward_import_runs')
        .select('id,file_name,rows_total,inserted_count,linked_existing_count,unchanged_count,failed_count,errors,created_at')
        .eq('couple_id', coupleId!)
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return (data ?? []) as unknown as MoneyForwardImportRun[]
    },
    enabled: !!coupleId,
  })
}

export function useImportMoneyForward() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, paidBy, rows, fileName }: { userId: string; paidBy: string; rows: MoneyForwardImportRow[]; fileName?: string | null }) => {
      const { data, error } = await supabase.rpc('import_moneyforward_rows', {
        p_user_id: userId,
        p_paid_by: paidBy,
        p_rows: rows,
        p_file_name: fileName || null,
      })
      if (error) throw error
      const row = (data as unknown as ImportRpcRow[] | null)?.[0]
      if (!row) throw new Error('import_result_missing')
      return {
        run_id: row.run_id,
        rows_total: Number(row.rows_total || 0),
        inserted_count: Number(row.inserted_count || 0),
        linked_existing_count: Number(row.linked_existing_count || 0),
        unchanged_count: Number(row.unchanged_count || 0),
        failed_count: Number(row.failed_count || 0),
        errors: Array.isArray(row.errors) ? row.errors as MoneyForwardImportResult['errors'] : [],
      } satisfies MoneyForwardImportResult
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moneyforward-import-runs'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] })
      queryClient.invalidateQueries({ queryKey: ['expense-history'] })
      queryClient.invalidateQueries({ queryKey: ['expense-history-year'] })
      queryClient.invalidateQueries({ queryKey: ['monthly-settlement-preview'] })
      queryClient.invalidateQueries({ queryKey: ['year-expenses'] })
    },
  })
}
