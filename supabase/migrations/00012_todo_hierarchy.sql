ALTER TABLE todos
ADD COLUMN IF NOT EXISTS parent_todo_id UUID REFERENCES todos(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS task_level TEXT NOT NULL DEFAULT 'small';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'todos_task_level_check'
  ) THEN
    ALTER TABLE todos
    ADD CONSTRAINT todos_task_level_check
    CHECK (task_level IN ('large', 'medium', 'small'));
  END IF;
END $$;

UPDATE todos
SET task_level = COALESCE(task_level, 'small')
WHERE task_level IS NULL;

CREATE INDEX IF NOT EXISTS idx_todos_parent
  ON todos (couple_id, parent_todo_id);
