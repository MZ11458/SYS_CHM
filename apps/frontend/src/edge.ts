type UserRole = "user" | "admin";

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  DB: D1Database;
  JWT_SECRET?: string;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  is_active: number;
  created_at: string;
}

interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
}

interface ReservationRow {
  id: string;
  room_id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
  canceled_at: string | null;
}

interface RoomRow {
  id: string;
  name: string;
  branch: string;
  location: string;
  capacity: number;
  resources: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const passwordAlgorithm = "pbkdf2-sha256";
const passwordIterations = 100000;
const tokenTtlSeconds = 8 * 60 * 60;
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(code);
  }
}

function shouldHandleApi(pathname: string) {
  return pathname.startsWith("/api/");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

function jsonError(status: number, code: string) {
  return jsonResponse({ error: code }, status);
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError(400, "invalid_json");
  }
}

async function all<T>(
  env: Env,
  query: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await env.DB.prepare(query).bind(...params).all<T>();
  return result.results ?? [];
}

async function first<T>(
  env: Env,
  query: string,
  params: unknown[] = []
): Promise<T | null> {
  return env.DB.prepare(query).bind(...params).first<T>();
}

async function run(env: Env, query: string, params: unknown[] = []) {
  await env.DB.prepare(query).bind(...params).run();
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: Boolean(row.is_active)
  };
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }
  return diff === 0;
}

async function derivePasswordHash(
  password: string,
  salt: Uint8Array,
  iterations: number
) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations
    },
    key,
    256
  );
  return new Uint8Array(bits);
}

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await derivePasswordHash(password, salt, passwordIterations);
  return [
    passwordAlgorithm,
    passwordIterations.toString(),
    base64UrlEncode(salt),
    base64UrlEncode(hash)
  ].join("$");
}

async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterationsValue, saltValue, hashValue] = storedHash.split("$");
  if (algorithm !== passwordAlgorithm || !iterationsValue || !saltValue || !hashValue) {
    return false;
  }

  const iterations = Number(iterationsValue);
  if (!Number.isInteger(iterations) || iterations <= 0) {
    return false;
  }

  const expected = base64UrlDecode(hashValue);
  const actual = await derivePasswordHash(password, base64UrlDecode(saltValue), iterations);
  return timingSafeEqual(actual, expected);
}

async function importJwtKey(secret: string, usage: KeyUsage) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage]
  );
}

function getJwtSecret(env: Env) {
  if (!env.JWT_SECRET) {
    throw new ApiError(500, "jwt_secret_not_configured");
  }
  return env.JWT_SECRET;
}

async function signToken(env: Env, user: AuthUser) {
  const header = base64UrlEncode(
    encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  );
  const payload = base64UrlEncode(
    encoder.encode(
      JSON.stringify({
        ...user,
        exp: Math.floor(Date.now() / 1000) + tokenTtlSeconds
      })
    )
  );
  const message = `${header}.${payload}`;
  const key = await importJwtKey(getJwtSecret(env), "sign");
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(message))
  );
  return `${message}.${base64UrlEncode(signature)}`;
}

async function verifyToken(env: Env, token: string) {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) {
    throw new ApiError(401, "invalid_token");
  }

  const message = `${header}.${payload}`;
  const key = await importJwtKey(getJwtSecret(env), "verify");
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecode(signature),
    encoder.encode(message)
  );
  if (!valid) {
    throw new ApiError(401, "invalid_token");
  }

  const decoded = JSON.parse(decoder.decode(base64UrlDecode(payload))) as AuthUser & {
    exp?: number;
  };
  if (!decoded.exp || decoded.exp <= Math.floor(Date.now() / 1000)) {
    throw new ApiError(401, "invalid_token");
  }
  return decoded;
}

async function findUserById(env: Env, userId: string) {
  return first<UserRow>(
    env,
    "SELECT id, email, password_hash, full_name, role, is_active, created_at FROM users WHERE id = ?",
    [userId]
  );
}

async function requireAuth(env: Env, request: Request) {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new ApiError(401, "missing_token");
  }

  const payload = await verifyToken(env, header.replace("Bearer ", "").trim());
  const row = await findUserById(env, payload.id);
  if (!row) {
    throw new ApiError(401, "user_not_found");
  }
  if (!row.is_active) {
    throw new ApiError(403, "inactive_user");
  }

  return toAuthUser(row);
}

function requireAdmin(user: AuthUser) {
  if (user.role !== "admin") {
    throw new ApiError(403, "forbidden");
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function ensurePassword(password: string) {
  if (password.length < 8) {
    throw new ApiError(400, "weak_password");
  }
}

function parseDate(value?: string) {
  if (!value) {
    throw new ApiError(400, "invalid_time");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "invalid_time");
  }
  return date;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function floorToHour(date: Date) {
  const next = new Date(date);
  next.setUTCMinutes(0, 0, 0);
  return next;
}

function formatUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at
  };
}

function formatReservation(row: ReservationRow) {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    startTime: new Date(row.start_time).toISOString(),
    endTime: new Date(row.end_time).toISOString(),
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    canceledAt: row.canceled_at ? new Date(row.canceled_at).toISOString() : null
  };
}

async function handleLogin(request: Request, env: Env) {
  const { email, password } = await readJson<{ email?: string; password?: string }>(
    request
  );
  if (!email || !password) {
    throw new ApiError(400, "missing_credentials");
  }

  const row = await first<UserRow>(
    env,
    "SELECT id, email, password_hash, full_name, role, is_active, created_at FROM users WHERE email = ?",
    [normalizeEmail(email)]
  );
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    throw new ApiError(401, "invalid_credentials");
  }
  if (!row.is_active) {
    throw new ApiError(403, "inactive_user");
  }

  const user = toAuthUser(row);
  return jsonResponse({ token: await signToken(env, user), user });
}

async function handleRegister(request: Request, env: Env) {
  const { email, password, fullName } = await readJson<{
    email?: string;
    password?: string;
    fullName?: string;
  }>(request);
  if (!email || !password || !fullName?.trim()) {
    throw new ApiError(400, "missing_fields");
  }
  ensurePassword(password);

  const id = crypto.randomUUID();
  const normalizedEmail = normalizeEmail(email);
  const trimmedName = fullName.trim();
  const passwordHash = await hashPassword(password);
  const createdAt = new Date().toISOString();

  try {
    await run(
      env,
      "INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at) VALUES (?, ?, ?, ?, 'user', 1, ?)",
      [id, normalizedEmail, passwordHash, trimmedName, createdAt]
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      throw new ApiError(409, "email_exists");
    }
    throw error;
  }

  const user: AuthUser = {
    id,
    email: normalizedEmail,
    fullName: trimmedName,
    role: "user",
    isActive: true
  };
  return jsonResponse({ token: await signToken(env, user), user }, 201);
}

async function handleChangePassword(request: Request, env: Env) {
  const user = await requireAuth(env, request);
  const { currentPassword, newPassword } = await readJson<{
    currentPassword?: string;
    newPassword?: string;
  }>(request);
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "missing_fields");
  }
  ensurePassword(newPassword);

  const row = await findUserById(env, user.id);
  if (!row) {
    throw new ApiError(404, "user_not_found");
  }
  if (!(await verifyPassword(currentPassword, row.password_hash))) {
    throw new ApiError(401, "invalid_password");
  }

  await run(env, "UPDATE users SET password_hash = ? WHERE id = ?", [
    await hashPassword(newPassword),
    user.id
  ]);
  return jsonResponse({ status: "ok" });
}

async function handleRooms(request: Request, env: Env) {
  await requireAuth(env, request);
  const url = new URL(request.url);
  const requestedDate =
    typeof url.searchParams.get("date") === "string" &&
    dateRe.test(url.searchParams.get("date") || "")
      ? url.searchParams.get("date")!
      : dateKey(new Date());
  const dayStart = new Date(`${requestedDate}T00:00:00.000Z`);
  const dayEnd = new Date(`${requestedDate}T23:59:59.999Z`);

  const rooms = await all<RoomRow>(
    env,
    "SELECT id, name, branch, location, capacity, resources FROM rooms ORDER BY name"
  );
  const reservations = await all<ReservationRow>(
    env,
    "SELECT id, room_id, user_id, start_time, end_time, status, created_at, canceled_at FROM reservations WHERE status = 'active' AND start_time < ? AND end_time > ?",
    [dayEnd.toISOString(), dayStart.toISOString()]
  );

  const reservationsByRoom = new Map<string, ReturnType<typeof formatReservation>[]>();
  for (const reservation of reservations) {
    const entry = formatReservation(reservation);
    if (!reservationsByRoom.has(reservation.room_id)) {
      reservationsByRoom.set(reservation.room_id, []);
    }
    reservationsByRoom.get(reservation.room_id)?.push(entry);
  }

  return jsonResponse({
    date: requestedDate,
    rooms: rooms.map((room) => ({
      id: room.id,
      name: room.name,
      branch: room.branch,
      location: room.location,
      capacity: Number(room.capacity),
      resources: JSON.parse(room.resources || "[]"),
      reservations: reservationsByRoom.get(room.id) || []
    }))
  });
}

async function handleReservations(request: Request, env: Env) {
  const user = await requireAuth(env, request);
  const rows = await all<
    ReservationRow & { room_name: string; room_location: string }
  >(
    env,
    `SELECT r.id, r.room_id, r.user_id, r.start_time, r.end_time, r.status,
            r.created_at, r.canceled_at, rooms.name AS room_name,
            rooms.location AS room_location
       FROM reservations r
       JOIN rooms ON rooms.id = r.room_id
      WHERE r.user_id = ?
      ORDER BY r.start_time DESC`,
    [user.id]
  );

  return jsonResponse({
    reservations: rows.map((row) => ({
      ...formatReservation(row),
      roomName: row.room_name,
      roomLocation: row.room_location
    }))
  });
}

async function handleCreateReservation(request: Request, env: Env) {
  const user = await requireAuth(env, request);
  const { roomId, startTime, endTime } = await readJson<{
    roomId?: string;
    startTime?: string;
    endTime?: string;
  }>(request);
  if (!roomId || !startTime || !endTime) {
    throw new ApiError(400, "missing_fields");
  }

  const start = parseDate(startTime);
  const end = parseDate(endTime);
  if (end <= start) {
    throw new ApiError(400, "invalid_range");
  }

  const room = await first<{ id: string }>(env, "SELECT id FROM rooms WHERE id = ?", [
    roomId
  ]);
  if (!room) {
    throw new ApiError(404, "room_not_found");
  }

  const conflict = await first<{ count: number }>(
    env,
    "SELECT COUNT(*) AS count FROM reservations WHERE room_id = ? AND status = 'active' AND start_time < ? AND end_time > ?",
    [roomId, end.toISOString(), start.toISOString()]
  );
  if (Number(conflict?.count || 0) > 0) {
    throw new ApiError(409, "slot_taken");
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await run(
    env,
    "INSERT INTO reservations (id, room_id, user_id, start_time, end_time, status, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?)",
    [id, roomId, user.id, start.toISOString(), end.toISOString(), createdAt]
  );

  return jsonResponse(
    {
      reservation: {
        id,
        roomId,
        userId: user.id,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        status: "active",
        createdAt
      }
    },
    201
  );
}

async function handleCancelReservation(request: Request, env: Env, reservationId: string) {
  const user = await requireAuth(env, request);
  const target = await first<ReservationRow>(
    env,
    "SELECT id, room_id, user_id, start_time, end_time, status, created_at, canceled_at FROM reservations WHERE id = ?",
    [reservationId]
  );
  if (!target) {
    throw new ApiError(404, "not_found");
  }
  if (target.status !== "active") {
    throw new ApiError(400, "already_canceled");
  }
  if (user.role !== "admin" && target.user_id !== user.id) {
    throw new ApiError(403, "forbidden");
  }

  const canceledAt = new Date().toISOString();
  await run(
    env,
    "UPDATE reservations SET status = 'canceled', canceled_at = ? WHERE id = ?",
    [canceledAt, reservationId]
  );

  return jsonResponse({
    reservation: {
      id: target.id,
      roomId: target.room_id,
      userId: target.user_id,
      startTime: new Date(target.start_time).toISOString(),
      endTime: new Date(target.end_time).toISOString(),
      status: "canceled",
      canceledAt
    }
  });
}

async function handleAdminStats(request: Request, env: Env) {
  requireAdmin(await requireAuth(env, request));

  const todayStart = startOfUtcDay(new Date());
  const tomorrow = addDays(todayStart, 1);
  const [
    usersResult,
    roomsResult,
    reservationsResult,
    todayResult,
    statuses
  ] = await Promise.all([
    first<{ count: number }>(env, "SELECT COUNT(*) AS count FROM users"),
    first<{ count: number }>(env, "SELECT COUNT(*) AS count FROM rooms"),
    first<{ count: number }>(env, "SELECT COUNT(*) AS count FROM reservations"),
    first<{ count: number }>(
      env,
      "SELECT COUNT(*) AS count FROM reservations WHERE start_time >= ? AND start_time < ?",
      [todayStart.toISOString(), tomorrow.toISOString()]
    ),
    all<{ status: string; count: number }>(
      env,
      "SELECT status, COUNT(*) AS count FROM reservations GROUP BY status"
    )
  ]);

  let active = 0;
  let canceled = 0;
  for (const row of statuses) {
    if (row.status === "active") {
      active = Number(row.count);
    }
    if (row.status === "canceled") {
      canceled = Number(row.count);
    }
  }

  const heatmapStart = addDays(todayStart, -6);
  const heatmapRows = await all<{ start_time: string; end_time: string }>(
    env,
    "SELECT start_time, end_time FROM reservations WHERE status = 'active' AND start_time < ? AND end_time >= ?",
    [tomorrow.toISOString(), heatmapStart.toISOString()]
  );

  const heatmap = new Map<string, number>();
  for (let day = 0; day < 7; day += 1) {
    const current = addDays(heatmapStart, day);
    for (let hour = 0; hour < 24; hour += 1) {
      heatmap.set(`${dateKey(current)}:${hour}`, 0);
    }
  }

  for (const row of heatmapRows) {
    const reservationStart = new Date(row.start_time);
    const reservationEnd = new Date(row.end_time);
    let cursor = floorToHour(
      reservationStart > heatmapStart ? reservationStart : heatmapStart
    );
    while (cursor < reservationEnd && cursor < tomorrow) {
      const key = `${dateKey(cursor)}:${cursor.getUTCHours()}`;
      if (heatmap.has(key)) {
        heatmap.set(key, (heatmap.get(key) || 0) + 1);
      }
      cursor = new Date(cursor.getTime() + 60 * 60 * 1000);
    }
  }

  const trendStart = addDays(todayStart, -29);
  const trendRows = await all<{ start_time: string }>(
    env,
    "SELECT start_time FROM reservations WHERE status = 'active' AND start_time >= ? AND start_time < ?",
    [trendStart.toISOString(), tomorrow.toISOString()]
  );
  const trend = new Map<string, number>();
  for (let day = 0; day < 30; day += 1) {
    trend.set(dateKey(addDays(trendStart, day)), 0);
  }
  for (const row of trendRows) {
    const key = dateKey(new Date(row.start_time));
    if (trend.has(key)) {
      trend.set(key, (trend.get(key) || 0) + 1);
    }
  }

  return jsonResponse({
    users: { total: Number(usersResult?.count || 0) },
    rooms: { total: Number(roomsResult?.count || 0) },
    reservations: {
      total: Number(reservationsResult?.count || 0),
      active,
      canceled,
      today: Number(todayResult?.count || 0)
    },
    utilization: {
      heatmap: Array.from(heatmap.entries()).map(([key, count]) => {
        const [date, hour] = key.split(":");
        return { date, hour: Number(hour), count };
      }),
      trend: Array.from(trend.entries()).map(([date, count]) => ({ date, count }))
    }
  });
}

async function handleAdminUsers(request: Request, env: Env) {
  requireAdmin(await requireAuth(env, request));
  const users = await all<UserRow>(
    env,
    "SELECT id, email, password_hash, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC"
  );
  return jsonResponse({ users: users.map(formatUser) });
}

async function handleAdminUserUpdate(
  request: Request,
  env: Env,
  userId: string
) {
  requireAdmin(await requireAuth(env, request));
  const { role, isActive } = await readJson<{
    role?: UserRole;
    isActive?: boolean;
  }>(request);
  if (role === undefined && isActive === undefined) {
    throw new ApiError(400, "missing_fields");
  }
  if (role !== undefined && role !== "user" && role !== "admin") {
    throw new ApiError(400, "invalid_role");
  }
  if (isActive !== undefined && typeof isActive !== "boolean") {
    throw new ApiError(400, "invalid_status");
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  if (role !== undefined) {
    updates.push("role = ?");
    values.push(role);
  }
  if (isActive !== undefined) {
    updates.push("is_active = ?");
    values.push(isActive ? 1 : 0);
  }
  values.push(userId);

  await run(env, `UPDATE users SET ${updates.join(", ")} WHERE id = ?`, values);
  const row = await findUserById(env, userId);
  if (!row) {
    throw new ApiError(404, "user_not_found");
  }
  return jsonResponse({ user: formatUser(row) });
}

function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(10);
  let value = "";
  for (const byte of bytes) {
    value += alphabet[byte % alphabet.length];
  }
  return `${value}1!`;
}

async function handleAdminPasswordReset(
  request: Request,
  env: Env,
  userId: string
) {
  requireAdmin(await requireAuth(env, request));
  const { newPassword } = await readJson<{ newPassword?: string }>(request);
  const trimmed = newPassword?.trim();
  const generated = !trimmed;
  const password = trimmed || generatePassword();
  ensurePassword(password);

  await run(env, "UPDATE users SET password_hash = ? WHERE id = ?", [
    await hashPassword(password),
    userId
  ]);
  const row = await findUserById(env, userId);
  if (!row) {
    throw new ApiError(404, "user_not_found");
  }

  return jsonResponse({ password, generated });
}

async function handleApi(request: Request, env: Env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const reservationCancelMatch = /^\/api\/reservations\/([^/]+)\/cancel$/.exec(
    path
  );
  const adminUserResetMatch =
    /^\/api\/admin\/users\/([^/]+)\/reset-password$/.exec(path);
  const adminUserMatch = /^\/api\/admin\/users\/([^/]+)$/.exec(path);

  if (path === "/api/health" && request.method === "GET") {
    return jsonResponse({ api: "ok" });
  }
  if (path === "/api/auth/login" && request.method === "POST") {
    return handleLogin(request, env);
  }
  if (path === "/api/auth/register" && request.method === "POST") {
    return handleRegister(request, env);
  }
  if (path === "/api/auth/me" && request.method === "GET") {
    return jsonResponse({ user: await requireAuth(env, request) });
  }
  if (path === "/api/auth/change-password" && request.method === "POST") {
    return handleChangePassword(request, env);
  }
  if (path === "/api/rooms" && request.method === "GET") {
    return handleRooms(request, env);
  }
  if (path === "/api/reservations" && request.method === "GET") {
    return handleReservations(request, env);
  }
  if (path === "/api/reservations" && request.method === "POST") {
    return handleCreateReservation(request, env);
  }
  if (reservationCancelMatch && request.method === "POST") {
    return handleCancelReservation(request, env, reservationCancelMatch[1]);
  }
  if (path === "/api/admin/stats" && request.method === "GET") {
    return handleAdminStats(request, env);
  }
  if (path === "/api/admin/users" && request.method === "GET") {
    return handleAdminUsers(request, env);
  }
  if (adminUserMatch && request.method === "PATCH") {
    return handleAdminUserUpdate(request, env, adminUserMatch[1]);
  }
  if (adminUserResetMatch && request.method === "POST") {
    return handleAdminPasswordReset(request, env, adminUserResetMatch[1]);
  }

  return jsonError(404, "not_found");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!shouldHandleApi(url.pathname)) {
      return env.ASSETS.fetch(request);
    }

    try {
      return await handleApi(request, env);
    } catch (error) {
      if (error instanceof ApiError) {
        return jsonError(error.status, error.code);
      }
      console.error(error);
      return jsonError(500, "request_failed");
    }
  }
};
