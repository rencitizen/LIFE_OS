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

export type MoneyForwardIncomeImportRow = {
  income_date: string
  amount: number
  description: string
  income_type: 'salary' | 'bonus' | 'freelance' | 'other'
  external_id?: string | null
  raw_payload?: Record<string, unknown>
}

type ImportError = {
  row?: number
  external_id?: string | null
  description?: string | null
  message?: string
}

export type MoneyForwardImportResult = {
  run_id: string | null
  rows_total: number
  inserted_count: number
  linked_existing_count: number
  unchanged_count: number
  failed_count: number
  errors: ImportError[]
  income_rows_total: number
  income_inserted_count: number
  income_linked_existing_count: number
  income_unchanged_count: number
  income_failed_count: number
  income_errors: ImportError[]
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

type IncomeImportRpcRow = {
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
    mutationFn: async ({
      userId,
      paidBy,
      rows,
      incomeRows,
      fileName,
    }: {
      userId: string
      paidBy: string
      rows: MoneyForwardImportRow[]
      incomeRows: MoneyForwardIncomeImportRow[]
      fileName?: string | null
    }) => {
      let expenseResult: ImportRpcRow | null = null
      let incomeResult: IncomeImportRpcRow | null = null

      if (rows.length > 0) {
        const { data, error } = await supabase.rpc('import_moneyforward_rows', {
          p_user_id: userId,
          p_paid_by: paidBy,
          p_rows: rows,
          p_file_name: fileName || null,
        })
        if (error) throw error
        expenseResult = (data as unknown as ImportRpcRow[] | null)?.[0] ?? null
        if (!expenseResult) throw new Error('expense_import_result_missing')
      }

      if (incomeRows.length > 0) {
        const { data, error } = await supabase.rpc('import_moneyforward_income_rows', {
          p_user_id: userId,
          p_rows: incomeRows,
        })
        if (error) throw error
        incomeResult = (data as unknown as IncomeImportRpcRow[] | null)?.[0] ?? null
        if (!incomeResult) throw new Error('income_import_result_missing')
      }

      return {
        run_id: expenseResult?.run_id ?? null,
        rows_total: Number(expenseResult?.rows_total || 0),
        inserted_count: Number(expenseResult?.inserted_count || 0),
        linked_existing_count: Number(expenseResult?.linked_existing_count || 0),
        unchanged_count: Number(expenseResult?.unchanged_count || 0),
        failed_count: Number(expenseResult?.failed_count || 0),
        errors: Array.isArray(expenseResult?.errors) ? expenseResult!.errors as ImportError[] : [],
        income_rows_total: Number(incomeResult?.rows_total || 0),
        income_inserted_count: Number(incomeResult?.inserted_count || 0),
        income_linked_existing_count: Number(incomeResult?.linked_existing_count || 0),
        income_unchanged_count: Number(incomeResult?.unchanged_count || 0),
        income_failed_count: Number(incomeResult?.failed_count || 0),
        income_errors: Array.isArray(incomeResult?.errors) ? incomeResult!.errors as ImportError[] : [],
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
      queryClient.invalidateQueries({ queryKey: ['incomes'] })
      queryClient.invalidateQueries({ queryKey: ['income-history'] })
      queryClient.invalidateQueries({ queryKey: ['income-history-year'] })
      queryClient.invalidateQueries({ queryKey: ['income-actuals-years'] })
    },
  })
}
