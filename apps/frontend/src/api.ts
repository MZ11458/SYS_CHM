import type { AdminStats, AdminUser, Room, User } from "./types";

const API_URL = "";

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

export async function fetchReservations(token: string) {
  const response = await fetch(`${API_URL}/api/reservations`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse<{
    reservations: Array<{
      id: string;
      roomId: string;
      roomName: string;
      roomLocation: string;
      startTime: string;
      endTime: string;
      status: string;
      createdAt: string;
      canceledAt: string | null;
    }>;
  }>(response);
}

export async function createReservation(
  token: string,
  payload: { roomId: string; startTime: string; endTime: string }
) {
  const response = await fetch(`${API_URL}/api/reservations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return handleResponse<{
    reservation: {
      id: string;
      roomId: string;
      userId: string;
      startTime: string;
      endTime: string;
      status: string;
      createdAt: string;
    };
  }>(response);
}

export async function cancelReservation(token: string, reservationId: string) {
  const response = await fetch(
    `${API_URL}/api/reservations/${reservationId}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  return handleResponse<{
    reservation: {
      id: string;
      roomId: string;
      userId: string;
      startTime: string;
      endTime: string;
      status: string;
      canceledAt: string;
    };
  }>(response);
}

export async function fetchAdminStats(token: string) {
  const response = await fetch(`${API_URL}/api/admin/stats`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse<AdminStats>(response);
}

export async function fetchAdminUsers(token: string) {
  const response = await fetch(`${API_URL}/api/admin/users`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return handleResponse<{ users: AdminUser[] }>(response);
}

export async function updateAdminUser(
  token: string,
  userId: string,
  payload: { role?: "user" | "admin"; isActive?: boolean }
) {
  const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return handleResponse<{ user: AdminUser }>(response);
}

export async function resetAdminUserPassword(
  token: string,
  userId: string,
  newPassword?: string
) {
  const response = await fetch(
    `${API_URL}/api/admin/users/${userId}/reset-password`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ newPassword })
    }
  );

  return handleResponse<{ password: string; generated: boolean }>(response);
}

export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string
) {
  const response = await fetch(`${API_URL}/api/auth/change-password`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ currentPassword, newPassword })
  });

  return handleResponse<{ status: "ok" }>(response);
}

export async function fetchHealth() {
  const response = await fetch(`${API_URL}/api/health`, {
    cache: "no-store"
  });

  return handleResponse<{ api: "ok" | "down" }>(response);
}
