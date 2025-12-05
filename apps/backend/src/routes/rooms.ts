import { Router } from "express";
import { pgQuery } from "../db/postgres";
import { requireAuth } from "../middleware/auth";
import type { AuthenticatedRequest } from "../middleware/auth";

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const requestedDate =
      typeof req.query.date === "string" && DATE_RE.test(req.query.date)
        ? req.query.date
        : new Date().toISOString().slice(0, 10);

    const dayStart = new Date(`${requestedDate}T00:00:00`);
    const dayEnd = new Date(`${requestedDate}T23:59:59`);

    const roomsResult = await pgQuery<{
      id: string;
      name: string;
      location: string;
      capacity: number;
      resources: unknown;
    }>(
      "SELECT id, name, location, capacity, resources FROM rooms ORDER BY name"
    );

    const reservationsResult = await pgQuery<{
      id: string;
      room_id: string;
      user_id: string;
      start_time: string | Date;
      end_time: string | Date;
      status: string;
    }>(
      "SELECT id, room_id, user_id, start_time, end_time, status FROM reservations WHERE status = 'active' AND start_time < $2 AND end_time > $1",
      [dayStart, dayEnd]
    );

    const reservationsByRoom = new Map<string, any[]>();
    for (const row of reservationsResult.rows) {
      const entry = {
        id: row.id,
        roomId: row.room_id,
        userId: row.user_id,
        startTime: new Date(row.start_time).toISOString(),
        endTime: new Date(row.end_time).toISOString(),
        status: row.status
      };

      if (!reservationsByRoom.has(row.room_id)) {
        reservationsByRoom.set(row.room_id, []);
      }
      reservationsByRoom.get(row.room_id)?.push(entry);
    }

    const rooms = roomsResult.rows.map((room) => {
      const resources = Array.isArray(room.resources)
        ? room.resources
        : typeof room.resources === "string"
        ? JSON.parse(room.resources)
        : [];

      return {
        id: room.id,
        name: room.name,
        location: room.location,
        capacity: room.capacity,
        resources,
        reservations: reservationsByRoom.get(room.id) || []
      };
    });

    return res.json({ date: requestedDate, rooms });
  } catch (error) {
    return res.status(500).json({ error: "rooms_fetch_failed" });
  }
});

export default router;
