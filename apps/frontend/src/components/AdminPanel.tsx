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
          <p className="eyebrow">Przegląd administracyjny</p>
          <h2>Podsumowanie użycia</h2>
        </div>
        <button className="ghost-button" onClick={loadStats}>
          Odśwież
        </button>
      </div>

      {loading ? <p className="muted">Ładowanie...</p> : null}
      {error ? <p className="error">{error}</p> : null}

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
    </section>
  );
}