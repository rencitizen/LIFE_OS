import { eachMonthOfInterval, endOfMonth, format, startOfMonth } from 'date-fns'
import type { Expense, Income, UnifiedTransaction } from '@/types'

export function formatYen(value: number) {
  return `¥${Math.round(value).toLocaleString('ja-JP')}`
}

export function getMonthRange(yearMonth: string) {
  const [year, month] = yearMonth.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return { start, end }
}

export function getCalendarYearMonths(year: number) {
  return eachMonthOfInterval({
    start: startOfMonth(new Date(year, 0, 1)),
    end: endOfMonth(new Date(year, 11, 1)),
  }).map((date) => ({
    key: format(date, 'yyyy-MM'),
    label: format(date, 'M月'),
  }))
}

export function getFiscalYearLabel(yearMonth: string, fiscalStartMonth = 1) {
  const [year, month] = yearMonth.split('-').map(Number)
  return month >= fiscalStartMonth ? year : year - 1
}

function mapExpenseSource(source: Expense['source']) {
  if (source === 'moneyforward_screenshot') return 'moneyforward_screenshot'
  if (source === 'ocr') return 'ocr'
  if (source === 'auto' || source === 'shopping_list') return 'imported'
  return 'manual'
}

export function buildUnifiedTransactions(
  expenses: Array<Expense & { expense_categories?: { name: string; icon: string | null; color: string | null } | null }> = [],
  incomes: Income[] = []
): UnifiedTransaction[] {
  const expenseTransactions: UnifiedTransaction[] = expenses.map((expense) => ({
    id: expense.id,
    transactionType: 'expense',
    date: expense.expense_date,
    type: expense.expense_type,
    category: expense.expense_categories?.name ?? '未分類',
    categoryId: expense.category_id,
    amount: Number(expense.amount),
    memo: expense.description ?? '',
    ownerId: expense.paid_by,
    ownerLabel: '支払者',
    source: mapExpenseSource(expense.source),
    rawExpense: expense,
  }))

  const incomeTransactions: UnifiedTransaction[] = incomes.map((income) => ({
    id: income.id,
    transactionType: 'income',
    date: income.income_date,
    type: income.income_type,
    category: income.income_type,
    categoryId: income.income_type,
    amount: Number(income.amount),
    memo: income.description ?? '',
    ownerId: income.user_id,
    ownerLabel: '受取人',
    source: 'manual',
    rawIncome: income,
  }))

  return [...expenseTransactions, ...incomeTransactions].sort((a, b) => {
    if (a.date === b.date) return b.amount - a.amount
    return a.date < b.date ? 1 : -1
  })
}
