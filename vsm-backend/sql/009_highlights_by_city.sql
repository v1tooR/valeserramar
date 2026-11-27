CREATE OR REPLACE FUNCTION vsm.highlight_city_key(text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT lower(regexp_replace(normalize($1, NFD), U&'[\0300-\036f[:space:]]', '', 'g'));
$$;

CREATE OR REPLACE FUNCTION vsm.release_unavailable_highlights()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  city_key text := vsm.highlight_city_key(NEW.data->>'city');
BEGIN
  IF NEW.status <> 'Aprovado' OR NEW.deleted_at IS NOT NULL
      OR coalesce(btrim(NEW.data->>'photo'), '') = ''
      OR coalesce(city_key, '') = ''
      OR (TG_OP = 'UPDATE' AND city_key IS DISTINCT FROM vsm.highlight_city_key(OLD.data->>'city')) THEN
    NEW.home_highlight := NULL;
    NEW.explore_highlight := NULL;
  END IF;
  RETURN NEW;
END;
$$;

UPDATE vsm.businesses
SET home_highlight = NULL, explore_highlight = NULL
WHERE (home_highlight IS NOT NULL OR explore_highlight IS NOT NULL)
  AND coalesce(vsm.highlight_city_key(data->>'city'), '') = '';

CREATE UNIQUE INDEX IF NOT EXISTS businesses_city_home_highlight
  ON vsm.businesses(vsm.highlight_city_key(data->>'city'), home_highlight)
  WHERE home_highlight IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS businesses_city_explore_highlight
  ON vsm.businesses(vsm.highlight_city_key(data->>'city'), explore_highlight)
  WHERE explore_highlight IS NOT NULL;

DROP INDEX IF EXISTS vsm.businesses_home_highlight;
DROP INDEX IF EXISTS vsm.businesses_explore_highlight;
