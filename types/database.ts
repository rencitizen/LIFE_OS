export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          account_type: string | null
          balance: number | null
          billing_date: number | null
          closing_date: number | null
          couple_id: string | null
          created_at: string | null
          credit_limit: number | null
          id: string
          is_shared: boolean | null
          last_synced_at: string | null
          name: string
          owner_id: string | null
        }
        Insert: {
          account_type?: string | null
          balance?: number | null
          billing_date?: number | null
          closing_date?: number | null
          couple_id?: string | null
          created_at?: string | null
          credit_limit?: number | null
          id?: string
          is_shared?: boolean | null
          last_synced_at?: string | null
          name: string
          owner_id?: string | null
        }
        Update: {
          account_type?: string | null
          balance?: number | null
          billing_date?: number | null
          closing_date?: number | null
          couple_id?: string | null
          created_at?: string | null
          credit_limit?: number | null
          id?: string
          is_shared?: boolean | null
          last_synced_at?: string | null
          name?: string
          owner_id?: string | null
        }
      }
      budget_categories: {
        Row: {
          alert_ratio: number | null
          budget_id: string | null
          category_id: string | null
          id: string
          limit_amount: number | null
        }
        Insert: {
          alert_ratio?: number | null
          budget_id?: string | null
          category_id?: string | null
          id?: string
          limit_amount?: number | null
        }
        Update: {
          alert_ratio?: number | null
          budget_id?: string | null
          category_id?: string | null
          id?: string
          limit_amount?: number | null
        }
      }
      budget_income_categories: {
        Row: {
          budget_id: string
          created_at: string
          id: string
          income_type: string
          planned_amount: number
          scenario: string
        }
        Insert: {
          budget_id: string
          created_at?: string
          id?: string
          income_type: string
          planned_amount?: number
          scenario?: string
        }
        Update: {
          budget_id?: string
          created_at?: string
          id?: string
          income_type?: string
          planned_amount?: number
          scenario?: string
        }
      }
      budget_member_limits: {
        Row: {
          budget_id: string
          created_at: string | null
          id: string
          limit_amount: number
          user_id: string
        }
        Insert: {
          budget_id: string
          created_at?: string | null
          id?: string
          limit_amount?: number
          user_id: string
        }
        Update: {
          budget_id?: string
          created_at?: string | null
          id?: string
          limit_amount?: number
          user_id?: string
        }
      }
      budgets: {
        Row: {
          couple_id: string | null
          created_at: string | null
          id: string
          total_limit: number | null
          year_month: string
        }
        Insert: {
          couple_id?: string | null
          created_at?: string | null
          id?: string
          total_limit?: number | null
          year_month: string
        }
        Update: {
          couple_id?: string | null
          created_at?: string | null
          id?: string
          total_limit?: number | null
          year_month?: string
        }
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          color: string | null
          couple_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_at: string | null
          event_type: string | null
          id: string
          is_recurring: boolean | null
          linked_amount: number | null
          location: string | null
          recurrence_rule: string | null
          start_at: string
          title: string
          visibility: string | null
        }
        Insert: {
          all_day?: boolean | null
          color?: string | null
          couple_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          event_type?: string | null
          id?: string
          is_recurring?: boolean | null
          linked_amount?: number | null
          location?: string | null
          recurrence_rule?: string | null
          start_at: string
          title: string
          visibility?: string | null
        }
        Update: {
          all_day?: boolean | null
          color?: string | null
          couple_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          event_type?: string | null
          id?: string
          is_recurring?: boolean | null
          linked_amount?: number | null
          location?: string | null
          recurrence_rule?: string | null
          start_at?: string
          title?: string
          visibility?: string | null
        }
      }
      chatgpt_action_logs: {
        Row: {
          action: string
          couple_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          error_message: string | null
          id: string
          payload: Json
          raw_input: string | null
          source: string
          status: string
          user_id: string | null
        }
        Insert: {
          action: string
          couple_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          error_message?: string | null
          id?: string
          payload?: Json
          raw_input?: string | null
          source?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          couple_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          error_message?: string | null
          id?: string
          payload?: Json
          raw_input?: string | null
          source?: string
          status?: string
          user_id?: string | null
        }
      }
      couples: {
        Row: {
          created_at: string | null
          currency: string | null
          id: string
          invite_code: string
          living_mode: string
          name: string | null
          timezone: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          id?: string
          invite_code: string
          living_mode?: string
          name?: string | null
          timezone?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          id?: string
          invite_code?: string
          living_mode?: string
          name?: string | null
          timezone?: string | null
        }
      }
      event_reminders: {
        Row: {
          created_at: string | null
          event_id: string | null
          id: string
          is_sent: boolean | null
          remind_at: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          is_sent?: boolean | null
          remind_at: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          is_sent?: boolean | null
          remind_at?: string
          type?: string | null
        }
      }
      expense_categories: {
        Row: {
          color: string | null
          couple_id: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_default: boolean | null
          name: string
          parent_category_id: string | null
          sort_order: number | null
        }
        Insert: {
          color?: string | null
          couple_id?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          parent_category_id?: string | null
          sort_order?: number | null
        }
        Update: {
          color?: string | null
          couple_id?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          parent_category_id?: string | null
          sort_order?: number | null
        }
      }
      expense_split_profile_members: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          ratio: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          ratio: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          ratio?: number
          user_id?: string
        }
      }
      expense_split_profiles: {
        Row: {
          basis: string
          couple_id: string
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          note: string | null
        }
        Insert: {
          basis?: string
          couple_id: string
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          note?: string | null
        }
        Update: {
          basis?: string
          couple_id?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          note?: string | null
        }
      }
      expense_splits: {
        Row: {
          amount: number | null
          expense_id: string | null
          id: string
          is_settled: boolean | null
          ratio: number | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          expense_id?: string | null
          id?: string
          is_settled?: boolean | null
          ratio?: number | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          expense_id?: string | null
          id?: string
          is_settled?: boolean | null
          ratio?: number | null
          user_id?: string | null
        }
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          couple_id: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          expense_date: string
          expense_type: string | null
          id: string
          is_fixed: boolean | null
          is_settlement_target: boolean
          notes: string | null
          paid_by: string | null
          payment_method: string | null
          receipt_url: string | null
          source: string | null
          split_mode: string
          split_profile_id: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          couple_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          expense_date: string
          expense_type?: string | null
          id?: string
          is_fixed?: boolean | null
          is_settlement_target?: boolean
          notes?: string | null
          paid_by?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          source?: string | null
          split_mode?: string
          split_profile_id?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          couple_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          expense_date?: string
          expense_type?: string | null
          id?: string
          is_fixed?: boolean | null
          is_settlement_target?: boolean
          notes?: string | null
          paid_by?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          source?: string | null
          split_mode?: string
          split_profile_id?: string | null
        }
      }
      finance_action_logs: {
        Row: {
          action: string
          couple_id: string
          created_at: string
          error_message: string | null
          expense_id: string | null
          id: string
          payload: Json
          raw_input: string | null
          settlement_id: string | null
          source: string
          status: string
          user_id: string | null
        }
        Insert: {
          action: string
          couple_id: string
          created_at?: string
          error_message?: string | null
          expense_id?: string | null
          id?: string
          payload?: Json
          raw_input?: string | null
          settlement_id?: string | null
          source?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          couple_id?: string
          created_at?: string
          error_message?: string | null
          expense_id?: string | null
          id?: string
          payload?: Json
          raw_input?: string | null
          settlement_id?: string | null
          source?: string
          status?: string
          user_id?: string | null
        }
      }
      idea_items: {
        Row: {
          couple_id: string
          created_at: string
          created_by: string
          id: string
          memo: string | null
          status: string
          title: string
        }
        Insert: {
          couple_id: string
          created_at?: string
          created_by: string
          id?: string
          memo?: string | null
          status?: string
          title: string
        }
        Update: {
          couple_id?: string
          created_at?: string
          created_by?: string
          id?: string
          memo?: string | null
          status?: string
          title?: string
        }
      }
      incomes: {
        Row: {
          amount: number
          couple_id: string | null
          created_at: string | null
          description: string | null
          id: string
          income_date: string
          income_type: string | null
          is_fixed: boolean | null
          user_id: string | null
        }
        Insert: {
          amount: number
          couple_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          income_date: string
          income_type?: string | null
          is_fixed?: boolean | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          couple_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          income_date?: string
          income_type?: string | null
          is_fixed?: boolean | null
          user_id?: string | null
        }
      }
      life_plans: {
        Row: {
          assumptions: Json
          couple_id: string | null
          created_at: string | null
          id: string
          income_data: Json
          initial_assets: Json
          life_events: Json
          living_costs: Json
          updated_at: string | null
        }
        Insert: {
          assumptions?: Json
          couple_id?: string | null
          created_at?: string | null
          id?: string
          income_data?: Json
          initial_assets?: Json
          life_events?: Json
          living_costs?: Json
          updated_at?: string | null
        }
        Update: {
          assumptions?: Json
          couple_id?: string | null
          created_at?: string | null
          id?: string
          income_data?: Json
          initial_assets?: Json
          life_events?: Json
          living_costs?: Json
          updated_at?: string | null
        }
      }
      savings_contributions: {
        Row: {
          amount: number
          created_at: string | null
          goal_id: string | null
          id: string
          memo: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          goal_id?: string | null
          id?: string
          memo?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          goal_id?: string | null
          id?: string
          memo?: string | null
          user_id?: string | null
        }
      }
      savings_goals: {
        Row: {
          color: string | null
          couple_id: string | null
          created_at: string | null
          current_amount: number | null
          icon: string | null
          id: string
          status: string | null
          target_amount: number | null
          target_date: string | null
          title: string
        }
        Insert: {
          color?: string | null
          couple_id?: string | null
          created_at?: string | null
          current_amount?: number | null
          icon?: string | null
          id?: string
          status?: string | null
          target_amount?: number | null
          target_date?: string | null
          title: string
        }
        Update: {
          color?: string | null
          couple_id?: string | null
          created_at?: string | null
          current_amount?: number | null
          icon?: string | null
          id?: string
          status?: string | null
          target_amount?: number | null
          target_date?: string | null
          title?: string
        }
      }
      settlements: {
        Row: {
          amount: number
          couple_id: string | null
          created_at: string | null
          from_user: string | null
          id: string
          memo: string | null
          settled_at: string | null
          settlement_month: string | null
          status: string | null
          to_user: string | null
        }
        Insert: {
          amount: number
          couple_id?: string | null
          created_at?: string | null
          from_user?: string | null
          id?: string
          memo?: string | null
          settled_at?: string | null
          settlement_month?: string | null
          status?: string | null
          to_user?: string | null
        }
        Update: {
          amount?: number
          couple_id?: string | null
          created_at?: string | null
          from_user?: string | null
          id?: string
          memo?: string | null
          settled_at?: string | null
          settlement_month?: string | null
          status?: string | null
          to_user?: string | null
        }
      }
      shopping_items: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          created_at: string | null
          estimated_price: number | null
          expense_created: boolean | null
          id: string
          is_checked: boolean | null
          list_id: string | null
          memo: string | null
          name: string
          priority: string | null
          quantity: number | null
          unit: string | null
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string | null
          estimated_price?: number | null
          expense_created?: boolean | null
          id?: string
          is_checked?: boolean | null
          list_id?: string | null
          memo?: string | null
          name: string
          priority?: string | null
          quantity?: number | null
          unit?: string | null
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string | null
          estimated_price?: number | null
          expense_created?: boolean | null
          id?: string
          is_checked?: boolean | null
          list_id?: string | null
          memo?: string | null
          name?: string
          priority?: string | null
          quantity?: number | null
          unit?: string | null
        }
      }
      shopping_lists: {
        Row: {
          category: string | null
          couple_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          category?: string | null
          couple_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          category?: string | null
          couple_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
      }
      todo_action_logs: {
        Row: {
          action: string
          couple_id: string
          created_at: string
          error_message: string | null
          id: string
          payload: Json
          raw_input: string | null
          source: string
          status: string
          todo_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          couple_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json
          raw_input?: string | null
          source?: string
          status?: string
          todo_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          couple_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json
          raw_input?: string | null
          source?: string
          status?: string
          todo_id?: string | null
          user_id?: string | null
        }
      }
      todos: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          couple_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          end_date: string | null
          event_id: string | null
          id: string
          is_recurring: boolean | null
          parent_todo_id: string | null
          priority: string | null
          recurrence_rule: string | null
          start_date: string | null
          status: string | null
          task_level: string
          title: string
          visibility: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          couple_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          end_date?: string | null
          event_id?: string | null
          id?: string
          is_recurring?: boolean | null
          parent_todo_id?: string | null
          priority?: string | null
          recurrence_rule?: string | null
          start_date?: string | null
          status?: string | null
          task_level?: string
          title: string
          visibility?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          couple_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          end_date?: string | null
          event_id?: string | null
          id?: string
          is_recurring?: boolean | null
          parent_todo_id?: string | null
          priority?: string | null
          recurrence_rule?: string | null
          start_date?: string | null
          status?: string | null
          task_level?: string
          title?: string
          visibility?: string | null
        }
      }
      users: {
        Row: {
          avatar_url: string | null
          color: string | null
          couple_id: string | null
          created_at: string | null
          display_name: string
          email: string | null
          id: string
          role: string | null
        }
        Insert: {
          avatar_url?: string | null
          color?: string | null
          couple_id?: string | null
          created_at?: string | null
          display_name: string
          email?: string | null
          id: string
          role?: string | null
        }
        Update: {
          avatar_url?: string | null
          color?: string | null
          couple_id?: string | null
          created_at?: string | null
          display_name?: string
          email?: string | null
          id?: string
          role?: string | null
        }
      }
    }
    Functions: {
      complete_chatgpt_idea_item: {
        Args: { p_item_id: string; p_raw_input?: string; p_user_id: string }
        Returns: Database['public']['Tables']['idea_items']['Row']
      }
      complete_chatgpt_todo: {
        Args: { p_raw_input?: string; p_todo_id: string; p_user_id: string }
        Returns: Database['public']['Tables']['todos']['Row']
      }
      complete_monthly_settlement: {
        Args: { p_memo?: string; p_month: string; p_user_id: string }
        Returns: Array<{
          amount: number
          expense_count: number
          from_user: string
          gross_amount: number
          settlement_id: string
          settlement_month: string
          to_user: string
        }>
      }
      create_couple_for_current_user: {
        Args: { p_name: string }
        Returns: Database['public']['Tables']['couples']['Row']
      }
      delete_chatgpt_calendar_event: {
        Args: { p_confirmed?: boolean; p_event_id: string; p_raw_input?: string; p_user_id: string }
        Returns: string
      }
      delete_chatgpt_idea_item: {
        Args: { p_confirmed?: boolean; p_item_id: string; p_raw_input?: string; p_user_id: string }
        Returns: string
      }
      delete_chatgpt_shopping_item: {
        Args: { p_confirmed?: boolean; p_item_id: string; p_raw_input?: string; p_user_id: string }
        Returns: string
      }
      delete_chatgpt_todo: {
        Args: { p_confirmed?: boolean; p_raw_input?: string; p_todo_id: string; p_user_id: string }
        Returns: string
      }
      generate_invite_code: {
        Args: Record<string, never>
        Returns: string
      }
      get_couple_id: {
        Args: Record<string, never>
        Returns: string
      }
      join_couple_for_current_user: {
        Args: { p_invite_code: string }
        Returns: Database['public']['Tables']['couples']['Row']
      }
      preview_monthly_settlement: {
        Args: { p_month: string; p_user_id: string }
        Returns: Array<{
          amount: number
          couple_id: string
          expense_count: number
          from_user: string
          gross_amount: number
          settlement_month: string
          to_user: string
        }>
      }
      rebuild_expense_splits: {
        Args: { p_expense_id: string }
        Returns: undefined
      }
      register_chatgpt_calendar_event: {
        Args: {
          p_all_day?: boolean
          p_description?: string
          p_end_at?: string
          p_event_type?: string
          p_linked_amount?: number
          p_location?: string
          p_raw_input?: string
          p_start_at: string
          p_title: string
          p_user_id: string
          p_visibility?: string
        }
        Returns: Database['public']['Tables']['calendar_events']['Row']
      }
      register_chatgpt_expense: {
        Args: {
          p_amount: number
          p_category_name: string
          p_description?: string
          p_expense_date: string
          p_expense_type?: string
          p_is_settlement_target?: boolean
          p_paid_by: string
          p_parent_category_name?: string
          p_payment_method?: string
          p_raw_input?: string
        }
        Returns: Array<{
          category_id: string
          expense_id: string
          split_mode: string
          split_profile_id: string
        }>
      }
      register_chatgpt_idea_item: {
        Args: { p_memo?: string; p_raw_input?: string; p_title: string; p_user_id: string }
        Returns: Database['public']['Tables']['idea_items']['Row']
      }
      register_chatgpt_shopping_item: {
        Args: {
          p_estimated_price?: number
          p_list_id: string
          p_memo?: string
          p_name: string
          p_priority?: string
          p_quantity?: number
          p_raw_input?: string
          p_unit?: string
          p_user_id: string
        }
        Returns: Database['public']['Tables']['shopping_items']['Row']
      }
      register_chatgpt_todo: {
        Args: {
          p_assigned_to?: string
          p_description?: string
          p_due_date?: string
          p_end_date?: string
          p_parent_todo_id?: string
          p_priority?: string
          p_raw_input?: string
          p_start_date?: string
          p_task_level?: string
          p_title: string
          p_user_id: string
          p_visibility?: string
        }
        Returns: Database['public']['Tables']['todos']['Row']
      }
      register_manual_expense: {
        Args: {
          p_amount: number
          p_category_id: string
          p_description?: string
          p_expense_date: string
          p_expense_type?: string
          p_is_settlement_target?: boolean
          p_paid_by: string
          p_payment_method?: string
          p_user_id: string
        }
        Returns: Database['public']['Tables']['expenses']['Row']
      }
      set_chatgpt_shopping_item_checked: {
        Args: { p_checked: boolean; p_item_id: string; p_raw_input?: string; p_user_id: string }
        Returns: Database['public']['Tables']['shopping_items']['Row']
      }
      update_chatgpt_calendar_event: {
        Args: { p_changes: Json; p_event_id: string; p_raw_input?: string; p_user_id: string }
        Returns: Database['public']['Tables']['calendar_events']['Row']
      }
      update_chatgpt_expense: {
        Args: {
          p_amount?: number
          p_category_name?: string
          p_description?: string
          p_expense_date?: string
          p_expense_id: string
          p_expense_type?: string
          p_is_settlement_target?: boolean
          p_parent_category_name?: string
          p_payment_method?: string
          p_raw_input?: string
          p_user_id: string
        }
        Returns: Array<{
          category_id: string
          expense_id: string
          split_mode: string
          split_profile_id: string
        }>
      }
      update_chatgpt_idea_item: {
        Args: { p_changes: Json; p_item_id: string; p_raw_input?: string; p_user_id: string }
        Returns: Database['public']['Tables']['idea_items']['Row']
      }
      update_chatgpt_shopping_item: {
        Args: { p_changes: Json; p_item_id: string; p_raw_input?: string; p_user_id: string }
        Returns: Database['public']['Tables']['shopping_items']['Row']
      }
      update_chatgpt_todo: {
        Args: { p_changes: Json; p_raw_input?: string; p_todo_id: string; p_user_id: string }
        Returns: Database['public']['Tables']['todos']['Row']
      }
      update_expense_with_splits: {
        Args: {
          p_amount: number
          p_category_id: string
          p_description: string
          p_expense_date: string
          p_expense_id: string
          p_expense_type: string
          p_is_settlement_target: boolean
          p_payment_method: string
          p_user_id: string
        }
        Returns: Database['public']['Tables']['expenses']['Row']
      }
    }
    Enums: Record<string, never>
  }
}
