CREATE TABLE idea_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id   UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES users(id),
  title       TEXT NOT NULL,
  memo        TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_idea_items_couple_status ON idea_items(couple_id, status, created_at DESC);

ALTER TABLE idea_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Idea items couple access" ON idea_items
  FOR ALL USING (couple_id = public.get_couple_id())
  WITH CHECK (couple_id = public.get_couple_id());
