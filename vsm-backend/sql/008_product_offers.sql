CREATE TABLE IF NOT EXISTS vsm.product_offers (
  product_id uuid PRIMARY KEY REFERENCES vsm.products(id) ON DELETE CASCADE,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  expires_at timestamptz NOT NULL
);
