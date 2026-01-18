import { useEffect, useState } from "react";
import { fetchAdminStats } from "../api";
import type { AdminStats } from "../types";

interface AdminPanelProps {
  token: string;
}

export default function AdminPanel({ token }: AdminPanelProps) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdminStats(token);
      setStats(result);
    } catch (err: any) {
      setError(err?.message || "stats_load_failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [token]);

  return (
    <section className="card" data-animate>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Admin overview</p>
          <h2>Usage snapshot</h2>
        </div>
        <button className="ghost-button" onClick={loadStats}>
          Refresh
        </button>
      </div>

      {loading ? <p className="muted">Loading...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {stats ? (
        <div className="stats-grid">
          <div className="stat-card">
            <p className="muted">Users</p>
            <h3 className="stat-value">{stats.users.total}</h3>
          </div>
          <div className="stat-card">
            <p className="muted">Rooms</p>
            <h3 className="stat-value">{stats.rooms.total}</h3>
          </div>
          <div className="stat-card">
            <p className="muted">Reservations</p>
            <h3 className="stat-value">{stats.reservations.total}</h3>
            <p className="muted small">
              Active: {stats.reservations.active} | Canceled: {stats.reservations.canceled}
            </p>
            <p className="muted small">Today: {stats.reservations.today}</p>
          </div>
          <div className="stat-card">
            <p className="muted">Global reservations</p>
            {stats.globalReservations ? (
              <>
                <h3 className="stat-value">{stats.globalReservations.total}</h3>
                <p className="muted small">
                  Active: {stats.globalReservations.active} | Canceled:{" "}
                  {stats.globalReservations.canceled}
                </p>
              </>
            ) : (
              <p className="muted">Spanner emulator offline.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
