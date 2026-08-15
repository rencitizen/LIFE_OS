-- ChatGPT-originated Todo mutation audit log.
-- This table is intentionally append-only from normal application usage.

CREATE TABLE IF NOT EXISTS todo_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  todo_id UUID REFERENCES todos(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'chatgpt' CHECK (source IN ('chatgpt')),
  action TEXT NOT NULL CHECK (action IN ('create', 'complete', 'update', 'delete')),
  raw_input TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'executed' CHECK (status IN ('executed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_todo_action_logs_couple_created
  ON todo_action_logs (couple_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_todo_action_logs_todo_created
  ON todo_action_logs (todo_id, created_at DESC);

ALTER TABLE todo_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todo action logs select"
  ON todo_action_logs
  FOR SELECT
  USING (couple_id = public.get_couple_id());

CREATE POLICY "Todo action logs insert"
  ON todo_action_logs
  FOR INSERT
  WITH CHECK (couple_id = public.get_couple_id());

-- Deliberately no UPDATE/DELETE policy: audit records should be append-only
-- for authenticated application users.
