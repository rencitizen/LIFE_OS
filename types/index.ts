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
export type Expense = NormalizeRequired<
  Tables<'expenses'>,
  'couple_id' | 'paid_by' | 'currency' | 'expense_type' | 'is_fixed' | 'source' | 'created_at' | 'counts_toward_totals' | 'record_kind' | 'import_meta'
>
export type ExpenseCategory = NormalizeRequired<Tables<'expense_categories'>, 'couple_id' | 'is_default' | 'sort_order' | 'created_at'>
export type ExpenseSplit = NormalizeRequired<Tables<'expense_splits'>, 'expense_id' | 'user_id' | 'ratio' | 'amount' | 'is_settled'>
export type Settlement = NormalizeRequired<Tables<'settlements'>, 'couple_id' | 'from_user' | 'to_user' | 'status' | 'created_at'>
export type Income = NormalizeRequired<Tables<'incomes'>, 'couple_id' | 'user_id' | 'income_type' | 'is_fixed' | 'created_at'>
export type Budget = NormalizeRequired<Tables<'budgets'>, 'couple_id' | 'created_at'>
export type BudgetCategory = NormalizeRequired<Tables<'budget_categories'>, 'budget_id' | 'category_id' | 'limit_amount' | 'alert_ratio'>
export type BudgetMemberLimit = Tables<'budget_member_limits'>
export type BudgetIncomeCategory = Tables<'budget_income_categories'>
export type SavingsGoal = NormalizeRequired<Tables<'savings_goals'>, 'couple_id' | 'target_amount' | 'current_amount' | 'status' | 'created_at'>
export type SavingsContribution = NormalizeRequired<Tables<'savings_contributions'>, 'goal_id' | 'user_id' | 'created_at'>
export type Account = NormalizeRequired<Tables<'accounts'>, 'couple_id' | 'owner_id' | 'created_at'>
export type LifePlan = NormalizeRequired<Tables<'life_plans'>, 'couple_id' | 'created_at' | 'updated_at'>

export type TransactionType = 'expense' | 'income'
export type UnifiedTransaction = {
  id: string
  transactionType: TransactionType
  amount: number
  date: string
  description: string | null
  ownerId: string | null
  categoryLabel: string
  isFixed: boolean
  raw: Expense | Income
}
