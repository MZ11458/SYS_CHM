import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { pgQuery } from "../db/postgres";
import { requireAuth } from "../middleware/auth";
import type { AuthenticatedRequest } from "../middleware/auth";
import type { AuthUser } from "../types";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return res.status(400).json({ error: "missing_credentials" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { rows } = await pgQuery<{
      id: string;
      email: string;
      password_hash: string;
      full_name: string;
      role: "user" | "admin";
    }>(
      "SELECT id, email, password_hash, full_name, role FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    const userRow = rows[0];
    const match = await bcrypt.compare(password, userRow.password_hash);
    if (!match) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    const user: AuthUser = {
      id: userRow.id,
      email: userRow.email,
      fullName: userRow.full_name,
      role: userRow.role
    };

    const token = jwt.sign(user, config.jwtSecret, { expiresIn: "8h" });
    return res.json({ token, user });
  } catch (error) {
    return res.status(500).json({ error: "login_failed" });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { email, password, fullName } = req.body as {
      email?: string;
      password?: string;
      fullName?: string;
    };

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: "missing_fields" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "weak_password" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = fullName.trim();
    const passwordHash = await bcrypt.hash(password, 10);

    const { rows } = await pgQuery<{
      id: string;
      email: string;
      full_name: string;
      role: "user" | "admin";
    }>(
      "INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, 'user') RETURNING id, email, full_name, role",
      [normalizedEmail, passwordHash, trimmedName]
    );

    const user: AuthUser = {
      id: rows[0].id,
      email: rows[0].email,
      fullName: rows[0].full_name,
      role: rows[0].role
    };

    const token = jwt.sign(user, config.jwtSecret, { expiresIn: "8h" });
    return res.status(201).json({ token, user });
  } catch (error: any) {
    if (error?.code === "23505") {
      return res.status(409).json({ error: "email_exists" });
    }
    return res.status(500).json({ error: "register_failed" });
  }
});

router.get("/me", requireAuth, (req: AuthenticatedRequest, res) => {
  return res.json({ user: req.user });
});

export default router;
