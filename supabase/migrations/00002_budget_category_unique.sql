-- Add unique constraint for budget_categories upsert support
ALTER TABLE budget_categories ADD CONSTRAINT budget_categories_budget_category_unique UNIQUE (budget_id, category_id);
