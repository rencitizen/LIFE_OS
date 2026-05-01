import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { format } from 'date-fns'
import type { LivingMode } from '@/types'
import type { FinanceScope } from '@/lib/finance/scope'

interface FinanceState {
  selectedMonth: string // "2026-03" format
  livingMode: LivingMode
  financeScope: FinanceScope
  expenseTypeFilter: string | null
  categoryFilter: string | null
  setSelectedMonth: (month: string) => void
  setLivingMode: (mode: LivingMode) => void
  setFinanceScope: (scope: FinanceScope) => void
  setExpenseTypeFilter: (type: string | null) => void
  setCategoryFilter: (categoryId: string | null) => void
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set) => ({
      selectedMonth: format(new Date(), 'yyyy-MM'),
      livingMode: 'before_cohabiting',
      financeScope: 'combined',
      expenseTypeFilter: null,
      categoryFilter: null,
      setSelectedMonth: (month) => set({ selectedMonth: month }),
      setLivingMode: (mode) => set({ livingMode: mode }),
      setFinanceScope: (scope) => set({ financeScope: scope }),
      setExpenseTypeFilter: (type) => set({ expenseTypeFilter: type }),
      setCategoryFilter: (categoryId) => set({ categoryFilter: categoryId }),
    }),
    {
      name: 'life-os-finance-store',
      partialize: (state) => ({
        selectedMonth: state.selectedMonth,
        livingMode: state.livingMode,
        financeScope: state.financeScope,
      }),
    }
  )
)
