import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { pgQuery } from "../db/postgres";
import type { AuthUser } from "../types";

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "missing_token" });
  }

  const token = header.replace("Bearer ", "").trim();
  let payload: AuthUser;

  try {
    payload = jwt.verify(token, config.jwtSecret) as AuthUser;
  } catch (error) {
    return res.status(401).json({ error: "invalid_token" });
  }

  try {
    const { rows } = await pgQuery<{
      id: string;
      email: string;
      full_name: string;
      role: "user" | "admin";
      is_active: boolean;
    }>(
      "SELECT id, email, full_name, role, is_active FROM users WHERE id = $1",
      [payload.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "user_not_found" });
    }

    const row = rows[0];
    if (!row.is_active) {
      return res.status(403).json({ error: "inactive_user" });
    }

    req.user = {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      isActive: row.is_active
    };
    return next();
  } catch (error) {
    return res.status(500).json({ error: "auth_lookup_failed" });
  }
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "forbidden" });
  }

  return next();
}
