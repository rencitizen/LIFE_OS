export type { Database } from './database-live'
import type { Database } from './database-live'

// Raw database helpers. These mirror Supabase exactly, including nullable legacy columns.
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

type NormalizeRequired<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: NonNullable<T[P]>
}

// UI-facing entity aliases. LIFE_OS historically treats these default-backed legacy
// columns as populated. Keep that application contract separate from the raw DB type.
export type Couple = NormalizeRequired<Tables<'couples'>, 'currency' | 'timezone' | 'created_at'>
export type User = NormalizeRequired<Tables<'users'>, 'color' | 'role' | 'created_at'>
export type CalendarEvent = NormalizeRequired<
  Tables<'calendar_events'>,
  'couple_id' | 'created_by' | 'all_day' | 'visibility' | 'event_type' | 'is_recurring' | 'created_at'
>
export type EventReminder = NormalizeRequired<Tables<'event_reminders'>, 'event_id' | 'is_sent' | 'type' | 'created_at'>
export type ShoppingList = NormalizeRequired<
  Tables<'shopping_lists'>,
  'couple_id' | 'category' | 'is_active' | 'created_by' | 'created_at'
>
export type ShoppingItem = NormalizeRequired<
  Tables<'shopping_items'>,
  'list_id' | 'priority' | 'is_checked' | 'expense_created' | 'created_at'
>
export type Todo = NormalizeRequired<
  Tables<'todos'>,
  'couple_id' | 'created_by' | 'priority' | 'status' | 'visibility' | 'is_recurring' | 'created_at'
>
export type IdeaItem = Tables<'idea_items'>
export type BucketListItem = Tables<'bucket_list_items'>
export type Expense = NormalizeRequired<
  Tables<'expenses'>,
  'couple_id' | 'paid_by' | 'currency' | 'expense_type' | 'is_fixed' | 'source' | 'created_at' | 'counts_toward_totals' | 'record_kind' | 'import_meta'
> & {
  split_mode: 'none' | 'standard' | 'custom' | 'full_payer'
}
export type ExpenseSplit = NormalizeRequired<Tables<'expense_splits'>, 'expense_id' | 'user_id' | 'is_settled'>
export type ExpenseCategory = NormalizeRequired<
  Tables<'expense_categories'>,
  'couple_id' | 'is_default' | 'sort_order' | 'created_at'
>
export type Settlement = NormalizeRequired<
  Tables<'settlements'>,
  'couple_id' | 'from_user' | 'to_user' | 'status' | 'created_at'
>
export type Budget = NormalizeRequired<Tables<'budgets'>, 'couple_id' | 'created_at'>
export type BudgetMemberLimit = Tables<'budget_member_limits'>
export type BudgetCategory = NormalizeRequired<
  Tables<'budget_categories'>,
  'budget_id' | 'category_id' | 'alert_ratio'
>
export type BudgetIncomeCategory = Tables<'budget_income_categories'>
export type SavingsGoal = NormalizeRequired<
  Tables<'savings_goals'>,
  'couple_id' | 'current_amount' | 'status' | 'created_at'
>
export type SavingsContribution = NormalizeRequired<
  Tables<'savings_contributions'>,
  'goal_id' | 'user_id' | 'created_at'
>
export type Account = NormalizeRequired<
  Tables<'accounts'>,
  'couple_id' | 'owner_id' | 'is_shared' | 'created_at'
>
export type Income = NormalizeRequired<
  Tables<'incomes'>,
  'couple_id' | 'user_id' | 'income_type' | 'is_fixed' | 'created_at'
>
export type LifePlan = NormalizeRequired<Tables<'life_plans'>, 'couple_id' | 'created_at' | 'updated_at'>

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
