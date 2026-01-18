import { Pool } from "pg";
import { config } from "../config";

export const pgPool = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  user: config.postgres.user,
  password: config.postgres.password,
  database: config.postgres.database
});

export async function pgQuery<T>(text: string, params: unknown[] = []) {
  return pgPool.query<T>(text, params);
}
