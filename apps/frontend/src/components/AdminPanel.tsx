import { useEffect, useState, type CSSProperties } from "react";
import {
  fetchAdminStats,
  fetchAdminUsers,
  resetAdminUserPassword,
  updateAdminUser
} from "../api";
import type { NotifyPayload, StatusUpdate } from "../notifications";
import type { AdminStats, AdminUser } from "../types";

interface AdminPanelProps {
  token: string;
  onNotify?: (payload: NotifyPayload) => void;
  onStatusUpdate?: (update: StatusUpdate) => void;
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

const formatNumber = (value: number) => value.toLocaleString("pl-PL");
const formatDecimal = (value: number) =>
  value.toLocaleString("pl-PL", {
    maximumFractionDigits: 1,
    minimumFractionDigits: value > 0 && value < 1 ? 1 : 0
  });
const formatPercent = (ratio: number) => `${Math.round(ratio * 100)}%`;
const safeRatio = (value: number, total: number) => (total > 0 ? value / total : 0);

export default function AdminPanel({
  token,
  onNotify,
  onStatusUpdate
}: AdminPanelProps) {
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
      onStatusUpdate?.({ api: "ok" });
    } catch (err: any) {
      setStatsError(resolveError(err, "Nie udało się pobrać statystyk."));
      onStatusUpdate?.({ api: "warning" });
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
      onStatusUpdate?.({ api: "ok" });
    } catch (err: any) {
      setUsersError(resolveError(err, "Nie udało się pobrać listy użytkowników."));
      onStatusUpdate?.({ api: "warning" });
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
      const message = "Zaktualizowano rolę użytkownika.";
      setActionMessage(message);
      onNotify?.({
        title: "Zmiana roli",
        message,
        tone: "success",
        status: { api: "ok" }
      });
    } catch (err: any) {
      const message = resolveError(err, "Nie udało się zaktualizować użytkownika.");
      setUsersError(message);
      onNotify?.({
        title: "Nie udało się zmienić roli",
        message,
        tone: "error",
        status: { api: "warning" }
      });
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
      const message = isActive
        ? "Konto zostało aktywowane."
        : "Konto zostało zablokowane.";
      setActionMessage(message);
      onNotify?.({
        title: "Status konta",
        message,
        tone: "success",
        status: { api: "ok" }
      });
    } catch (err: any) {
      const message = resolveError(err, "Nie udało się zaktualizować użytkownika.");
      setUsersError(message);
      onNotify?.({
        title: "Nie udało się zmienić statusu",
        message,
        tone: "error",
        status: { api: "warning" }
      });
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
      onNotify?.({
        title: "Reset hasła",
        message,
        tone: "success",
        status: { api: "ok" }
      });
    } catch (err: any) {
      const message = resolveError(err, "Nie udało się zresetować hasła.");
      setUsersError(message);
      onNotify?.({
        title: "Reset hasła nieudany",
        message,
        tone: "error",
        status: { api: "warning" }
      });
    } finally {
      setActionUserId(null);
    }
  };

  const derivedStats = stats
    ? (() => {
        const totalReservations = stats.reservations.total;
        const activeReservations = stats.reservations.active;
        const canceledReservations = stats.reservations.canceled;
        const todayReservations = stats.reservations.today;
        const totalRooms = stats.rooms.total;
        const totalUsers = stats.users.total;
        const activeRatio = Math.min(
          1,
          safeRatio(activeReservations, totalReservations)
        );
        const canceledRatio = Math.min(
          1,
          safeRatio(canceledReservations, totalReservations)
        );
        const todayRatio = Math.min(
          1,
          safeRatio(todayReservations, totalReservations)
        );
        const reservationsPerRoom = safeRatio(totalReservations, totalRooms);
        const activePerRoom = safeRatio(activeReservations, totalRooms);
        const usersPerRoom = safeRatio(totalUsers, totalRooms);
        const global = stats.globalReservations
          ? {
              total: stats.globalReservations.total,
              active: stats.globalReservations.active,
              canceled: stats.globalReservations.canceled,
              activeRatio: Math.min(
                1,
                safeRatio(
                  stats.globalReservations.active,
                  stats.globalReservations.total
                )
              ),
              coverageRatio: Math.min(
                1,
                safeRatio(stats.globalReservations.total, totalReservations)
              )
            }
          : null;

        return {
          totalReservations,
          activeReservations,
          canceledReservations,
          todayReservations,
          totalRooms,
          totalUsers,
          activeRatio,
          canceledRatio,
          todayRatio,
          reservationsPerRoom,
          activePerRoom,
          usersPerRoom,
          global
        };
      })()
    : null;

  const scaleSteps = 12;
  const scaleFill = derivedStats
    ? Math.round(derivedStats.activeRatio * scaleSteps)
    : 0;

  return (
    <section className="panel admin-panel" data-animate>
      <div className="section-head">
        <div>
          <p className="eyebrow">Panel admina</p>
          <h2>Centrum statystyk</h2>
          <p className="muted">
            Wskaźniki wykorzystania sal, obciążenia i synchronizacji w jednym
            miejscu.
          </p>
        </div>
        <button className="ghost-button" onClick={loadStats}>
          Odśwież
        </button>
      </div>

      {statsLoading ? <p className="muted">Ładowanie...</p> : null}
      {statsError ? <p className="error">{statsError}</p> : null}

      {derivedStats ? (
        <div className="stats-center">
          <div className="stats-hero">
            <div className="stats-hero-content">
              <div className="stats-hero-copy">
                <p className="eyebrow">Centrum statystyk</p>
                <h3>Wykorzystanie sal i obciążenie</h3>
                <p className="muted">
                  Szybki podgląd trendów, efektywności i dynamiki rezerwacji.
                </p>
                <div className="stats-hero-kpis">
                  <div className="hero-kpi">
                    <span>Rezerwacje łącznie</span>
                    <strong>{formatNumber(derivedStats.totalReservations)}</strong>
                    <span className="muted small">
                      Dziś: {formatNumber(derivedStats.todayReservations)}
                    </span>
                  </div>
                  <div className="hero-kpi">
                    <span>Sale</span>
                    <strong>{formatNumber(derivedStats.totalRooms)}</strong>
                    <span className="muted small">
                      {formatDecimal(derivedStats.reservationsPerRoom)} rezerw./sala
                    </span>
                  </div>
                  <div className="hero-kpi">
                    <span>Użytkownicy</span>
                    <strong>{formatNumber(derivedStats.totalUsers)}</strong>
                    <span className="muted small">
                      {formatDecimal(derivedStats.usersPerRoom)} osób/sala
                    </span>
                  </div>
                </div>
              </div>
              <div className="stats-hero-visual">
                <div
                  className="stats-gauge"
                  style={{ "--progress": derivedStats.activeRatio } as CSSProperties}
                >
                  <div className="stats-gauge-inner">
                    <span>Aktywne</span>
                    <strong>{formatPercent(derivedStats.activeRatio)}</strong>
                  </div>
                </div>
                <div className="stats-hero-foot">
                  <div className="stat-mini">
                    <span>Anulowane</span>
                    <strong>{formatPercent(derivedStats.canceledRatio)}</strong>
                  </div>
                  <div className="stat-mini">
                    <span>Dziś</span>
                    <strong>{formatPercent(derivedStats.todayRatio)}</strong>
                  </div>
                </div>
                <div className="stats-scale">
                  <p className="section-label">Skala obciążenia</p>
                  <div className="stats-scale-grid">
                    {Array.from({ length: scaleSteps }).map((_, index) => (
                      <span
                        key={index}
                        className={`scale-dot ${
                          index < scaleFill ? "active" : ""
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="stats-side">
            <div className="stats-card">
              <div className="stats-card-head">
                <h4>Rozkład rezerwacji</h4>
                <span className="muted small">
                  Łącznie: {formatNumber(derivedStats.totalReservations)}
                </span>
              </div>
              <div className="stats-bars">
                <div className="stats-bar-row">
                  <span>Aktywne</span>
                  <div
                    className="stats-bar success"
                    style={{ "--value": derivedStats.activeRatio } as CSSProperties}
                  />
                  <span>{formatNumber(derivedStats.activeReservations)}</span>
                </div>
                <div className="stats-bar-row">
                  <span>Anulowane</span>
                  <div
                    className="stats-bar danger"
                    style={{ "--value": derivedStats.canceledRatio } as CSSProperties}
                  />
                  <span>{formatNumber(derivedStats.canceledReservations)}</span>
                </div>
                <div className="stats-bar-row">
                  <span>Dzisiaj</span>
                  <div
                    className="stats-bar info"
                    style={{ "--value": derivedStats.todayRatio } as CSSProperties}
                  />
                  <span>{formatNumber(derivedStats.todayReservations)}</span>
                </div>
              </div>
            </div>

            <div className="stats-card">
              <div className="stats-card-head">
                <h4>Synchronizacja globalna</h4>
                <span className="muted small">Spójność i pokrycie</span>
              </div>
              {derivedStats.global ? (
                <div className="stats-global">
                  <div
                    className="stats-gauge small"
                    style={
                      { "--progress": derivedStats.global.activeRatio } as CSSProperties
                    }
                  >
                    <div className="stats-gauge-inner">
                      <span>Aktywne</span>
                      <strong>{formatPercent(derivedStats.global.activeRatio)}</strong>
                    </div>
                  </div>
                  <div className="stats-global-details">
                    <div>
                      <p className="muted small">Rezerwacje globalne</p>
                      <h3>{formatNumber(derivedStats.global.total)}</h3>
                    </div>
                    <div className="stats-global-bar">
                      <span className="muted small">Pokrycie globalne</span>
                      <div
                        className="stats-bar accent"
                        style={
                          { "--value": derivedStats.global.coverageRatio } as CSSProperties
                        }
                      />
                      <span className="muted small">
                        {formatPercent(derivedStats.global.coverageRatio)}
                      </span>
                    </div>
                    <div className="stats-global-meta">
                      <span>Aktywne: {formatNumber(derivedStats.global.active)}</span>
                      <span>Anulowane: {formatNumber(derivedStats.global.canceled)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="muted">Emulator Spanner jest niedostępny.</p>
              )}
            </div>

            <div className="stats-card compact">
              <div className="stats-card-head">
                <h4>Efektywność operacyjna</h4>
                <span className="muted small">Skondensowane wskaźniki</span>
              </div>
              <div className="stats-metrics">
                <div className="stats-metric">
                  <span>Rezerwacje / sala</span>
                  <strong>{formatDecimal(derivedStats.reservationsPerRoom)}</strong>
                </div>
                <div className="stats-metric">
                  <span>Aktywne / sala</span>
                  <strong>{formatDecimal(derivedStats.activePerRoom)}</strong>
                </div>
                <div className="stats-metric">
                  <span>Użytkownicy / sala</span>
                  <strong>{formatDecimal(derivedStats.usersPerRoom)}</strong>
                </div>
              </div>
            </div>
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
