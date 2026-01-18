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

const errorMessages: Record<string, string> = {
  admin_stats_failed: "Nie udało się pobrać statystyk.",
  admin_users_failed: "Nie udało się pobrać listy użytkowników.",
  missing_fields: "Uzupełnij wszystkie pola.",
  invalid_role: "Nieprawidłowa rola użytkownika.",
  invalid_status: "Nieprawidłowy status konta.",
  user_not_found: "Nie znaleziono użytkownika.",
  admin_user_update_failed: "Nie udało się zaktualizować użytkownika.",
  admin_password_reset_failed: "Nie udało się zresetować hasła.",
  weak_password: "Nowe hasło musi mieć co najmniej 8 znaków.",
  auth_lookup_failed: "Nie udało się zweryfikować sesji.",
  forbidden: "Brak uprawnień do wykonania tej operacji.",
  request_failed: "Wystąpił błąd komunikacji."
};

const resolveError = (err: any, fallback: string) =>
  errorMessages[err?.message] || fallback;

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
      setStatsError(resolveError(err, "Nie udało się pobrać statystyk."));
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
      setUsersError(resolveError(err, "Nie udało się pobrać listy użytkowników."));
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
      setUsersError(resolveError(err, "Nie udało się zaktualizować użytkownika."));
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
      setUsersError(resolveError(err, "Nie udało się zaktualizować użytkownika."));
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
      setUsersError(resolveError(err, "Nie udało się zresetować hasła."));
    } finally {
      setActionUserId(null);
    }
  };

  return (
    <section className="panel" data-animate>
      <div className="section-head">
        <div>
          <p className="eyebrow">Nadzór operacyjny</p>
          <h2>Podsumowanie użycia</h2>
          <p className="muted">Szybki wgląd w rezerwacje i aktywność zespołu.</p>
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
              Aktywne: {stats.reservations.active} | Anulowane: {" "}
              {stats.reservations.canceled}
            </p>
            <p className="muted small">Dziś: {stats.reservations.today}</p>
          </div>
          <div className="stat-card">
            <p className="muted">Rezerwacje globalne</p>
            {stats.globalReservations ? (
              <>
                <h3 className="stat-value">
                  {stats.globalReservations.total}
                </h3>
                <p className="muted small">
                  Aktywne: {stats.globalReservations.active} | Anulowane: {" "}
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
        <div className="section-head">
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