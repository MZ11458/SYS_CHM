import { useEffect, useMemo, useState } from "react";
import { createReservation, fetchRooms } from "../api";
import type { Reservation, Room } from "../types";

interface RoomsCalendarProps {
  token: string;
}

const HOURS = Array.from({ length: 10 }, (_, index) => 8 + index);

function toDateInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

function formatHourLabel(hour: number) {
  return `${hour.toString().padStart(2, "0")}:00`;
}

function formatTimeLabel(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("en-GB", {
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

export default function RoomsCalendar({ token }: RoomsCalendarProps) {
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
        }
      } catch (err: any) {
        if (!ignore) {
          setError(err?.message || "rooms_load_failed");
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
  }, [selectedDate, token]);

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
    } catch (err: any) {
      setActionError(err?.message || "reservation_failed");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <section className="calendar" data-animate>
      <div className="calendar-header">
        <div>
          <p className="eyebrow">Availability</p>
          <h2>Rooms and resources</h2>
        </div>
        <div className="calendar-controls">
          <label>
            Date
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>
          {loading ? <span className="muted">Loading...</span> : null}
        </div>
      </div>

      <div className="reservation-panel">
        <div>
          <p className="eyebrow">Reservation builder</p>
          {draft ? (
            <>
              <h3>{draft.room.name}</h3>
              <p className="muted">
                {draft.room.location} · {formatTimeLabel(draft.start)}-
                {formatTimeLabel(draft.end)}
              </p>
            </>
          ) : (
            <p className="muted">
              Select a free slot to prepare a reservation.
            </p>
          )}
        </div>
        <div className="reservation-actions">
          <button onClick={handleReserve} disabled={!draft || actionLoading}>
            {actionLoading ? "Booking..." : "Confirm booking"}
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setDraft(null)}
            disabled={!draft || actionLoading}
          >
            Clear
          </button>
        </div>
        {actionError ? <p className="error">{actionError}</p> : null}
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="calendar-grid">
        <div className="calendar-row header">
          <div className="room-cell">Room</div>
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
                <span>{room.capacity} seats</span>
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
                  <span>{reserved ? "Booked" : "Free"}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
