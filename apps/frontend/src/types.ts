export type UserRole = "user" | "admin";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}
