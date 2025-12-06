import { Spanner } from "@google-cloud/spanner";
import { config } from "../config";

const spanner = new Spanner({ projectId: config.spanner.projectId });
const instance = spanner.instance(config.spanner.instanceId);
const database = instance.database(config.spanner.databaseId);

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

export async function initSpanner(): Promise<void> {
  const [instanceExists] = await instance.exists();
  if (!instanceExists) {
    const [operation] = await spanner.createInstance(
      config.spanner.instanceId,
      {
        config: "emulator-config",
        displayName: "Local Instance",
        nodeCount: 1
      }
    );
    await operation.promise();
  }

  const [dbExists] = await database.exists();
  if (!dbExists) {
    const [operation] = await instance.createDatabase(
      config.spanner.databaseId,
      {
        schema: ddlStatements
      }
    );
    await operation.promise();
  }
}

export function getSpannerDatabase() {
  return database;
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
  const table = database.table("GlobalReservations");
  await table.update([
    {
      ReservationId: input.id,
      Status: input.status,
      CanceledAt: input.canceledAt
    }
  ]);
}
