export type UserRole = "user" | "admin";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
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
