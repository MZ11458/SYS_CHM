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

## Local Postgres
1) Start Postgres
   - docker compose up -d postgres
2) Connection details
   - host: localhost
   - port: 5432
   - db: room_booking
   - user: room_user
   - password: room_pass
