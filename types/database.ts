export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      couples: {
        Row: {
          id: string
          name: string | null
          invite_code: string
          currency: string
          timezone: string
          living_mode: string
          created_at: string
        }
        Insert: {
          id?: string
          name?: string | null
          invite_code: string
          currency?: string
          timezone?: string
          living_mode?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string | null
          invite_code?: string
          currency?: string
          timezone?: string
          living_mode?: string
          created_at?: string
        }
      }
      users: {
        Row: {
          id: string
          couple_id: string | null
          display_name: string
          avatar_url: string | null
          email: string | null
          color: string
          role: string
          created_at: string
        }
        Insert: {
          id: string
          couple_id?: string | null
          display_name: string
          avatar_url?: string | null
          email?: string | null
          color?: string
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          couple_id?: string | null
          display_name?: string
          avatar_url?: string | null
          email?: string | null
          color?: string
          role?: string
          created_at?: string
        }
      }
      expense_categories: {
        Row: {
          id: string
          couple_id: string
          name: string
          icon: string | null
          color: string | null
          is_default: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          couple_id: string
          name: string
          icon?: string | null
          color?: string | null
          is_default?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          couple_id?: string
          name?: string
          icon?: string | null
          color?: string | null
          is_default?: boolean
          sort_order?: number
          created_at?: string
        }
      }
      calendar_events: {
        Row: {
          id: string
          couple_id: string
          created_by: string
          title: string
          description: string | null
          start_at: string
          end_at: string | null
          all_day: boolean
          visibility: string
          event_type: string
          is_recurring: boolean
          recurrence_rule: string | null
          color: string | null
          location: string | null
          linked_amount: number | null
          created_at: string
        }
        Insert: {
          id?: string
          couple_id: string
          created_by: string
          title: string
          description?: string | null
          start_at: string
          end_at?: string | null
          all_day?: boolean
          visibility?: string
          event_type?: string
          is_recurring?: boolean
          recurrence_rule?: string | null
          color?: string | null
          location?: string | null
          linked_amount?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          couple_id?: string
          created_by?: string
          title?: string
          description?: string | null
          start_at?: string
          end_at?: string | null
          all_day?: boolean
          visibility?: string
          event_type?: string
          is_recurring?: boolean
          recurrence_rule?: string | null
          color?: string | null
          location?: string | null
          linked_amount?: number | null
          created_at?: string
        }
      }
      event_reminders: {
        Row: {
          id: string
          event_id: string
          remind_at: string
          type: string
          is_sent: boolean
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          remind_at: string
          type?: string
          is_sent?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          remind_at?: string
          type?: string
          is_sent?: boolean
          created_at?: string
        }
      }
      shopping_lists: {
        Row: {
          id: string
          couple_id: string
          name: string
          category: string
          is_active: boolean
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          couple_id: string
          name: string
          category?: string
          is_active?: boolean
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          couple_id?: string
          name?: string
          category?: string
          is_active?: boolean
          created_by?: string
          created_at?: string
        }
      }
      shopping_items: {
        Row: {
          id: string
          list_id: string
          name: string
          memo: string | null
          quantity: number | null
          unit: string | null
          estimated_price: number | null
          priority: string
          is_checked: boolean
          checked_by: string | null
          checked_at: string | null
          expense_created: boolean
          created_at: string
        }
        Insert: {
          id?: string
          list_id: string
          name: string
          memo?: string | null
          quantity?: number | null
          unit?: string | null
          estimated_price?: number | null
          priority?: string
          is_checked?: boolean
          checked_by?: string | null
          checked_at?: string | null
          expense_created?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          list_id?: string
          name?: string
          memo?: string | null
          quantity?: number | null
          unit?: string | null
          estimated_price?: number | null
          priority?: string
          is_checked?: boolean
          checked_by?: string | null
          checked_at?: string | null
          expense_created?: boolean
          created_at?: string
        }
      }
      todos: {
        Row: {
          id: string
          couple_id: string
          created_by: string
          assigned_to: string | null
          title: string
          description: string | null
          due_date: string | null
          start_date: string | null
          end_date: string | null
          priority: string
          status: string
          visibility: string
          event_id: string | null
          is_recurring: boolean
          recurrence_rule: string | null
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          couple_id: string
          created_by: string
          assigned_to?: string | null
          title: string
          description?: string | null
          due_date?: string | null
          start_date?: string | null
          end_date?: string | null
          priority?: string
          status?: string
          visibility?: string
          event_id?: string | null
          is_recurring?: boolean
          recurrence_rule?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          couple_id?: string
          created_by?: string
          assigned_to?: string | null
          title?: string
          description?: string | null
          due_date?: string | null
          start_date?: string | null
          end_date?: string | null
          priority?: string
          status?: string
          visibility?: string
          event_id?: string | null
          is_recurring?: boolean
          recurrence_rule?: string | null
          completed_at?: string | null
          created_at?: string
        }
      }
      expenses: {
        Row: {
          id: string
          couple_id: string
          paid_by: string
          amount: number
          currency: string
          category_id: string | null
          description: string | null
          expense_date: string
          expense_type: string
          payment_method: string | null
          is_fixed: boolean
          receipt_url: string | null
          source: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          couple_id: string
          paid_by: string
          amount: number
          currency?: string
          category_id?: string | null
          description?: string | null
          expense_date: string
          expense_type?: string
          payment_method?: string | null
          is_fixed?: boolean
          receipt_url?: string | null
          source?: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          couple_id?: string
          paid_by?: string
          amount?: number
          currency?: string
          category_id?: string | null
          description?: string | null
          expense_date?: string
          expense_type?: string
          payment_method?: string | null
          is_fixed?: boolean
          receipt_url?: string | null
          source?: string
          notes?: string | null
          created_at?: string
        }
      }
      expense_splits: {
        Row: {
          id: string
          expense_id: string
          user_id: string
          ratio: number | null
          amount: number | null
          is_settled: boolean
        }
        Insert: {
          id?: string
          expense_id: string
          user_id: string
          ratio?: number | null
          amount?: number | null
          is_settled?: boolean
        }
        Update: {
          id?: string
          expense_id?: string
          user_id?: string
          ratio?: number | null
          amount?: number | null
          is_settled?: boolean
        }
      }
      settlements: {
        Row: {
          id: string
          couple_id: string
          from_user: string
          to_user: string
          amount: number
          settled_at: string | null
          status: string
          memo: string | null
          created_at: string
        }
        Insert: {
          id?: string
          couple_id: string
          from_user: string
          to_user: string
          amount: number
          settled_at?: string | null
          status?: string
          memo?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          couple_id?: string
          from_user?: string
          to_user?: string
          amount?: number
          settled_at?: string | null
          status?: string
          memo?: string | null
          created_at?: string
        }
      }
      budgets: {
        Row: {
          id: string
          couple_id: string
          year_month: string
          total_limit: number | null
          created_at: string
        }
        Insert: {
          id?: string
          couple_id: string
          year_month: string
          total_limit?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          couple_id?: string
          year_month?: string
          total_limit?: number | null
          created_at?: string
        }
      }
      budget_member_limits: {
        Row: {
          id: string
          budget_id: string
          user_id: string
          limit_amount: number
          created_at: string | null
        }
        Insert: {
          id?: string
          budget_id: string
          user_id: string
          limit_amount?: number
          created_at?: string | null
        }
        Update: {
          id?: string
          budget_id?: string
          user_id?: string
          limit_amount?: number
          created_at?: string | null
        }
      }
      budget_categories: {
        Row: {
          id: string
          budget_id: string
          category_id: string
          limit_amount: number | null
          alert_ratio: number
        }
        Insert: {
          id?: string
          budget_id: string
          category_id: string
          limit_amount?: number | null
          alert_ratio?: number
        }
        Update: {
          id?: string
          budget_id?: string
          category_id?: string
          limit_amount?: number | null
          alert_ratio?: number
        }
      }
      budget_income_categories: {
        Row: {
          id: string
          budget_id: string
          income_type: string
          scenario: string
          planned_amount: number
          created_at: string
        }
        Insert: {
          id?: string
          budget_id: string
          income_type: string
          scenario?: string
          planned_amount?: number
          created_at?: string
        }
        Update: {
          id?: string
          budget_id?: string
          income_type?: string
          scenario?: string
          planned_amount?: number
          created_at?: string
        }
      }
      savings_goals: {
        Row: {
          id: string
          couple_id: string
          title: string
          target_amount: number | null
          current_amount: number
          target_date: string | null
          icon: string | null
          color: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          couple_id: string
          title: string
          target_amount?: number | null
          current_amount?: number
          target_date?: string | null
          icon?: string | null
          color?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          couple_id?: string
          title?: string
          target_amount?: number | null
          current_amount?: number
          target_date?: string | null
          icon?: string | null
          color?: string | null
          status?: string
          created_at?: string
        }
      }
      savings_contributions: {
        Row: {
          id: string
          goal_id: string
          user_id: string
          amount: number
          memo: string | null
          created_at: string
        }
        Insert: {
          id?: string
          goal_id: string
          user_id: string
          amount: number
          memo?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          goal_id?: string
          user_id?: string
          amount?: number
          memo?: string | null
          created_at?: string
        }
      }
      accounts: {
        Row: {
          id: string
          couple_id: string
          owner_id: string
          name: string
          account_type: string | null
          balance: number | null
          credit_limit: number | null
          billing_date: number | null
          closing_date: number | null
          last_synced_at: string | null
          is_shared: boolean
          created_at: string
        }
        Insert: {
          id?: string
          couple_id: string
          owner_id: string
          name: string
          account_type?: string | null
          balance?: number | null
          credit_limit?: number | null
          billing_date?: number | null
          closing_date?: number | null
          last_synced_at?: string | null
          is_shared?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          couple_id?: string
          owner_id?: string
          name?: string
          account_type?: string | null
          balance?: number | null
          credit_limit?: number | null
          billing_date?: number | null
          closing_date?: number | null
          last_synced_at?: string | null
          is_shared?: boolean
          created_at?: string
        }
      }
      incomes: {
        Row: {
          id: string
          couple_id: string
          user_id: string
          amount: number
          income_type: string
          description: string | null
          income_date: string
          is_fixed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          couple_id: string
          user_id: string
          amount: number
          income_type?: string
          description?: string | null
          income_date: string
          is_fixed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          couple_id?: string
          user_id?: string
          amount?: number
          income_type?: string
          description?: string | null
          income_date?: string
          is_fixed?: boolean
          created_at?: string
        }
      }
    }
    Functions: {
      couple_id: {
        Args: Record<string, never>
        Returns: string
      }
      generate_invite_code: {
        Args: Record<string, never>
        Returns: string
      }
    }
    Enums: Record<string, never>
  }
}
