-- Life Plan: stores all simulation inputs as structured JSON
CREATE TABLE life_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id   UUID REFERENCES couples(id) ON DELETE CASCADE UNIQUE,
  assumptions JSONB NOT NULL DEFAULT '{
    "cashReserveRatio": 0.30,
    "defenseMonths": 6,
    "returnRate": 0.04,
    "nisaAnnualLimit": 400000
  }',
  income_data    JSONB NOT NULL DEFAULT '[]',
  living_costs   JSONB NOT NULL DEFAULT '{}',
  life_events    JSONB NOT NULL DEFAULT '[]',
  initial_assets JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT now(),
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE life_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Couple access" ON life_plans
  FOR ALL USING (couple_id = public.get_couple_id());
