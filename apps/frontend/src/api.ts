import type { Room, User } from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body?.error || "request_failed";
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  return handleResponse<{ token: string; user: User }>(response);
}

export async function register(
  email: string,
  password: string,
  fullName: string
) {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password, fullName })
  });

  return handleResponse<{ token: string; user: User }>(response);
}

export async function fetchRooms(date: string, token: string) {
  const response = await fetch(`${API_URL}/api/rooms?date=${date}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse<{ date: string; rooms: Room[] }>(response);
}
