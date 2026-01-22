CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

INSERT INTO users (email, password_hash, full_name, role)
VALUES (
  'admin@local.test',
  crypt('admin123', gen_salt('bf')),
  'Local Admin',
  'admin'
)
ON CONFLICT (email) DO NOTHING;

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  branch TEXT NOT NULL,
  location TEXT NOT NULL,
  capacity INT NOT NULL,
  resources JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS branch TEXT NOT NULL DEFAULT 'Warszawa';

CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id),
  user_id UUID NOT NULL REFERENCES users(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  canceled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS reservations_room_time_idx
  ON reservations (room_id, start_time);

INSERT INTO rooms (name, branch, location, capacity, resources)
VALUES
  ('Atlas', 'Polska', 'Warszawa', 8, '["Telewizor","Tablica suchościeralna"]'::jsonb),
  ('Orion', 'Polska', 'Warszawa', 12, '["Zestaw hybrydowy","Tablica suchościeralna"]'::jsonb),
  ('Nova', 'Polska', 'Warszawa', 6, '["Kabina skupienia"]'::jsonb),
  ('Pulse', 'Polska', 'Warszawa', 16, '["Scena","Projektor"]'::jsonb),
  ('Hudson', 'USA', 'Nowy Jork', 6, '["Telewizor","Tablica suchościeralna"]'::jsonb),
  ('Soho', 'USA', 'Nowy Jork', 4, '["Kabina skupienia"]'::jsonb),
  ('Liberty', 'USA', 'Nowy Jork', 10, '["Zestaw hybrydowy","Telewizor"]'::jsonb),
  ('Brooklyn', 'USA', 'Nowy Jork', 8, '["Projektor","Tablica suchościeralna"]'::jsonb),
  ('Shibuya', 'Japonia', 'Tokio', 6, '["Telewizor","Tablica suchościeralna"]'::jsonb),
  ('Ginza', 'Japonia', 'Tokio', 8, '["Zestaw hybrydowy","Projektor"]'::jsonb),
  ('Akihabara', 'Japonia', 'Tokio', 4, '["Kabina skupienia"]'::jsonb),
  ('Asakusa', 'Japonia', 'Tokio', 12, '["Telewizor","Projektor"]'::jsonb)
ON CONFLICT (name) DO NOTHING;