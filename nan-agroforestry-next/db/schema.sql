CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS farm_plots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_ref text,
  farmer_label text,
  amphoe text,
  tambon text,
  current_crop text,
  size_rai numeric NOT NULL CHECK (size_rai > 0),
  elevation_m numeric,
  geom geometry(Point, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS farm_plots_geom_idx ON farm_plots USING gist (geom);

CREATE TABLE IF NOT EXISTS plan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_plot_id uuid REFERENCES farm_plots(id),
  input_json jsonb NOT NULL,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_run_id uuid NOT NULL REFERENCES plan_runs(id) ON DELETE CASCADE,
  rank int NOT NULL,
  badge text,
  output_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crop_assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id text NOT NULL,
  source text NOT NULL DEFAULT 'recorp_template',
  price_per_kg numeric,
  yield_kg_per_rai numeric,
  establish_cost_per_rai numeric,
  annual_cost_per_rai numeric,
  years_to_yield numeric,
  survival_rate numeric,
  validation_status text NOT NULL DEFAULT 'needs_review',
  expert_note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS soil_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_plot_id uuid REFERENCES farm_plots(id),
  geom geometry(Point, 4326),
  ph numeric,
  organic_matter_pct numeric,
  nitrogen text,
  phosphorus text,
  potassium text,
  texture text,
  drainage text,
  observation_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS soil_observations_geom_idx ON soil_observations USING gist (geom);

CREATE TABLE IF NOT EXISTS field_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_run_id uuid REFERENCES plan_runs(id),
  farm_plot_id uuid REFERENCES farm_plots(id),
  reviewer_role text NOT NULL,
  understandable_score int CHECK (understandable_score BETWEEN 1 AND 5),
  agronomic_score int CHECK (agronomic_score BETWEEN 1 AND 5),
  price_yield_score int CHECK (price_yield_score BETWEEN 1 AND 5),
  risk_match_score int CHECK (risk_match_score BETWEEN 1 AND 5),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS spatial_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text UNIQUE NOT NULL,
  source text NOT NULL,
  geom geometry(Point, 4326),
  payload jsonb NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS spatial_cache_geom_idx ON spatial_cache USING gist (geom);
