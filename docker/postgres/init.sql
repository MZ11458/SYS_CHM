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
  location TEXT NOT NULL,
  capacity INT NOT NULL,
  resources JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

INSERT INTO rooms (name, location, capacity, resources)
VALUES
  ('Atlas', 'Floor 1', 8, '["TV","Whiteboard"]'::jsonb),
  ('Orion', 'Floor 2', 12, '["Hybrid Kit","Whiteboard"]'::jsonb),
  ('Nova', 'Floor 2', 6, '["Focus Booth"]'::jsonb),
  ('Pulse', 'Floor 3', 16, '["Stage","Projector"]'::jsonb)
ON CONFLICT (name) DO NOTHING;
