ALTER TABLE expenses
DROP CONSTRAINT IF EXISTS expenses_source_check;

ALTER TABLE expenses
ADD CONSTRAINT expenses_source_check
CHECK (source IN ('manual', 'shopping_list', 'ocr', 'auto', 'moneyforward_screenshot'));
