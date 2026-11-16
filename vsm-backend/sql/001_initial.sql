CREATE SCHEMA IF NOT EXISTS vsm;
REVOKE ALL ON SCHEMA vsm FROM PUBLIC;

CREATE TABLE IF NOT EXISTS vsm.accounts (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  password_hash text NOT NULL
);
CREATE TABLE IF NOT EXISTS vsm.sessions (
  token_hash text PRIMARY KEY,
  account_id uuid REFERENCES vsm.accounts(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS vsm.businesses (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES vsm.accounts(id),
  status text NOT NULL DEFAULT 'Rascunho' CHECK (status IN
    ('Rascunho','Em análise','Correções solicitadas','Aprovado','Recusado','Desativado')),
  correction text NOT NULL DEFAULT '',
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS businesses_owner ON vsm.businesses(owner_id);
CREATE TABLE IF NOT EXISTS vsm.products (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES vsm.businesses(id) ON DELETE CASCADE,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS products_business ON vsm.products(business_id);
CREATE TABLE IF NOT EXISTS vsm.bookings (
  id uuid PRIMARY KEY,
  guest_hash text NOT NULL,
  business_id uuid NOT NULL REFERENCES vsm.businesses(id),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_guest ON vsm.bookings(guest_hash);
CREATE INDEX IF NOT EXISTS bookings_business ON vsm.bookings(business_id, created_at);
CREATE TABLE IF NOT EXISTS vsm.requests (
  scope text NOT NULL,
  key text NOT NULL,
  hash text NOT NULL,
  response jsonb,
  PRIMARY KEY(scope, key)
);
CREATE TABLE IF NOT EXISTS vsm.media (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES vsm.accounts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS vsm.subscriptions (
  business_id uuid PRIMARY KEY REFERENCES vsm.businesses(id),
  status text NOT NULL,
  plan text,
  amount numeric(12,2) CHECK (amount >= 0),
  due_date date
);
