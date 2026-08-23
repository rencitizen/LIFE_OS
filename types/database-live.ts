import type { Database as BaseDatabase, Json } from './database'

type BaseTables = BaseDatabase['public']['Tables']
type BaseFunctions = BaseDatabase['public']['Functions']

type WithRelationships<T> = T & { Relationships: [] }
type CompatBaseTables = { [K in keyof BaseTables]: WithRelationships<BaseTables[K]> }

type ExpenseRow = BaseTables['expenses']['Row'] & {
  counts_toward_totals: boolean
  external_id: string | null
  external_provider: string | null
  import_meta: Json
  record_kind: string
}
type ExpenseInsert = BaseTables['expenses']['Insert'] & {
  counts_toward_totals?: boolean
  external_id?: string | null
  external_provider?: string | null
  import_meta?: Json
  record_kind?: string
}
type ExpenseUpdate = BaseTables['expenses']['Update'] & {
  counts_toward_totals?: boolean
  external_id?: string | null
  external_provider?: string | null
  import_meta?: Json
  record_kind?: string
}

type ChatGptLogRow = BaseTables['chatgpt_action_logs']['Row'] & {
  origin_id: string | null
  origin_table: string | null
}
type ChatGptLogInsert = BaseTables['chatgpt_action_logs']['Insert'] & {
  origin_id?: string | null
  origin_table?: string | null
}
type ChatGptLogUpdate = BaseTables['chatgpt_action_logs']['Update'] & {
  origin_id?: string | null
  origin_table?: string | null
}

type FinancePlanItemRow = {
  category: string | null
  couple_id: string
  created_at: string
  created_by: string | null
  current_amount: number | null
  description: string | null
  horizon: string
  id: string
  priority: string
  raw_input: string | null
  source: string
  status: string
  target_amount: number | null
  target_date: string | null
  title: string
  updated_at: string
}

type FinancePlanActionRow = {
  action: string
  couple_id: string
  created_at: string
  id: string
  payload: Json
  plan_item_id: string | null
  raw_input: string | null
  source: string
  user_id: string | null
}

type MoneyForwardRunRow = {
  couple_id: string
  created_at: string
  errors: Json
  failed_count: number
  file_name: string | null
  id: string
  inserted_count: number
  linked_existing_count: number
  rows_total: number
  unchanged_count: number
  user_id: string | null
}

type MonthlySnapshotRow = {
  archived_at: string
  couple_id: string
  id: string
  original_expense_id: string
  payload: Json
  snapshot_month: string
}

type BucketListItemRow = {
  category: string | null
  couple_id: string
  created_at: string
  created_by: string
  id: string
  memo: string | null
  title: string
}

type SimpleTable<T> = {
  Row: T
  Insert: Partial<T>
  Update: Partial<T>
  Relationships: []
}

type BucketListItemTable = {
  Row: BucketListItemRow
  Insert: Omit<BucketListItemRow, 'id' | 'created_at'> & {
    id?: string
    created_at?: string
  }
  Update: Partial<BucketListItemRow>
  Relationships: []
}

type FinancePlanItemTable = {
  Row: FinancePlanItemRow
  Insert: Omit<FinancePlanItemRow, 'id' | 'created_at' | 'updated_at'> & {
    id?: string
    created_at?: string
    updated_at?: string
  }
  Update: Partial<FinancePlanItemRow>
  Relationships: []
}

type LiveTables = Omit<CompatBaseTables, 'expenses' | 'chatgpt_action_logs'> & {
  expenses: {
    Row: ExpenseRow
    Insert: ExpenseInsert
    Update: ExpenseUpdate
    Relationships: []
  }
  chatgpt_action_logs: {
    Row: ChatGptLogRow
    Insert: ChatGptLogInsert
    Update: ChatGptLogUpdate
    Relationships: []
  }
  bucket_list_items: BucketListItemTable
  expense_monthly_snapshots: SimpleTable<MonthlySnapshotRow>
  finance_plan_items: FinancePlanItemTable
  finance_plan_action_logs: SimpleTable<FinancePlanActionRow>
  moneyforward_import_runs: SimpleTable<MoneyForwardRunRow>
}

type MoneyForwardPayload = {
  expense_date: string
  amount: number
  description: string
  category_name: string
  parent_category_name?: string | null
  external_id?: string | null
  payment_method?: 'cash' | 'card' | 'transfer' | null
  is_settlement_target?: boolean
  raw_payload?: Record<string, string>
}

type LiveFunctions = BaseFunctions & {
  archive_moneyforward_snapshots_for_month: {
    Args: { p_couple_id: string; p_month: string }
    Returns: number
  }
  delete_app_expense: { Args: { p_expense_id: string }; Returns: string }
  delete_app_todo: { Args: { p_todo_id: string }; Returns: string }
  delete_chatgpt_bucket_list_item: {
    Args: { p_confirmed?: boolean; p_item_id: string; p_raw_input?: string | null; p_user_id: string }
    Returns: string
  }
  import_moneyforward_rows: {
    Args: { p_file_name?: string | null; p_paid_by: string; p_rows: MoneyForwardPayload[]; p_user_id: string }
    Returns: Array<{
      errors: Json
      failed_count: number
      inserted_count: number
      linked_existing_count: number
      rows_total: number
      run_id: string
      unchanged_count: number
    }>
  }
  register_app_expense: { Args: { p_payload: ExpenseInsert }; Returns: ExpenseRow }
  update_app_expense: { Args: { p_changes: ExpenseUpdate; p_expense_id: string }; Returns: ExpenseRow }
  register_app_todo: { Args: { p_payload: BaseTables['todos']['Insert'] }; Returns: BaseTables['todos']['Row'] }
  register_app_todos: { Args: { p_payloads: BaseTables['todos']['Insert'][] }; Returns: BaseTables['todos']['Row'][] }
  update_app_todo: { Args: { p_changes: BaseTables['todos']['Update']; p_todo_id: string }; Returns: BaseTables['todos']['Row'] }
  register_chatgpt_bucket_list_item: {
    Args: {
      p_category?: string | null
      p_memo?: string | null
      p_raw_input?: string | null
      p_title: string
      p_user_id: string
    }
    Returns: BucketListItemRow
  }
  update_chatgpt_bucket_list_item: {
    Args: { p_changes: Json; p_item_id: string; p_raw_input?: string | null; p_user_id: string }
    Returns: BucketListItemRow
  }
  resolve_expense_category_id: {
    Args: { p_category_name: string; p_couple_id: string; p_parent_category_name?: string | null }
    Returns: string
  }
  upsert_chatgpt_finance_plan_item: {
    Args: {
      p_category?: string | null
      p_current_amount?: number | null
      p_description?: string | null
      p_horizon?: string | null
      p_item_id?: string | null
      p_priority?: string | null
      p_raw_input?: string | null
      p_status?: string | null
      p_target_amount?: number | null
      p_target_date?: string | null
      p_title?: string | null
      p_user_id: string
    }
    Returns: string
  }
  upsert_moneyforward_expense: {
    Args: {
      p_amount: number
      p_category_name: string
      p_description: string | null
      p_expense_date: string
      p_external_id?: string | null
      p_is_settlement_target?: boolean
      p_paid_by: string
      p_parent_category_name?: string | null
      p_payment_method?: string | null
      p_raw_payload?: Json
      p_user_id: string
    }
    Returns: Array<{ expense_id: string; matched_by: string; result_status: string }>
  }
}

export type Database = Omit<BaseDatabase, 'public'> & {
  public: Omit<BaseDatabase['public'], 'Tables' | 'Functions'> & {
    Tables: LiveTables
    Functions: LiveFunctions
  }
}

export type { Json }
