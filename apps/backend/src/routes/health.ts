import { Router } from "express";
import { pgPool } from "../db/postgres";
import { checkSpannerHealth } from "../db/spanner";

const router = Router();

router.get("/", async (_req, res) => {
  const [dbOk, spannerOk] = await Promise.all([
    pgPool
      .query("SELECT 1")
      .then(() => true)
      .catch(() => false),
    checkSpannerHealth()
  ]);
  res.set("Cache-Control", "no-store");
  return res.json({
    api: dbOk ? "ok" : "down",
    spanner: spannerOk ? "ok" : "down"
  });
});

export default router;
