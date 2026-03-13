-- ============================================
-- Couple OS - Initial Schema
-- ============================================

-- Couples
CREATE TABLE couples (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT,
  invite_code   TEXT UNIQUE NOT NULL,
  currency      TEXT DEFAULT 'JPY',
  timezone      TEXT DEFAULT 'Asia/Tokyo',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Users (linked to Supabase Auth)
CREATE TABLE users (
  id            UUID PRIMARY KEY,
  couple_id     UUID REFERENCES couples(id) ON DELETE SET NULL,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  email         TEXT,
  color         TEXT DEFAULT '#85A392',
  role          TEXT DEFAULT 'partner' CHECK (role IN ('partner', 'child', 'extended')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Expense Categories
CREATE TABLE expense_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id   UUID REFERENCES couples(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  icon        TEXT,
  color       TEXT,
  is_default  BOOLEAN DEFAULT false,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Calendar Events
CREATE TABLE calendar_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id       UUID REFERENCES couples(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES users(id),
  title           TEXT NOT NULL,
  description     TEXT,
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ,
  all_day         BOOLEAN DEFAULT false,
  visibility      TEXT DEFAULT 'shared' CHECK (visibility IN ('shared', 'private', 'partner_only')),
  event_type      TEXT DEFAULT 'life' CHECK (event_type IN ('life', 'financial', 'anniversary', 'medical', 'travel')),
  is_recurring    BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  color           TEXT,
  location        TEXT,
  linked_amount   NUMERIC(12,2),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Event Reminders
CREATE TABLE event_reminders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID REFERENCES calendar_events(id) ON DELETE CASCADE,
  remind_at   TIMESTAMPTZ NOT NULL,
  type        TEXT DEFAULT 'push' CHECK (type IN ('push', 'email')),
  is_sent     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Shopping Lists
CREATE TABLE shopping_lists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id   UUID REFERENCES couples(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category    TEXT DEFAULT 'general' CHECK (category IN ('food', 'daily', 'other', 'general')),
  is_active   BOOLEAN DEFAULT true,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Shopping Items
CREATE TABLE shopping_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id             UUID REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  memo                TEXT,
  quantity            NUMERIC(8,2),
  unit                TEXT,
  estimated_price     NUMERIC(10,2),
  priority            TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  is_checked          BOOLEAN DEFAULT false,
  checked_by          UUID REFERENCES users(id),
  checked_at          TIMESTAMPTZ,
  expense_created     BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Todos
CREATE TABLE todos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id       UUID REFERENCES couples(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES users(id),
  assigned_to     UUID REFERENCES users(id),
  title           TEXT NOT NULL,
  description     TEXT,
  due_date        DATE,
  priority        TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done')),
  visibility      TEXT DEFAULT 'shared' CHECK (visibility IN ('shared', 'private')),
  event_id        UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
  is_recurring    BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Expenses
CREATE TABLE expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id       UUID REFERENCES couples(id) ON DELETE CASCADE,
  paid_by         UUID REFERENCES users(id),
  amount          NUMERIC(12,2) NOT NULL,
  currency        TEXT DEFAULT 'JPY',
  category_id     UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
  description     TEXT,
  expense_date    DATE NOT NULL,
  expense_type    TEXT DEFAULT 'shared' CHECK (expense_type IN ('personal', 'shared', 'advance', 'pending_settlement')),
  payment_method  TEXT CHECK (payment_method IN ('cash', 'card', 'transfer')),
  is_fixed        BOOLEAN DEFAULT false,
  receipt_url     TEXT,
  source          TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'shopping_list', 'ocr', 'auto')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Expense Splits
CREATE TABLE expense_splits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  UUID REFERENCES expenses(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  ratio       NUMERIC(5,4),
  amount      NUMERIC(12,2),
  is_settled  BOOLEAN DEFAULT false
);

-- Settlements
CREATE TABLE settlements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id       UUID REFERENCES couples(id) ON DELETE CASCADE,
  from_user       UUID REFERENCES users(id),
  to_user         UUID REFERENCES users(id),
  amount          NUMERIC(12,2) NOT NULL,
  settled_at      DATE,
  status          TEXT DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'done')),
  memo            TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Budgets
CREATE TABLE budgets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id   UUID REFERENCES couples(id) ON DELETE CASCADE,
  year_month  TEXT NOT NULL,
  total_limit NUMERIC(12,2),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(couple_id, year_month)
);

-- Budget Categories
CREATE TABLE budget_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id     UUID REFERENCES budgets(id) ON DELETE CASCADE,
  category_id   UUID REFERENCES expense_categories(id) ON DELETE CASCADE,
  limit_amount  NUMERIC(12,2),
  alert_ratio   NUMERIC(4,2) DEFAULT 0.80
);

-- Savings Goals
CREATE TABLE savings_goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id       UUID REFERENCES couples(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  target_amount   NUMERIC(12,2),
  current_amount  NUMERIC(12,2) DEFAULT 0,
  target_date     DATE,
  icon            TEXT,
  color           TEXT,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'paused')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Savings Contributions
CREATE TABLE savings_contributions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id     UUID REFERENCES savings_goals(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  amount      NUMERIC(12,2) NOT NULL,
  memo        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Accounts
CREATE TABLE accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id       UUID REFERENCES couples(id) ON DELETE CASCADE,
  owner_id        UUID REFERENCES users(id),
  name            TEXT NOT NULL,
  account_type    TEXT CHECK (account_type IN ('bank', 'credit', 'investment', 'cash')),
  balance         NUMERIC(14,2),
  credit_limit    NUMERIC(12,2),
  billing_date    INT,
  closing_date    INT,
  last_synced_at  TIMESTAMPTZ,
  is_shared       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Incomes
CREATE TABLE incomes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id   UUID REFERENCES couples(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  amount      NUMERIC(12,2) NOT NULL,
  income_type TEXT DEFAULT 'salary' CHECK (income_type IN ('salary', 'bonus', 'freelance', 'other')),
  description TEXT,
  income_date DATE NOT NULL,
  is_fixed    BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_users_couple ON users(couple_id);
CREATE INDEX idx_calendar_events_couple_start ON calendar_events(couple_id, start_at);
CREATE INDEX idx_event_reminders_event ON event_reminders(event_id);
CREATE INDEX idx_shopping_items_list ON shopping_items(list_id);
CREATE INDEX idx_todos_couple_status ON todos(couple_id, status);
CREATE INDEX idx_todos_assigned ON todos(assigned_to, status);
CREATE INDEX idx_expenses_couple_date ON expenses(couple_id, expense_date);
CREATE INDEX idx_expenses_category ON expenses(category_id);
CREATE INDEX idx_expense_splits_expense ON expense_splits(expense_id);
CREATE INDEX idx_settlements_couple ON settlements(couple_id);
CREATE INDEX idx_budgets_couple_month ON budgets(couple_id, year_month);
CREATE INDEX idx_incomes_couple_date ON incomes(couple_id, income_date);
CREATE INDEX idx_expense_categories_couple ON expense_categories(couple_id);
CREATE INDEX idx_savings_contributions_goal ON savings_contributions(goal_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE incomes ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's couple_id
CREATE OR REPLACE FUNCTION public.get_couple_id()
RETURNS UUID AS $$
  SELECT couple_id FROM public.users WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- COUPLES
CREATE POLICY "Users can view own couple" ON couples
  FOR SELECT USING (id = public.get_couple_id());
CREATE POLICY "Users can update own couple" ON couples
  FOR UPDATE USING (id = public.get_couple_id());
CREATE POLICY "Anyone can create couple" ON couples
  FOR INSERT WITH CHECK (true);

-- USERS
CREATE POLICY "Users can view couple members" ON users
  FOR SELECT USING (couple_id = public.get_couple_id() OR id = auth.uid());
CREATE POLICY "Users can insert self" ON users
  FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update self" ON users
  FOR UPDATE USING (id = auth.uid());

-- EXPENSE CATEGORIES
CREATE POLICY "Couple access" ON expense_categories
  FOR ALL USING (couple_id = public.get_couple_id());

-- CALENDAR EVENTS
CREATE POLICY "Calendar select" ON calendar_events
  FOR SELECT USING (
    couple_id = public.get_couple_id()
    AND (visibility = 'shared' OR created_by = auth.uid())
  );
CREATE POLICY "Calendar insert" ON calendar_events
  FOR INSERT WITH CHECK (couple_id = public.get_couple_id());
CREATE POLICY "Calendar update" ON calendar_events
  FOR UPDATE USING (couple_id = public.get_couple_id());
CREATE POLICY "Calendar delete" ON calendar_events
  FOR DELETE USING (couple_id = public.get_couple_id() AND created_by = auth.uid());

-- EVENT REMINDERS
CREATE POLICY "Reminder access" ON event_reminders
  FOR ALL USING (
    event_id IN (SELECT id FROM calendar_events WHERE couple_id = public.get_couple_id())
  );

-- SHOPPING LISTS
CREATE POLICY "Couple access" ON shopping_lists
  FOR ALL USING (couple_id = public.get_couple_id());

-- SHOPPING ITEMS
CREATE POLICY "Couple access" ON shopping_items
  FOR ALL USING (
    list_id IN (SELECT id FROM shopping_lists WHERE couple_id = public.get_couple_id())
  );

-- TODOS
CREATE POLICY "Todo select" ON todos
  FOR SELECT USING (
    couple_id = public.get_couple_id()
    AND (visibility = 'shared' OR created_by = auth.uid() OR assigned_to = auth.uid())
  );
CREATE POLICY "Todo insert" ON todos
  FOR INSERT WITH CHECK (couple_id = public.get_couple_id());
CREATE POLICY "Todo update" ON todos
  FOR UPDATE USING (couple_id = public.get_couple_id());
CREATE POLICY "Todo delete" ON todos
  FOR DELETE USING (couple_id = public.get_couple_id() AND created_by = auth.uid());

-- EXPENSES
CREATE POLICY "Couple access" ON expenses
  FOR ALL USING (couple_id = public.get_couple_id());

-- EXPENSE SPLITS
CREATE POLICY "Couple access" ON expense_splits
  FOR ALL USING (
    expense_id IN (SELECT id FROM expenses WHERE couple_id = public.get_couple_id())
  );

-- SETTLEMENTS
CREATE POLICY "Couple access" ON settlements
  FOR ALL USING (couple_id = public.get_couple_id());

-- BUDGETS
CREATE POLICY "Couple access" ON budgets
  FOR ALL USING (couple_id = public.get_couple_id());

-- BUDGET CATEGORIES
CREATE POLICY "Couple access" ON budget_categories
  FOR ALL USING (
    budget_id IN (SELECT id FROM budgets WHERE couple_id = public.get_couple_id())
  );

-- SAVINGS GOALS
CREATE POLICY "Couple access" ON savings_goals
  FOR ALL USING (couple_id = public.get_couple_id());

-- SAVINGS CONTRIBUTIONS
CREATE POLICY "Couple access" ON savings_contributions
  FOR ALL USING (
    goal_id IN (SELECT id FROM savings_goals WHERE couple_id = public.get_couple_id())
  );

-- ACCOUNTS
CREATE POLICY "Couple access" ON accounts
  FOR ALL USING (couple_id = public.get_couple_id());

-- INCOMES
CREATE POLICY "Couple access" ON incomes
  FOR ALL USING (couple_id = public.get_couple_id());

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Seed default expense categories when a couple is created
CREATE OR REPLACE FUNCTION seed_default_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO expense_categories (couple_id, name, icon, is_default, sort_order) VALUES
    (NEW.id, '食費', '🍽️', true, 1),
    (NEW.id, '日用品', '🏠', true, 2),
    (NEW.id, '交通費', '🚃', true, 3),
    (NEW.id, '医療費', '🏥', true, 4),
    (NEW.id, '娯楽', '🎮', true, 5),
    (NEW.id, '衣服', '👕', true, 6),
    (NEW.id, '光熱費', '💡', true, 7),
    (NEW.id, '通信費', '📱', true, 8),
    (NEW.id, '家賃', '🏘️', true, 9),
    (NEW.id, '保険', '🛡️', true, 10),
    (NEW.id, 'サブスク', '📺', true, 11),
    (NEW.id, '教育', '📚', true, 12),
    (NEW.id, '旅行', '✈️', true, 13),
    (NEW.id, 'その他', '📦', true, 99);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_couple_created
  AFTER INSERT ON couples
  FOR EACH ROW EXECUTE FUNCTION seed_default_categories();

-- Update savings_goals.current_amount on contribution insert
CREATE OR REPLACE FUNCTION update_savings_current_amount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE savings_goals
  SET current_amount = (
    SELECT COALESCE(SUM(amount), 0) FROM savings_contributions WHERE goal_id = NEW.goal_id
  )
  WHERE id = NEW.goal_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_savings_contribution
  AFTER INSERT OR DELETE ON savings_contributions
  FOR EACH ROW EXECUTE FUNCTION update_savings_current_amount();

-- Generate random invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
  SELECT upper(substr(md5(random()::text), 1, 8))
$$ LANGUAGE SQL;
