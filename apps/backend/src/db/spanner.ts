import { Spanner } from "@google-cloud/spanner";
import { config } from "../config";

const spanner = new Spanner({ projectId: config.spanner.projectId });
const instance = spanner.instance(config.spanner.instanceId);
const database = instance.database(config.spanner.databaseId);
const useEmulator = Boolean(config.spanner.emulatorHost);

const ddlStatements = [
  `CREATE TABLE GlobalReservations (
    ReservationId STRING(36) NOT NULL,
    RoomId STRING(36) NOT NULL,
    UserId STRING(36) NOT NULL,
    StartTime TIMESTAMP NOT NULL,
    EndTime TIMESTAMP NOT NULL,
    Status STRING(16) NOT NULL,
    CreatedAt TIMESTAMP NOT NULL,
    CanceledAt TIMESTAMP
  ) PRIMARY KEY (ReservationId)`
];

let initPromise: Promise<void> | null = null;

async function ensureInstanceAndDatabase(): Promise<void> {
  if (!useEmulator) {
    return;
  }

  const [instanceExists] = await instance.exists();
  if (!instanceExists) {
    const [, operation] = await spanner.createInstance(
      config.spanner.instanceId,
      {
        config: "emulator-config",
        displayName: "Local Instance",
        nodes: 1
      }
    );
    await operation.promise();
  }

  const [dbExists] = await database.exists();
  if (!dbExists) {
    const [, operation] = await instance.createDatabase(
      config.spanner.databaseId,
      {
        schema: ddlStatements
      }
    );
    await operation.promise();
  }
}

export async function ensureSpannerReady(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = ensureInstanceAndDatabase();
  try {
    await initPromise;
  } finally {
    initPromise = null;
  }
}

export async function initSpanner(): Promise<void> {
  await ensureSpannerReady();
}

export function getSpannerDatabase() {
  return database;
}

export async function checkSpannerHealth(): Promise<boolean> {
  try {
    await ensureSpannerReady();
    await database.run({ sql: "SELECT 1" });
    return true;
  } catch {
    return false;
  }
}

export async function insertGlobalReservation(input: {
  id: string;
  roomId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  status: string;
  createdAt: Date;
  canceledAt?: Date | null;
}) {
  await ensureSpannerReady();
  const table = database.table("GlobalReservations");
  await table.insert([
    {
      ReservationId: input.id,
      RoomId: input.roomId,
      UserId: input.userId,
      StartTime: input.startTime,
      EndTime: input.endTime,
      Status: input.status,
      CreatedAt: input.createdAt,
      CanceledAt: input.canceledAt || null
    }
  ]);
}

export async function cancelGlobalReservation(input: {
  id: string;
  status: string;
  canceledAt: Date;
}) {
  await ensureSpannerReady();
  const table = database.table("GlobalReservations");
  await table.update([
    {
      ReservationId: input.id,
      Status: input.status,
      CanceledAt: input.canceledAt
    }
  ]);
}

export async function fetchGlobalStats() {
  await ensureSpannerReady();
  const [rows] = await database.run({
    sql: "SELECT Status, COUNT(1) AS Count FROM GlobalReservations GROUP BY Status"
  });

  let total = 0;
  let active = 0;
  let canceled = 0;

  for (const row of rows) {
    const json = row.toJSON() as { Status: string; Count: string | number };
    const count = Number(json.Count);
    total += count;
    if (json.Status === "active") {
      active = count;
    }
    if (json.Status === "canceled") {
      canceled = count;
    }
  }

  return { total, active, canceled };
}
