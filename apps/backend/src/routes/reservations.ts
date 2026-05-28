import { randomUUID } from "crypto";
import { Router } from "express";
import { pgPool, pgQuery } from "../db/postgres";
import { requireAuth } from "../middleware/auth";
import type { AuthenticatedRequest } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "missing_user" });
    }
    const userId = user.id;
    const { rows } = await pgQuery<{
      id: string;
      room_id: string;
      start_time: string | Date;
      end_time: string | Date;
      status: string;
      created_at: string | Date;
      canceled_at: string | Date | null;
      room_name: string;
      room_location: string;
    }>(
      "SELECT r.id, r.room_id, r.start_time, r.end_time, r.status, r.created_at, r.canceled_at, rooms.name AS room_name, rooms.location AS room_location FROM reservations r JOIN rooms ON rooms.id = r.room_id WHERE r.user_id = $1 ORDER BY r.start_time DESC",
      [userId]
    );

    const reservations = rows.map((row) => ({
      id: row.id,
      roomId: row.room_id,
      roomName: row.room_name,
      roomLocation: row.room_location,
      startTime: new Date(row.start_time).toISOString(),
      endTime: new Date(row.end_time).toISOString(),
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      canceledAt: row.canceled_at ? new Date(row.canceled_at).toISOString() : null
    }));

    return res.json({ reservations });
  } catch (error) {
    return res.status(500).json({ error: "reservations_fetch_failed" });
  }
});

router.post("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  const { roomId, startTime, endTime } = req.body as {
    roomId?: string;
    startTime?: string;
    endTime?: string;
  };

  if (!roomId || !startTime || !endTime) {
    return res.status(400).json({ error: "missing_fields" });
  }

  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return res.status(400).json({ error: "invalid_time" });
  }

  if (end <= start) {
    return res.status(400).json({ error: "invalid_range" });
  }

  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: "missing_user" });
  }
  const userId = user.id;
  const reservationId = randomUUID();
  const client = await pgPool.connect();

  try {
    await client.query("BEGIN");

    const conflictResult = await client.query<{ count: string }>(
      "SELECT COUNT(*) FROM reservations WHERE room_id = $1 AND status = 'active' AND start_time < $3 AND end_time > $2",
      [roomId, start, end]
    );

    if (Number(conflictResult.rows[0].count) > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "slot_taken" });
    }

    const insertResult = await client.query<{
      id: string;
      room_id: string;
      user_id: string;
      start_time: string | Date;
      end_time: string | Date;
      status: string;
      created_at: string | Date;
    }>(
      "INSERT INTO reservations (id, room_id, user_id, start_time, end_time, status) VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id, room_id, user_id, start_time, end_time, status, created_at",
      [reservationId, roomId, userId, start, end]
    );

    await client.query("COMMIT");

    const row = insertResult.rows[0];
    return res.status(201).json({
      reservation: {
        id: row.id,
        roomId: row.room_id,
        userId: row.user_id,
        startTime: new Date(row.start_time).toISOString(),
        endTime: new Date(row.end_time).toISOString(),
        status: row.status,
        createdAt: new Date(row.created_at).toISOString()
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: "reservation_create_failed" });
  } finally {
    client.release();
  }
});

router.post("/:id/cancel", requireAuth, async (req: AuthenticatedRequest, res) => {
  const reservationId = req.params.id;

  try {
    const { rows } = await pgQuery<{
      id: string;
      user_id: string;
      status: string;
    }>("SELECT id, user_id, status FROM reservations WHERE id = $1", [
      reservationId
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "not_found" });
    }

    const target = rows[0];
    if (target.status !== "active") {
      return res.status(400).json({ error: "already_canceled" });
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "missing_user" });
    }

    if (user.role !== "admin" && target.user_id !== user.id) {
      return res.status(403).json({ error: "forbidden" });
    }

    const updateResult = await pgQuery<{
      id: string;
      room_id: string;
      user_id: string;
      start_time: string | Date;
      end_time: string | Date;
      status: string;
      canceled_at: string | Date;
    }>(
      "UPDATE reservations SET status = 'canceled', canceled_at = now() WHERE id = $1 RETURNING id, room_id, user_id, start_time, end_time, status, canceled_at",
      [reservationId]
    );

    const updated = updateResult.rows[0];
    const canceledAt = new Date(updated.canceled_at);

    return res.json({
      reservation: {
        id: updated.id,
        roomId: updated.room_id,
        userId: updated.user_id,
        startTime: new Date(updated.start_time).toISOString(),
        endTime: new Date(updated.end_time).toISOString(),
        status: updated.status,
        canceledAt: canceledAt.toISOString()
      }
    });
  } catch (error) {
    return res.status(500).json({ error: "cancel_failed" });
  }
});

export default router;
