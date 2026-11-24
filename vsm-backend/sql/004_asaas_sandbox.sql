CREATE TABLE IF NOT EXISTS vsm.asaas_sandbox_checkouts (
  business_id uuid NOT NULL REFERENCES vsm.businesses(id) ON DELETE CASCADE,
  plan_code text NOT NULL,
  checkout_id text NOT NULL UNIQUE,
  checkout_url text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  expires_at timestamptz NOT NULL,
  payment_id text,
  subscription_id text,
  PRIMARY KEY (business_id, plan_code)
);
