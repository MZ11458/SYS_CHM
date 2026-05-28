export type AlertTone = "info" | "success" | "warning" | "error";
export type StatusLevel = "ok" | "warning" | "down";
export type StatusKind = "api";

export interface Alert {
  id: string;
  title: string;
  message: string;
  tone: AlertTone;
  createdAt: number;
}

export interface Reminder {
  id: string;
  title: string;
  location: string;
  startTime: string;
}

export interface SystemStatus {
  api: StatusLevel;
  updatedAt: number;
}

export type StatusUpdate = Partial<Record<StatusKind, StatusLevel>>;

export interface NotifyPayload {
  title: string;
  message: string;
  tone: AlertTone;
  status?: StatusUpdate;
}
