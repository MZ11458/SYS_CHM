# Room and Resource Booking

Monorepo with a React + TypeScript frontend and a Node.js + TypeScript backend.

## Structure
- apps/frontend - React UI
- apps/backend - Express API

## Quick start
1) Install dependencies
   - npm install
2) Run apps in separate terminals
   - npm run dev:frontend
   - npm run dev:backend
3) Optional backend env
   - copy apps/backend/.env.example to apps/backend/.env
4) Optional frontend env
   - copy apps/frontend/.env.example to apps/frontend/.env

## Local Postgres
1) Start Postgres
   - docker compose up -d postgres
2) Connection details
   - host: localhost
   - port: 5432
   - db: room_booking
   - user: room_user
   - password: room_pass
3) Seeded admin account
   - email: admin@local.test
   - password: admin123
4) If schema changes, reset data
   - docker compose down -v

## Cloud Spanner Emulator
1) Start the emulator
   - docker compose up -d spanner
2) Set backend env vars (defaults shown)
   - SPANNER_EMULATOR_HOST=localhost:9010
   - SPANNER_PROJECT_ID=local-project
   - SPANNER_INSTANCE_ID=local-instance
   - SPANNER_DATABASE_ID=room_booking_global
3) The backend bootstraps the instance and database on startup
