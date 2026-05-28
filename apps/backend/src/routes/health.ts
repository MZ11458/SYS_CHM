import { Router } from "express";
import { pgPool } from "../db/postgres";

const router = Router();

router.get("/", async (_req, res) => {
  const dbOk = await pgPool
    .query("SELECT 1")
    .then(() => true)
    .catch(() => false);
  res.set("Cache-Control", "no-store");
  return res.json({
    api: dbOk ? "ok" : "down"
  });
});

export default router;
