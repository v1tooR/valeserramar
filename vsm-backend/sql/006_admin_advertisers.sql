ALTER TABLE vsm.accounts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS sessions_account ON vsm.sessions(account_id)
  WHERE account_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS vsm.admin_advertiser_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES vsm.accounts(id),
  reviewer text NOT NULL,
  action text NOT NULL CHECK (action IN ('editado','excluido','restaurado')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_advertiser_events_account
  ON vsm.admin_advertiser_events(account_id, id DESC);
