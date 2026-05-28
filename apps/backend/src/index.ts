import cors from "cors";
import express from "express";
import { config } from "./config";
import authRouter from "./routes/auth";
import adminRouter from "./routes/admin";
import reservationsRouter from "./routes/reservations";
import roomsRouter from "./routes/rooms";
import healthRouter from "./routes/health";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/reservations", reservationsRouter);
app.use("/api/health", healthRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(config.port, () => {
  console.log(`API listening on ${config.port}`);
});
