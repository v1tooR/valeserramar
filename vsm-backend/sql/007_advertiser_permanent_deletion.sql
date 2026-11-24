ALTER TABLE vsm.businesses ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE vsm.media ALTER COLUMN owner_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS media_owner ON vsm.media(owner_id)
  WHERE owner_id IS NOT NULL;
