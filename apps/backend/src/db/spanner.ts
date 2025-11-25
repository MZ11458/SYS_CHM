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
