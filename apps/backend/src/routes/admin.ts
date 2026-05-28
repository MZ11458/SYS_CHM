import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { pgQuery } from "../db/postgres";
import { requireAdmin, requireAuth } from "../middleware/auth";

const router = Router();

router.get("/stats", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [
      usersResult,
      roomsResult,
      reservationsResult,
      todayResult,
      heatmapResult,
      trendResult
    ] = await Promise.all([
      pgQuery<{ count: string }>("SELECT COUNT(*) FROM users"),
      pgQuery<{ count: string }>("SELECT COUNT(*) FROM rooms"),
      pgQuery<{ count: string }>("SELECT COUNT(*) FROM reservations"),
      pgQuery<{ count: string }>(
        "SELECT COUNT(*) FROM reservations WHERE start_time::date = CURRENT_DATE"
      ),
      pgQuery<{ day: string | Date; hour: number; count: string }>(`
        WITH days AS (
          SELECT generate_series(
            CURRENT_DATE - INTERVAL '6 days',
            CURRENT_DATE,
            INTERVAL '1 day'
          )::date AS day
        ),
        hours AS (
          SELECT generate_series(0, 23) AS hour
        ),
        grid AS (
          SELECT day, hour FROM days CROSS JOIN hours
        ),
        expanded AS (
          SELECT date_trunc('hour', slot) AS hour_slot
          FROM reservations r
          JOIN LATERAL generate_series(
            date_trunc('hour', r.start_time),
            date_trunc('hour', r.end_time - INTERVAL '1 second'),
            INTERVAL '1 hour'
          ) AS slot ON true
          WHERE r.status = 'active'
            AND r.start_time < CURRENT_DATE + INTERVAL '1 day'
            AND r.end_time >= CURRENT_DATE - INTERVAL '6 days'
        ),
        counts AS (
          SELECT hour_slot::date AS day,
                 EXTRACT(HOUR FROM hour_slot)::int AS hour,
                 COUNT(*)::int AS count
          FROM expanded
          GROUP BY day, hour
        )
        SELECT grid.day, grid.hour, COALESCE(counts.count, 0) AS count
        FROM grid
        LEFT JOIN counts ON grid.day = counts.day AND grid.hour = counts.hour
        ORDER BY grid.day, grid.hour
      `),
      pgQuery<{ day: string | Date; count: string }>(`
        WITH days AS (
          SELECT generate_series(
            CURRENT_DATE - INTERVAL '29 days',
            CURRENT_DATE,
            INTERVAL '1 day'
          )::date AS day
        ),
        counts AS (
          SELECT start_time::date AS day,
                 COUNT(*)::int AS count
          FROM reservations
          WHERE status = 'active'
            AND start_time >= CURRENT_DATE - INTERVAL '29 days'
            AND start_time < CURRENT_DATE + INTERVAL '1 day'
          GROUP BY start_time::date
        )
        SELECT days.day, COALESCE(counts.count, 0) AS count
        FROM days
        LEFT JOIN counts ON days.day = counts.day
        ORDER BY days.day
      `)
    ]);

    const statusResult = await pgQuery<{ status: string; count: string }>(
      "SELECT status, COUNT(*) FROM reservations GROUP BY status"
    );

    let active = 0;
    let canceled = 0;
    for (const row of statusResult.rows) {
      if (row.status === "active") {
        active = Number(row.count);
      }
      if (row.status === "canceled") {
        canceled = Number(row.count);
      }
    }

    const formatDate = (value: string | Date) =>
      typeof value === "string" ? value : value.toISOString().slice(0, 10);

    const heatmap = heatmapResult.rows.map((row) => ({
      date: formatDate(row.day),
      hour: Number(row.hour),
      count: Number(row.count)
    }));

    const trend = trendResult.rows.map((row) => ({
      date: formatDate(row.day),
      count: Number(row.count)
    }));

    return res.json({
      users: { total: Number(usersResult.rows[0].count) },
      rooms: { total: Number(roomsResult.rows[0].count) },
      reservations: {
        total: Number(reservationsResult.rows[0].count),
        active,
        canceled,
        today: Number(todayResult.rows[0].count)
      },
      utilization: {
        heatmap,
        trend
      }
    });
  } catch (error) {
    return res.status(500).json({ error: "admin_stats_failed" });
  }
});

router.get("/users", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pgQuery<{
      id: string;
      email: string;
      full_name: string;
      role: "user" | "admin";
      is_active: boolean;
      created_at: string | Date;
    }>(
      "SELECT id, email, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC"
    );

    const users = rows.map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      isActive: row.is_active,
      createdAt: new Date(row.created_at).toISOString()
    }));

    return res.json({ users });
  } catch (error) {
    return res.status(500).json({ error: "admin_users_failed" });
  }
});

router.patch("/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const { role, isActive } = req.body as {
    role?: "user" | "admin";
    isActive?: boolean;
  };

  if (role === undefined && isActive === undefined) {
    return res.status(400).json({ error: "missing_fields" });
  }

  if (role !== undefined && role !== "user" && role !== "admin") {
    return res.status(400).json({ error: "invalid_role" });
  }

  if (isActive !== undefined && typeof isActive !== "boolean") {
    return res.status(400).json({ error: "invalid_status" });
  }

  const updates: string[] = [];
  const values: Array<string | boolean> = [];

  if (role !== undefined) {
    values.push(role);
    updates.push(`role = $${values.length}`);
  }

  if (isActive !== undefined) {
    values.push(isActive);
    updates.push(`is_active = $${values.length}`);
  }

  values.push(req.params.id);

  try {
    const { rows } = await pgQuery<{
      id: string;
      email: string;
      full_name: string;
      role: "user" | "admin";
      is_active: boolean;
      created_at: string | Date;
    }>(
      `UPDATE users SET ${updates.join(
        ", "
      )} WHERE id = $${values.length} RETURNING id, email, full_name, role, is_active, created_at`,
      values
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "user_not_found" });
    }

    const row = rows[0];
    return res.json({
      user: {
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        role: row.role,
        isActive: row.is_active,
        createdAt: new Date(row.created_at).toISOString()
      }
    });
  } catch (error) {
    return res.status(500).json({ error: "admin_user_update_failed" });
  }
});

router.post(
  "/users/:id/reset-password",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { newPassword } = req.body as { newPassword?: string };
    const trimmed = newPassword?.trim();
    const generated = !trimmed;
    const password =
      trimmed ||
      `${randomBytes(8)
        .toString("base64")
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 10)}1!`;

    if (password.length < 8) {
      return res.status(400).json({ error: "weak_password" });
    }

    try {
      const passwordHash = await bcrypt.hash(password, 10);
      const { rows } = await pgQuery<{ id: string }>(
        "UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id",
        [passwordHash, req.params.id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "user_not_found" });
      }

      return res.json({ password, generated });
    } catch (error) {
      return res.status(500).json({ error: "admin_password_reset_failed" });
    }
  }
);

export default router;
