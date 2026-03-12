import { create } from 'zustand'
import { format } from 'date-fns'

interface FinanceState {
  selectedMonth: string // "2026-03" format
  expenseTypeFilter: string | null
  categoryFilter: string | null
  setSelectedMonth: (month: string) => void
  setExpenseTypeFilter: (type: string | null) => void
  setCategoryFilter: (categoryId: string | null) => void
}

export const useFinanceStore = create<FinanceState>((set) => ({
  selectedMonth: format(new Date(), 'yyyy-MM'),
  expenseTypeFilter: null,
  categoryFilter: null,
  setSelectedMonth: (month) => set({ selectedMonth: month }),
  setExpenseTypeFilter: (type) => set({ expenseTypeFilter: type }),
  setCategoryFilter: (categoryId) => set({ categoryFilter: categoryId }),
}))
