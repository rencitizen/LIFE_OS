import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { format } from 'date-fns'
import type { LivingMode } from '@/types'

interface FinanceState {
  selectedMonth: string // "2026-03" format
  livingMode: LivingMode
  expenseTypeFilter: string | null
  categoryFilter: string | null
  setSelectedMonth: (month: string) => void
  setLivingMode: (mode: LivingMode) => void
  setExpenseTypeFilter: (type: string | null) => void
  setCategoryFilter: (categoryId: string | null) => void
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set) => ({
      selectedMonth: format(new Date(), 'yyyy-MM'),
      livingMode: 'before_cohabiting',
      expenseTypeFilter: null,
      categoryFilter: null,
      setSelectedMonth: (month) => set({ selectedMonth: month }),
      setLivingMode: (mode) => set({ livingMode: mode }),
      setExpenseTypeFilter: (type) => set({ expenseTypeFilter: type }),
      setCategoryFilter: (categoryId) => set({ categoryFilter: categoryId }),
    }),
    {
      name: 'life-os-finance-store',
      partialize: (state) => ({
        selectedMonth: state.selectedMonth,
        livingMode: state.livingMode,
      }),
    }
  )
)
