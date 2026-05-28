export type UserRole = "user" | "admin";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface Reservation {
  id: string;
  roomId: string;
  userId: string;
  startTime: string;
  endTime: string;
  status: string;
}

export interface Room {
  id: string;
  name: string;
  branch: string;
  location: string;
  capacity: number;
  resources: string[];
  reservations: Reservation[];
}

export interface UserReservation {
  id: string;
  roomId: string;
  roomName: string;
  roomLocation: string;
  startTime: string;
  endTime: string;
  status: string;
  createdAt: string;
  canceledAt: string | null;
}

export interface AdminStats {
  users: {
    total: number;
  };
  rooms: {
    total: number;
  };
  reservations: {
    total: number;
    active: number;
    canceled: number;
    today: number;
  };
  utilization: {
    heatmap: Array<{
      date: string;
      hour: number;
      count: number;
    }>;
    trend: Array<{
      date: string;
      count: number;
    }>;
  };
}
