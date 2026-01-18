import { useEffect, useState } from "react";
import { cancelReservation, fetchReservations } from "../api";
import type { UserReservation } from "../types";

interface ReservationsPanelProps {
  token: string;
}

export default function ReservationsPanel({ token }: ReservationsPanelProps) {
  const [reservations, setReservations] = useState<UserReservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadReservations = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchReservations(token);
      setReservations(result.reservations);
    } catch (err: any) {
      setError(err?.message || "reservations_load_failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReservations();
  }, [token]);

  const handleCancel = async (reservationId: string) => {
    setActionId(reservationId);
    setError(null);
    try {
      await cancelReservation(token, reservationId);
      await loadReservations();
    } catch (err: any) {
      setError(err?.message || "cancel_failed");
    } finally {
      setActionId(null);
    }
  };

  return (
    <section className="card" data-animate>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Mój plan</p>
          <h2>Rezerwacje</h2>
        </div>
        <button className="ghost-button" onClick={loadReservations}>
          Odśwież
        </button>
      </div>

      {loading ? <p className="muted">Ładowanie...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="reservation-list">
        {reservations.length === 0 ? (
          <p className="muted">Brak rezerwacji.</p>
        ) : (
          reservations.map((reservation) => {
            const statusLabel =
              reservation.status === "active" ? "aktywna" : "anulowana";

            return (
              <div
                key={reservation.id}
                className={`reservation-item ${reservation.status}`}
              >
                <div>
                  <h3>{reservation.roomName}</h3>
                  <p className="muted">
                    {reservation.roomLocation} -{" "}
                    {new Date(reservation.startTime).toLocaleString("pl-PL", {
                      dateStyle: "medium",
                      timeStyle: "short"
                    })}
                  </p>
                </div>
                <div className="reservation-actions">
                  <span className="pill status">{statusLabel}</span>
                  {reservation.status === "active" ? (
                    <button
                      className="ghost-button"
                      onClick={() => handleCancel(reservation.id)}
                      disabled={actionId === reservation.id}
                    >
                      {actionId === reservation.id ? "Anuluję..." : "Anuluj"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}