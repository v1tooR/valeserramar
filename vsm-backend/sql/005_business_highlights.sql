ALTER TABLE vsm.businesses
  ADD COLUMN IF NOT EXISTS home_highlight smallint CHECK (home_highlight BETWEEN 1 AND 15),
  ADD COLUMN IF NOT EXISTS explore_highlight smallint CHECK (explore_highlight BETWEEN 1 AND 15);

CREATE UNIQUE INDEX IF NOT EXISTS businesses_home_highlight
  ON vsm.businesses(home_highlight) WHERE home_highlight IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS businesses_explore_highlight
  ON vsm.businesses(explore_highlight) WHERE explore_highlight IS NOT NULL;

CREATE OR REPLACE FUNCTION vsm.release_unavailable_highlights()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> 'Aprovado' OR NEW.deleted_at IS NOT NULL
      OR coalesce(btrim(NEW.data->>'photo'), '') = '' THEN
    NEW.home_highlight := NULL;
    NEW.explore_highlight := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS businesses_release_highlights ON vsm.businesses;
CREATE TRIGGER businesses_release_highlights
  BEFORE INSERT OR UPDATE ON vsm.businesses
  FOR EACH ROW EXECUTE FUNCTION vsm.release_unavailable_highlights();
