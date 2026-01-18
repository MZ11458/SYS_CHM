import { Router } from "express";
import { fetchGlobalStats } from "../db/spanner";
import { pgQuery } from "../db/postgres";
import { requireAdmin, requireAuth } from "../middleware/auth";

const router = Router();

router.get("/stats", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [usersResult, roomsResult, reservationsResult, todayResult] =
      await Promise.all([
        pgQuery<{ count: string }>("SELECT COUNT(*) FROM users"),
        pgQuery<{ count: string }>("SELECT COUNT(*) FROM rooms"),
        pgQuery<{ count: string }>("SELECT COUNT(*) FROM reservations"),
        pgQuery<{ count: string }>(
          "SELECT COUNT(*) FROM reservations WHERE start_time::date = CURRENT_DATE"
        )
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

    const globalStats = await fetchGlobalStats().catch(() => null);

    return res.json({
      users: { total: Number(usersResult.rows[0].count) },
      rooms: { total: Number(roomsResult.rows[0].count) },
      reservations: {
        total: Number(reservationsResult.rows[0].count),
        active,
        canceled,
        today: Number(todayResult.rows[0].count)
      },
      globalReservations: globalStats
    });
  } catch (error) {
    return res.status(500).json({ error: "admin_stats_failed" });
  }
});

export default router;
