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

## Cloudflare Free deployment
The Cloudflare build runs without an external backend. A Worker serves the Vite app, handles `/api/*`, and stores data in Cloudflare D1.

Current free-plan fit:
- Workers Free: 100,000 requests/day.
- D1 Free: 5 million rows read/day, 100,000 rows written/day, 5 GB total storage.
- Static asset requests do not invoke the API Worker unless they hit `/api/*`.

1) Install dependencies
   - npm install
2) Log in to Cloudflare
   - cd apps/frontend
   - npx wrangler login
3) Create a D1 database
   - npx wrangler d1 create room-booking-db
   - copy the generated `database_id` into `apps/frontend/wrangler.jsonc`
4) Set the Worker JWT secret
   - npx wrangler secret put JWT_SECRET
5) Apply D1 migrations
   - npm run d1:migrate:remote
6) Deploy to Cloudflare
   - npm run deploy:cloudflare

Local Cloudflare runtime:
1) Create `apps/frontend/.dev.vars`
   - JWT_SECRET="local-test-secret"
2) Apply the local D1 migration
   - npm run d1:migrate:local
3) Start the local Worker
   - cd apps/frontend
   - npm run cf:dev

Seeded admin account:
- email: admin@local.test
- password: admin123

For standard Vite development, `VITE_API_URL` defaults to `http://localhost:4000`. For the Cloudflare runtime, leave `VITE_API_URL` unset so the frontend calls the same origin and the Worker handles `/api/*`.
