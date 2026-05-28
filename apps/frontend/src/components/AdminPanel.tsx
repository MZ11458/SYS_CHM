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
const formatShortDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "short"
  });
const formatDayLabel = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("pl-PL", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  });

const buildTrendSeries = (values: number[]) => {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? 100 / (values.length - 1) : 0;
  const points = values.map((value, index) => {
    const x = step * index;
    const y = 100 - (value / max) * 100;
    return { x, y };
  });
  const line = points.length
    ? `M ${points.map((point) => `${point.x},${point.y}`).join(" L ")}`
    : "";
  const area = points.length
    ? `${line} L ${points[points.length - 1].x},100 L ${points[0].x},100 Z`
    : "";

  return { line, area, max };
};

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
        const heatmap = stats.utilization?.heatmap ?? [];
        const trend = stats.utilization?.trend ?? [];

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
          heatmap,
          trend
        };
      })()
    : null;

  const scaleSteps = 12;
  const scaleFill = derivedStats
    ? Math.round(derivedStats.activeRatio * scaleSteps)
    : 0;

  const heatmapEntries = derivedStats?.heatmap ?? [];
  const heatmapHours = Array.from({ length: 24 }, (_, hour) => hour);
  const heatmapMap = new Map<string, number[]>();
  for (const entry of heatmapEntries) {
    if (!heatmapMap.has(entry.date)) {
      heatmapMap.set(entry.date, Array.from({ length: 24 }, () => 0));
    }
    heatmapMap.get(entry.date)![entry.hour] = entry.count;
  }
  const heatmapRows = Array.from(heatmapMap.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, values]) => ({ date, values }));
  const heatmapMax = heatmapEntries.reduce(
    (max, entry) => Math.max(max, entry.count),
    0
  );

  const trendEntries = derivedStats?.trend ?? [];
  const trendCounts = trendEntries.map((entry) => entry.count);
  const trendSeries = buildTrendSeries(trendCounts);
  const trend7 = trendEntries.slice(-7);
  const trend7Counts = trend7.map((entry) => entry.count);
  const trend7Max = Math.max(1, ...trend7Counts);
  const trend7Total = trend7Counts.reduce((sum, value) => sum + value, 0);
  const trend30Total = trendCounts.reduce((sum, value) => sum + value, 0);
  const trend7Avg = trend7Counts.length ? trend7Total / trend7Counts.length : 0;

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
        <>
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

        <div className="stats-insights">
          <div className="stats-card stats-heatmap-card">
            <div className="stats-card-head">
              <div>
                <h4>Heatmapa godzinowa</h4>
                <span className="muted small">
                  Ostatnie 7 dni · aktywne rezerwacje
                </span>
              </div>
              <div className="heatmap-legend">
                <span className="legend-label">0</span>
                <span className="legend-swatch low" />
                <span className="legend-swatch mid" />
                <span className="legend-swatch high" />
                <span className="legend-label">
                  {heatmapMax > 0 ? formatNumber(heatmapMax) : "0"}
                </span>
              </div>
            </div>
            {heatmapRows.length ? (
              <div className="heatmap-wrapper">
                <div className="heatmap-grid">
                  <span className="heatmap-corner" />
                  {heatmapHours.map((hour) => (
                    <span key={hour} className="heatmap-hour">
                      {hour % 3 === 0 ? hour.toString().padStart(2, "0") : ""}
                    </span>
                  ))}
                  {heatmapRows.map((row) => (
                    <div key={row.date} className="heatmap-row">
                      <span className="heatmap-day">
                        {formatDayLabel(row.date)}
                      </span>
                      {row.values.map((value, hour) => {
                        const ratio =
                          heatmapMax > 0 ? value / heatmapMax : 0;
                        return (
                          <span
                            key={`${row.date}-${hour}`}
                            className="heatmap-cell"
                            style={{ "--heat": ratio } as CSSProperties}
                            title={`${formatDayLabel(row.date)} · ${hour
                              .toString()
                              .padStart(2, "0")}:00 – ${hour
                              .toString()
                              .padStart(2, "0")}:59 · ${value} rezerw.`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="muted">Brak danych z ostatnich 7 dni.</p>
            )}
          </div>

          <div className="stats-card stats-trend-card">
            <div className="stats-card-head">
              <div>
                <h4>Trend 7/30 dni</h4>
                <span className="muted small">
                  Rezerwacje aktywne · ostatnie 30 dni
                </span>
              </div>
              <div className="trend-summary">
                <div>
                  <span className="section-label">7 dni</span>
                  <strong>{formatNumber(trend7Total)}</strong>
                  <span className="muted small">
                    {formatDecimal(trend7Avg)} / dzień
                  </span>
                </div>
                <div>
                  <span className="section-label">30 dni</span>
                  <strong>{formatNumber(trend30Total)}</strong>
                  <span className="muted small">
                    {formatDecimal(trend30Total / 30)} / dzień
                  </span>
                </div>
              </div>
            </div>
            {trendEntries.length ? (
              <div className="trend-visual">
                <div className="trend-chart">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path className="trend-area" d={trendSeries.area} />
                    <path className="trend-line" d={trendSeries.line} />
                  </svg>
                  <div className="trend-axis">
                    <span>{formatShortDate(trendEntries[0].date)}</span>
                    <span>
                      {formatShortDate(trendEntries[trendEntries.length - 1].date)}
                    </span>
                  </div>
                </div>
                <div className="trend-bars">
                  {trend7.map((entry) => (
                    <div key={entry.date} className="trend-bar">
                      <span
                        style={
                          {
                            "--value":
                              trend7Max > 0 ? entry.count / trend7Max : 0
                          } as CSSProperties
                        }
                        title={`${formatShortDate(entry.date)} · ${formatNumber(
                          entry.count
                        )} rezerw.`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="muted">Brak danych z ostatnich 30 dni.</p>
            )}
          </div>
        </div>
        </>
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
