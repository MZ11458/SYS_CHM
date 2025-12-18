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
    is_active: boolean;
  }>(
    "SELECT id, email, password_hash, full_name, role, is_active FROM users WHERE email = $1",
    [normalizedEmail]
  );

    if (rows.length === 0) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    const userRow = rows[0];
  if (!userRow.is_active) {
    return res.status(403).json({ error: "inactive_user" });
  }

  const match = await bcrypt.compare(password, userRow.password_hash);
  if (!match) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  const user: AuthUser = {
    id: userRow.id,
    email: userRow.email,
    fullName: userRow.full_name,
    role: userRow.role,
    isActive: userRow.is_active
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
      is_active: boolean;
    }>(
      "INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, 'user') RETURNING id, email, full_name, role, is_active",
      [normalizedEmail, passwordHash, trimmedName]
    );

    const user: AuthUser = {
      id: rows[0].id,
      email: rows[0].email,
      fullName: rows[0].full_name,
      role: rows[0].role,
      isActive: rows[0].is_active
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

router.post(
  "/change-password",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "missing_fields" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "weak_password" });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "missing_user" });
    }

    try {
      const { rows } = await pgQuery<{ password_hash: string }>(
        "SELECT password_hash FROM users WHERE id = $1",
        [userId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "user_not_found" });
      }

      const match = await bcrypt.compare(
        currentPassword,
        rows[0].password_hash
      );

      if (!match) {
        return res.status(401).json({ error: "invalid_password" });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await pgQuery("UPDATE users SET password_hash = $1 WHERE id = $2", [
        passwordHash,
        userId
      ]);

      return res.json({ status: "ok" });
    } catch (error) {
      return res.status(500).json({ error: "change_password_failed" });
    }
  }
);

export default router;
