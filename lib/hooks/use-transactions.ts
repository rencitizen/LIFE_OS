'use client'

import { useMemo } from 'react'
import { useCreateExpense, useDeleteExpense, useExpenses, useUpdateExpense } from '@/lib/hooks/use-expenses'
import { useCreateIncome, useDeleteIncome, useIncomes, useUpdateIncome } from '@/lib/hooks/use-incomes'
import { buildUnifiedTransactions } from '@/lib/finance/utils'
import type { InsertTables, UnifiedTransaction, UpdateTables } from '@/types'

export function useTransactions(coupleId: string | undefined, yearMonth?: string) {
  const expensesQuery = useExpenses(coupleId, yearMonth)
  const incomesQuery = useIncomes(coupleId, yearMonth)

  const data = useMemo(
    () => buildUnifiedTransactions(expensesQuery.data, incomesQuery.data),
    [expensesQuery.data, incomesQuery.data]
  )

  return {
    data,
    isLoading: expensesQuery.isLoading || incomesQuery.isLoading,
    isFetching: expensesQuery.isFetching || incomesQuery.isFetching,
    expenses: expensesQuery.data ?? [],
    incomes: incomesQuery.data ?? [],
  }
}

export function useCreateTransaction() {
  const createExpense = useCreateExpense()
  const createIncome = useCreateIncome()

  return {
    isPending: createExpense.isPending || createIncome.isPending,
    mutateAsync: async (
      payload:
        | { transactionType: 'expense'; values: InsertTables<'expenses'> }
        | { transactionType: 'income'; values: InsertTables<'incomes'> }
    ) => {
      if (payload.transactionType === 'expense') {
        return createExpense.mutateAsync(payload.values)
      }

      return createIncome.mutateAsync(payload.values)
    },
  }
}

export function useUpdateTransaction() {
  const updateExpense = useUpdateExpense()
  const updateIncome = useUpdateIncome()

  return {
    isPending: updateExpense.isPending || updateIncome.isPending,
    mutateAsync: async (
      payload:
        | { transactionType: 'expense'; values: UpdateTables<'expenses'> & { id: string } }
        | { transactionType: 'income'; values: UpdateTables<'incomes'> & { id: string } }
    ) => {
      if (payload.transactionType === 'expense') {
        return updateExpense.mutateAsync(payload.values)
      }

      return updateIncome.mutateAsync(payload.values)
    },
  }
}

export function useDeleteTransaction() {
  const deleteExpense = useDeleteExpense()
  const deleteIncome = useDeleteIncome()

  return {
    isPending: deleteExpense.isPending || deleteIncome.isPending,
    mutateAsync: async (transaction: Pick<UnifiedTransaction, 'id' | 'transactionType'>) => {
      if (transaction.transactionType === 'expense') {
        return deleteExpense.mutateAsync(transaction.id)
      }

      return deleteIncome.mutateAsync(transaction.id)
    },
  }
}
