ALTER TABLE vsm.businesses ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
