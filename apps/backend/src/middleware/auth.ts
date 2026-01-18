import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import type { AuthUser } from "../types";

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "missing_token" });
  }

  const token = header.replace("Bearer ", "").trim();
  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthUser;
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "invalid_token" });
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
