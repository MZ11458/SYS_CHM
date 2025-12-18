import { useEffect, useState } from "react";
import {
  fetchAdminStats,
  fetchAdminUsers,
  resetAdminUserPassword,
  updateAdminUser
} from "../api";
import type { AdminStats, AdminUser } from "../types";

interface AdminPanelProps {
  token: string;
}

export default function AdminPanel({ token }: AdminPanelProps) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadStats = async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const result = await fetchAdminStats(token);
      setStats(result);
    } catch (err: any) {
      setStatsError(err?.message || "stats_load_failed");
    } finally {
      setStatsLoading(false);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const result = await fetchAdminUsers(token);
      setUsers(result.users);
    } catch (err: any) {
      setUsersError(err?.message || "users_load_failed");
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadUsers();
  }, [token]);

  const handleRoleChange = async (userId: string, role: "user" | "admin") => {
    setActionUserId(userId);
    setActionMessage(null);
    try {
      const result = await updateAdminUser(token, userId, { role });
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? result.user : user))
      );
      setActionMessage("Zaktualizowano rolę użytkownika.");
    } catch (err: any) {
      setUsersError(err?.message || "user_update_failed");
    } finally {
      setActionUserId(null);
    }
  };

  const handleActiveChange = async (userId: string, isActive: boolean) => {
    setActionUserId(userId);
    setActionMessage(null);
    try {
      const result = await updateAdminUser(token, userId, { isActive });
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? result.user : user))
      );
      setActionMessage(
        isActive ? "Konto zostało aktywowane." : "Konto zostało zablokowane."
      );
    } catch (err: any) {
      setUsersError(err?.message || "user_update_failed");
    } finally {
      setActionUserId(null);
    }
  };

  const handleResetPassword = async (user: AdminUser) => {
    const promptMessage =
      "Podaj nowe hasło (min. 8 znaków) lub zostaw puste, aby wygenerować.";
    const input = window.prompt(promptMessage, "");
    if (input === null) {
      return;
    }

    const newPassword = input.trim() ? input.trim() : undefined;

    setActionUserId(user.id);
    setActionMessage(null);

    try {
      const result = await resetAdminUserPassword(token, user.id, newPassword);
      const message = result.generated
        ? `Wygenerowane hasło dla ${user.email}: ${result.password}`
        : `Ustawiono nowe hasło dla ${user.email}.`;

      setActionMessage(message);
      window.alert(message);
    } catch (err: any) {
      setUsersError(err?.message || "password_reset_failed");
    } finally {
      setActionUserId(null);
    }
  };

  return (
    <section className="card" data-animate>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Przegląd administracyjny</p>
          <h2>Podsumowanie użycia</h2>
        </div>
        <button className="ghost-button" onClick={loadStats}>
          Odśwież
        </button>
      </div>

      {statsLoading ? <p className="muted">Ładowanie...</p> : null}
      {statsError ? <p className="error">{statsError}</p> : null}

      {stats ? (
        <div className="stats-grid">
          <div className="stat-card">
            <p className="muted">Użytkownicy</p>
            <h3 className="stat-value">{stats.users.total}</h3>
          </div>
          <div className="stat-card">
            <p className="muted">Sale</p>
            <h3 className="stat-value">{stats.rooms.total}</h3>
          </div>
          <div className="stat-card">
            <p className="muted">Rezerwacje</p>
            <h3 className="stat-value">{stats.reservations.total}</h3>
            <p className="muted small">
              Aktywne: {stats.reservations.active} | Anulowane:{" "}
              {stats.reservations.canceled}
            </p>
            <p className="muted small">Dziś: {stats.reservations.today}</p>
          </div>
          <div className="stat-card">
            <p className="muted">Rezerwacje globalne</p>
            {stats.globalReservations ? (
              <>
                <h3 className="stat-value">{stats.globalReservations.total}</h3>
                <p className="muted small">
                  Aktywne: {stats.globalReservations.active} | Anulowane:{" "}
                  {stats.globalReservations.canceled}
                </p>
              </>
            ) : (
              <p className="muted">Emulator Spanner jest niedostępny.</p>
            )}
          </div>
        </div>
      ) : null}

      <div className="admin-users">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Użytkownicy</p>
            <h2>Zarządzanie kontami</h2>
          </div>
          <button className="ghost-button" onClick={loadUsers}>
            Odśwież
          </button>
        </div>

        {usersLoading ? <p className="muted">Ładowanie...</p> : null}
        {usersError ? <p className="error">{usersError}</p> : null}
        {actionMessage ? <p className="note">{actionMessage}</p> : null}

        <div className="user-list">
          {users.length === 0 ? (
            <p className="muted">Brak użytkowników.</p>
          ) : (
            users.map((user) => (
              <div key={user.id} className="user-item">
                <div>
                  <h3>{user.fullName}</h3>
                  <p className="muted">{user.email}</p>
                </div>
                <div className="user-controls">
                  <label>
                    Rola
                    <select
                      value={user.role}
                      onChange={(event) =>
                        handleRoleChange(
                          user.id,
                          event.target.value as "user" | "admin"
                        )
                      }
                      disabled={actionUserId === user.id}
                    >
                      <option value="user">Użytkownik</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </label>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={user.isActive}
                      onChange={(event) =>
                        handleActiveChange(user.id, event.target.checked)
                      }
                      disabled={actionUserId === user.id}
                    />
                    <span>{user.isActive ? "Aktywne" : "Zablokowane"}</span>
                  </label>
                  <button
                    className="ghost-button"
                    onClick={() => handleResetPassword(user)}
                    disabled={actionUserId === user.id}
                  >
                    Reset hasła
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}