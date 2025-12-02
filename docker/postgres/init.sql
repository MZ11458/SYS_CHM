CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

INSERT INTO users (email, password_hash, full_name, role)
VALUES (
  'admin@local.test',
  crypt('admin123', gen_salt('bf')),
  'Local Admin',
  'admin'
)
ON CONFLICT (email) DO NOTHING;
