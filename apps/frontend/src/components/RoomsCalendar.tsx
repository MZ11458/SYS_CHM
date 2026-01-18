import { useEffect, useMemo, useState } from "react";
import { createReservation, fetchRooms } from "../api";
import type { NotifyPayload, StatusUpdate } from "../notifications";
import type { Reservation, Room } from "../types";

interface RoomsCalendarProps {
  token: string;
  onNotify?: (payload: NotifyPayload) => void;
  onStatusUpdate?: (update: StatusUpdate) => void;
  onRemindersRefresh?: () => void;
}

const HOURS = Array.from({ length: 10 }, (_, index) => 8 + index);

const loadErrorMessages: Record<string, string> = {
  rooms_fetch_failed: "Nie udało się pobrać dostępności sal.",
  auth_lookup_failed: "Nie udało się zweryfikować sesji użytkownika.",
  missing_token: "Brak autoryzacji. Zaloguj się ponownie.",
  invalid_token: "Sesja wygasła. Zaloguj się ponownie.",
  request_failed: "Nie udało się pobrać danych."
};

const actionErrorMessages: Record<string, string> = {
  slot_taken: "Wybrany slot jest już zajęty.",
  invalid_time: "Nieprawidłowa godzina rezerwacji.",
  invalid_range: "Nieprawidłowy zakres rezerwacji.",
  missing_user: "Brak danych użytkownika.",
  spanner_sync_failed: "Rezerwacja zapisana lokalnie, brak synchronizacji globalnej.",
  reservation_create_failed: "Nie udało się utworzyć rezerwacji.",
  request_failed: "Nie udało się utworzyć rezerwacji."
};

function toDateInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

function formatHourLabel(hour: number) {
  return `${hour.toString().padStart(2, "0")}:00`;
}

function formatTimeLabel(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function hasOverlap(
  reservation: Reservation,
  slotStart: number,
  slotEnd: number
) {
  const start = new Date(reservation.startTime).getTime();
  const end = new Date(reservation.endTime).getTime();
  return start < slotEnd && end > slotStart;
}

export default function RoomsCalendar({
  token,
  onNotify,
  onStatusUpdate,
  onRemindersRefresh
}: RoomsCalendarProps) {
  const [selectedDate, setSelectedDate] = useState(() =>
    toDateInputValue(new Date())
  );
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    room: Room;
    start: number;
    end: number;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchRooms(selectedDate, token);
        if (!ignore) {
          setRooms(result.rooms);
          onStatusUpdate?.({ api: "ok" });
        }
      } catch (err: any) {
        if (!ignore) {
          const message =
            loadErrorMessages[err?.message] ||
            "Nie udało się pobrać dostępności.";
          setError(message);
          onStatusUpdate?.({ api: "warning" });
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      ignore = true;
    };
  }, [selectedDate, token, onStatusUpdate]);

  useEffect(() => {
    setDraft(null);
    setActionError(null);
  }, [selectedDate]);

  const slots = useMemo(() => {
    return HOURS.map((hour) => {
      const start = new Date(
        `${selectedDate}T${hour.toString().padStart(2, "0")}:00:00`
      );
      const end = new Date(start.getTime() + 60 * 60000);
      return {
        label: formatHourLabel(hour),
        start: start.getTime(),
        end: end.getTime()
      };
    });
  }, [selectedDate]);

  const handleReserve = async () => {
    if (!draft) {
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      await createReservation(token, {
        roomId: draft.room.id,
        startTime: new Date(draft.start).toISOString(),
        endTime: new Date(draft.end).toISOString()
      });

      const result = await fetchRooms(selectedDate, token);
      setRooms(result.rooms);
      setDraft(null);
      onStatusUpdate?.({ api: "ok", spanner: "ok" });
      onRemindersRefresh?.();
      onNotify?.({
        title: "Rezerwacja utworzona",
        message: "Slot został zapisany i zsynchronizowany globalnie.",
        tone: "success"
      });
    } catch (err: any) {
      const message =
        actionErrorMessages[err?.message] ||
        "Nie udało się utworzyć rezerwacji.";
      setActionError(message);

      if (err?.message === "spanner_sync_failed") {
        onStatusUpdate?.({ spanner: "warning" });
        onNotify?.({
          title: "Synchronizacja globalna",
          message:
            "Rezerwacja została zapisana lokalnie, ale globalna synchronizacja nie powiodła się.",
          tone: "warning",
          status: { spanner: "warning" }
        });
      } else {
        onStatusUpdate?.({ api: "warning" });
        onNotify?.({
          title: "Rezerwacja nieudana",
          message,
          tone: "error",
          status: { api: "warning" }
        });
      }
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <section className="panel calendar" data-animate>
      <div className="section-head">
        <div>
          <p className="eyebrow">Dostępność zasobów</p>
          <h2>Sale i zasoby</h2>
          <p className="muted">
            Wybierz datę i kliknij wolny slot, aby przygotować rezerwację.
          </p>
        </div>
        <div className="section-actions">
          <label className="field">
            <span>Data</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>
          {loading ? <span className="status-text">Ładowanie...</span> : null}
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="calendar-body">
        <div className="calendar-grid">
          <div className="calendar-row header">
            <div className="room-cell">Sala</div>
            {slots.map((slot) => (
              <div key={slot.label} className="slot-cell">
                {slot.label}
              </div>
            ))}
          </div>

          {rooms.map((room) => (
            <div key={room.id} className="calendar-row">
              <div className="room-cell">
                <div className="room-title">
                  <h3>{room.name}</h3>
                  <span className="muted">{room.location}</span>
                </div>
                <div className="room-meta">
                  <span>{room.capacity} miejsc</span>
                  <div className="chip-row">
                    {room.resources.map((resource) => (
                      <span key={resource} className="chip">
                        {resource}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {slots.map((slot) => {
                const reserved = room.reservations.some((reservation) =>
                  hasOverlap(reservation, slot.start, slot.end)
                );
                const selected =
                  draft?.room.id === room.id && draft?.start === slot.start;
                return (
                  <div
                    key={`${room.id}-${slot.label}`}
                    className={`slot-cell ${reserved ? "busy" : "free"} ${
                      selected ? "selected" : ""
                    } ${reserved ? "" : "clickable"}`}
                    onClick={() => {
                      if (!reserved) {
                        setDraft({ room, start: slot.start, end: slot.end });
                      }
                    }}
                  >
                    <span>{reserved ? "Zajęte" : "Wolne"}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <aside className="reservation-panel">
          <p className="eyebrow">Rezerwacja</p>
          {draft ? (
            <>
              <h3>{draft.room.name}</h3>
              <p className="muted">
                {draft.room.location} - {formatTimeLabel(draft.start)}-
                {formatTimeLabel(draft.end)}
              </p>
            </>
          ) : (
            <p className="muted">
              Wybierz wolny slot, aby przygotować rezerwację.
            </p>
          )}
          <div className="reservation-actions">
            <button onClick={handleReserve} disabled={!draft || actionLoading}>
              {actionLoading ? "Rezerwuję..." : "Potwierdź rezerwację"}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setDraft(null)}
              disabled={!draft || actionLoading}
            >
              Wyczyść
            </button>
          </div>
          {actionError ? <p className="error">{actionError}</p> : null}
        </aside>
      </div>
    </section>
  );
}