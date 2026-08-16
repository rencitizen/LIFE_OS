export type { Database } from './database'
import type { Database } from './database'

// Table row type helper
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// Entity aliases
export type Couple = Tables<'couples'>
export type User = Tables<'users'>
export type CalendarEvent = Tables<'calendar_events'>
export type EventReminder = Tables<'event_reminders'>
export type ShoppingList = Tables<'shopping_lists'>
export type ShoppingItem = Tables<'shopping_items'>
export type Todo = Tables<'todos'>
export type IdeaItem = Tables<'idea_items'>

// The generated database.ts in this repository predates the finance split/category
// migrations. Keep these finance aliases aligned with the live Supabase schema until
// the whole generated file is replaced by the next CLI type-generation pass.
export type Expense = Tables<'expenses'> & {
  split_profile_id: string | null
  split_mode: 'none' | 'standard' | 'custom' | 'full_payer'
  is_settlement_target: boolean
}
export type ExpenseSplit = Tables<'expense_splits'>
export type ExpenseCategory = Tables<'expense_categories'> & {
  parent_category_id: string | null
}
export type Settlement = Tables<'settlements'> & {
  settlement_month: string | null
}
export type Budget = Tables<'budgets'>
export type BudgetMemberLimit = Tables<'budget_member_limits'>
export type BudgetCategory = Tables<'budget_categories'>
export type BudgetIncomeCategory = Tables<'budget_income_categories'>
export type SavingsGoal = Tables<'savings_goals'>
export type SavingsContribution = Tables<'savings_contributions'>
export type Account = Tables<'accounts'>
export type Income = Tables<'incomes'>

// Enum types
export type Visibility = 'shared' | 'private' | 'partner_only'
export type EventType = 'life' | 'financial' | 'anniversary' | 'medical' | 'travel'
export type Priority = 'high' | 'medium' | 'low'
export type TodoStatus = 'pending' | 'in_progress' | 'done'
export type TodoTaskLevel = 'large' | 'medium' | 'small'
export type ExpenseType = 'personal' | 'shared' | 'advance' | 'pending_settlement'
export type PaymentMethod = 'cash' | 'card' | 'transfer'
export type SettlementStatus = 'requested' | 'confirmed' | 'done'
export type AccountType = 'bank' | 'credit' | 'investment' | 'cash'
export type IncomeType = 'salary' | 'bonus' | 'freelance' | 'other'
export type ShoppingCategory = 'food' | 'daily' | 'other' | 'general'
export type LivingMode = 'before_cohabiting' | 'after_cohabiting'
export type TransactionType = 'income' | 'expense'
export type TransactionSource = 'manual' | 'ocr' | 'moneyforward_screenshot' | 'imported' | 'ai'

export type ExpenseWithRelations = Expense & {
  expense_splits?: Array<Pick<ExpenseSplit, 'user_id' | 'amount' | 'ratio' | 'is_settled'>>
}

export interface UnifiedTransaction {
  id: string
  transactionType: TransactionType
  date: string
  type: string
  category: string
  categoryId: string | null
  amount: number
  memo: string
  ownerId: string
  ownerLabel: string
  source: TransactionSource
  rawExpense?: ExpenseWithRelations
  rawIncome?: Income
}
