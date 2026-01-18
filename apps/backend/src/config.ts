import dotenv from "dotenv";

dotenv.config();

const spannerEmulatorHost =
  process.env.SPANNER_EMULATOR_HOST || "localhost:9010";

if (spannerEmulatorHost) {
  process.env.SPANNER_EMULATOR_HOST = spannerEmulatorHost;
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  spanner: {
    projectId: process.env.SPANNER_PROJECT_ID || "local-project",
    instanceId: process.env.SPANNER_INSTANCE_ID || "local-instance",
    databaseId: process.env.SPANNER_DATABASE_ID || "room_booking_global",
    emulatorHost: spannerEmulatorHost
  }
};
