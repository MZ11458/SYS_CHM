CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

INSERT INTO users (id, email, password_hash, full_name, role, is_active)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'admin@local.test',
  'pbkdf2-sha256$100000$bIP6kbUmz1vVVdP2Pw5oHQ$erD9P8XCxvpwCAP_u0ZzAV3QVrGq_lpmr_DEFngXWhM',
  'Local Admin',
  'admin',
  1
)
ON CONFLICT(email) DO NOTHING;

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  branch TEXT NOT NULL,
  location TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  resources TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  canceled_at TEXT
);

CREATE INDEX IF NOT EXISTS reservations_room_time_idx
  ON reservations (room_id, start_time);

CREATE INDEX IF NOT EXISTS reservations_user_time_idx
  ON reservations (user_id, start_time);

INSERT INTO rooms (id, name, branch, location, capacity, resources)
VALUES
  ('00000000-0000-4000-8000-000000000101', 'Atlas', 'Polska', 'Warszawa', 8, '["TV","Whiteboard"]'),
  ('00000000-0000-4000-8000-000000000102', 'Orion', 'Polska', 'Warszawa', 12, '["Hybrid Kit","Whiteboard"]'),
  ('00000000-0000-4000-8000-000000000103', 'Nova', 'Polska', 'Warszawa', 6, '["Focus Booth"]'),
  ('00000000-0000-4000-8000-000000000104', 'Pulse', 'Polska', 'Warszawa', 16, '["Stage","Projector"]'),
  ('00000000-0000-4000-8000-000000000201', 'Hudson', 'USA', 'Nowy Jork', 6, '["TV","Whiteboard"]'),
  ('00000000-0000-4000-8000-000000000202', 'Soho', 'USA', 'Nowy Jork', 4, '["Focus Booth"]'),
  ('00000000-0000-4000-8000-000000000203', 'Liberty', 'USA', 'Nowy Jork', 10, '["Hybrid Kit","TV"]'),
  ('00000000-0000-4000-8000-000000000204', 'Brooklyn', 'USA', 'Nowy Jork', 8, '["Projector","Whiteboard"]'),
  ('00000000-0000-4000-8000-000000000301', 'Shibuya', 'Japonia', 'Tokio', 6, '["TV","Whiteboard"]'),
  ('00000000-0000-4000-8000-000000000302', 'Ginza', 'Japonia', 'Tokio', 8, '["Hybrid Kit","Projector"]'),
  ('00000000-0000-4000-8000-000000000303', 'Akihabara', 'Japonia', 'Tokio', 4, '["Focus Booth"]'),
  ('00000000-0000-4000-8000-000000000304', 'Asakusa', 'Japonia', 'Tokio', 12, '["TV","Projector"]')
ON CONFLICT(name) DO NOTHING;
