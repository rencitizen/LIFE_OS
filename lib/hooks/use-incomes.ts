'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Income, InsertTables } from '@/types'

export function useIncomes(coupleId: string | undefined, yearMonth?: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['incomes', coupleId, yearMonth],
    queryFn: async () => {
      let query = supabase
        .from('incomes')
        .select('*')
        .eq('couple_id', coupleId!)
        .order('income_date', { ascending: false })

      if (yearMonth) {
        const startDate = `${yearMonth}-01`
        const [year, month] = yearMonth.split('-').map(Number)
        const nextMonth = month === 12 ? 1 : month + 1
        const nextYear = month === 12 ? year + 1 : year
        const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
        query = query.gte('income_date', startDate).lt('income_date', endDate)
      }

      const { data, error } = await query
      if (error) throw error
      return data as unknown as Income[]
    },
    enabled: !!coupleId,
  })
}

export function useCreateIncome() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (income: InsertTables<'incomes'>) => {
      const { data, error } = await supabase
        .from('incomes')
        .insert(income)
        .select()
        .single()
      if (error) throw error
      return data as unknown as Income
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] })
    },
  })
}
