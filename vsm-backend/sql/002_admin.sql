CREATE TABLE IF NOT EXISTS vsm.admin_sessions (
  token_hash text PRIMARY KEY,
  credential_tag text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry
  ON vsm.admin_sessions(expires_at);

CREATE TABLE IF NOT EXISTS vsm.admin_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id uuid NOT NULL,
  reviewer text NOT NULL,
  previous_status text NOT NULL,
  status text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_reviews_business
  ON vsm.admin_reviews(business_id, id DESC);
