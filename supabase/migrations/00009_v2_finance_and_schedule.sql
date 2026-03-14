ALTER TABLE couples
ADD COLUMN IF NOT EXISTS living_mode TEXT NOT NULL DEFAULT 'before_cohabiting'
CHECK (living_mode IN ('before_cohabiting', 'after_cohabiting'));

ALTER TABLE todos
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

UPDATE todos
SET
  start_date = COALESCE(start_date, due_date, timezone('Asia/Tokyo', created_at)::date),
  end_date = COALESCE(end_date, due_date, start_date, timezone('Asia/Tokyo', created_at)::date)
WHERE start_date IS NULL OR end_date IS NULL;

CREATE TABLE IF NOT EXISTS budget_income_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  income_type TEXT NOT NULL CHECK (income_type IN ('salary', 'bonus', 'freelance', 'other')),
  scenario TEXT NOT NULL DEFAULT 'base',
  planned_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (budget_id, income_type, scenario)
);

CREATE INDEX IF NOT EXISTS idx_budget_income_categories_budget
  ON budget_income_categories (budget_id, scenario);

ALTER TABLE budget_income_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Couple access" ON budget_income_categories
  FOR ALL USING (
    budget_id IN (SELECT id FROM budgets WHERE couple_id = public.get_couple_id())
  );
