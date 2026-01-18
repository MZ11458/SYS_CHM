import cors from "cors";
import express from "express";
import { config } from "./config";
import { initSpanner } from "./db/spanner";
import authRouter from "./routes/auth";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use("/api/auth", authRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

initSpanner()
  .then(() => {
    console.log("Spanner emulator initialized");
  })
  .catch((error) => {
    console.error("Spanner init failed", error);
  });

app.listen(config.port, () => {
  console.log(`API listening on ${config.port}`);
});
