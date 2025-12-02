import dotenv from "dotenv";

dotenv.config();

const spannerEmulatorHost =
  process.env.SPANNER_EMULATOR_HOST || "localhost:9010";

if (spannerEmulatorHost) {
  process.env.SPANNER_EMULATOR_HOST = spannerEmulatorHost;
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  postgres: {
    host: process.env.POSTGRES_HOST || "localhost",
    port: Number(process.env.POSTGRES_PORT) || 5432,
    user: process.env.POSTGRES_USER || "room_user",
    password: process.env.POSTGRES_PASSWORD || "room_pass",
    database: process.env.POSTGRES_DB || "room_booking"
  },
  spanner: {
    projectId: process.env.SPANNER_PROJECT_ID || "local-project",
    instanceId: process.env.SPANNER_INSTANCE_ID || "local-instance",
    databaseId: process.env.SPANNER_DATABASE_ID || "room_booking_global",
    emulatorHost: spannerEmulatorHost
  }
};
