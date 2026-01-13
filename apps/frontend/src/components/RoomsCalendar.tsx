import { useEffect, useMemo, useState } from "react";
import { createReservation, fetchRooms } from "../api";
import {
  formatRoomLocation,
  formatRoomResource,
  normalizeRoomLocation
} from "../roomLabels";
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

function formatRoomCount(count: number) {
  if (count === 1) {
    return `${count} sala`;
  }
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} sale`;
  }
  return `${count} sal`;
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
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedCity, setSelectedCity] = useState("all");
  const [filterPickerOpen, setFilterPickerOpen] = useState(false);
  const [filterPickerMode, setFilterPickerMode] = useState<
    "branch" | "city" | null
  >(null);
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

  useEffect(() => {
    if (!draft) {
      return;
    }

    if (selectedBranch !== "all" && draft.room.branch !== selectedBranch) {
      setDraft(null);
      return;
    }

    if (
      selectedCity !== "all" &&
      normalizeRoomLocation(draft.room.location) !== selectedCity
    ) {
      setDraft(null);
    }
  }, [selectedBranch, selectedCity, draft]);

  const branchOptions = useMemo(() => {
    const unique = Array.from(
      new Set(rooms.map((room) => room.branch).filter(Boolean))
    );
    return unique.sort((left, right) => left.localeCompare(right, "pl"));
  }, [rooms]);

  const roomsForCities = useMemo(() => {
    if (selectedBranch === "all") {
      return rooms;
    }
    return rooms.filter((room) => room.branch === selectedBranch);
  }, [rooms, selectedBranch]);

  const cityOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        roomsForCities
          .map((room) => normalizeRoomLocation(room.location))
          .filter(Boolean)
      )
    );
    return unique.sort((left, right) => left.localeCompare(right, "pl"));
  }, [roomsForCities]);

  useEffect(() => {
    if (selectedBranch !== "all" && !branchOptions.includes(selectedBranch)) {
      setSelectedBranch("all");
    }
  }, [branchOptions, selectedBranch]);

  useEffect(() => {
    if (selectedCity !== "all" && !cityOptions.includes(selectedCity)) {
      setSelectedCity("all");
    }
  }, [cityOptions, selectedCity]);

  const openFilterPicker = (mode: "branch" | "city") => {
    setFilterPickerMode(mode);
    setFilterPickerOpen(true);
  };

  const closeFilterPicker = () => {
    setFilterPickerOpen(false);
    setFilterPickerMode(null);
  };

  useEffect(() => {
    if (!filterPickerOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeFilterPicker();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filterPickerOpen]);

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

  const branchCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const room of rooms) {
      if (!room.branch) {
        continue;
      }
      counts[room.branch] = (counts[room.branch] || 0) + 1;
    }
    return counts;
  }, [rooms]);

  const cityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const room of roomsForCities) {
      const city = normalizeRoomLocation(room.location);
      if (!city) {
        continue;
      }
      counts[city] = (counts[city] || 0) + 1;
    }
    return counts;
  }, [roomsForCities]);

  const selectedBranchLabel =
    selectedBranch === "all" ? "Wszystkie" : selectedBranch;
  const selectedCityLabel = selectedCity === "all" ? "Wszystkie" : selectedCity;

  const visibleRooms = useMemo(() => {
    return rooms.filter((room) => {
      if (selectedBranch !== "all" && room.branch !== selectedBranch) {
        return false;
      }
      if (
        selectedCity !== "all" &&
        normalizeRoomLocation(room.location) !== selectedCity
      ) {
        return false;
      }
      return true;
    });
  }, [rooms, selectedBranch, selectedCity]);

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
    <>
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
              <span>Oddział</span>
              <button
                type="button"
                className="branch-button"
                onClick={() => openFilterPicker("branch")}
                aria-haspopup="dialog"
                aria-expanded={filterPickerOpen}
                aria-controls="filter-picker"
              >
                <span>{selectedBranchLabel}</span>
                <span className="branch-button-hint">Wybierz</span>
              </button>
            </label>
            <label className="field">
              <span>Miasto</span>
              <button
                type="button"
                className="branch-button"
                onClick={() => openFilterPicker("city")}
                aria-haspopup="dialog"
                aria-expanded={filterPickerOpen}
                aria-controls="filter-picker"
              >
                <span>{selectedCityLabel}</span>
                <span className="branch-button-hint">Wybierz</span>
              </button>
            </label>
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

            {visibleRooms.map((room) => (
              <div key={room.id} className="calendar-row">
                <div className="room-cell">
                  <div className="room-title">
                    <h3>{room.name}</h3>
                    <span className="muted">
                      {formatRoomLocation(room.location)}
                    </span>
                  </div>
                  <div className="room-meta">
                    <span>{room.capacity} miejsc</span>
                    <div className="chip-row">
                      {room.resources.map((resource) => (
                        <span key={resource} className="chip">
                          {formatRoomResource(resource)}
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
                  {formatRoomLocation(draft.room.location)} -{" "}
                  {formatTimeLabel(draft.start)}-
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

      {filterPickerOpen && filterPickerMode ? (
        <div
          className="branch-modal"
          role="dialog"
          aria-modal="true"
          aria-label={
            filterPickerMode === "branch"
              ? "Wybierz oddział"
              : "Wybierz miasto"
          }
          id="filter-picker"
          onClick={closeFilterPicker}
        >
          <div
            className="branch-modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="branch-modal-head">
              <div>
                <p className="eyebrow">Filtry</p>
                <h3>
                  {filterPickerMode === "branch"
                    ? "Wybierz oddział"
                    : "Wybierz miasto"}
                </h3>
                <p className="muted">
                  {filterPickerMode === "branch"
                    ? "Pokazuj sale tylko w wybranym oddziale."
                    : "Pokazuj sale tylko w wybranym mieście."}
                </p>
              </div>
              <button
                type="button"
                className="ghost-button tiny"
                onClick={closeFilterPicker}
              >
                Zamknij
              </button>
            </div>
            {filterPickerMode === "branch" ? (
              <div className="branch-modal-section">
                <p className="section-label">Oddziały</p>
                <div className="branch-tiles">
                  <button
                    type="button"
                    className={`branch-tile ${
                      selectedBranch === "all" ? "active" : ""
                    }`}
                    onClick={() => {
                      setSelectedBranch("all");
                      closeFilterPicker();
                    }}
                  >
                    <span className="branch-tile-title">Wszystkie oddziały</span>
                    <span className="branch-tile-meta">
                      {formatRoomCount(rooms.length)}
                    </span>
                  </button>
                  {branchOptions.map((branch) => (
                    <button
                      key={branch}
                      type="button"
                      className={`branch-tile ${
                        selectedBranch === branch ? "active" : ""
                      }`}
                      onClick={() => {
                        setSelectedBranch(branch);
                        closeFilterPicker();
                      }}
                    >
                      <span className="branch-tile-title">{branch}</span>
                      <span className="branch-tile-meta">
                        {formatRoomCount(branchCounts[branch] || 0)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="branch-modal-section">
                <p className="section-label">Miasta</p>
                <div className="branch-tiles">
                  <button
                    type="button"
                    className={`branch-tile ${
                      selectedCity === "all" ? "active" : ""
                    }`}
                    onClick={() => {
                      setSelectedCity("all");
                      closeFilterPicker();
                    }}
                  >
                    <span className="branch-tile-title">Wszystkie miasta</span>
                    <span className="branch-tile-meta">
                      {formatRoomCount(roomsForCities.length)}
                    </span>
                  </button>
                  {cityOptions.map((city) => (
                    <button
                      key={city}
                      type="button"
                      className={`branch-tile ${
                        selectedCity === city ? "active" : ""
                      }`}
                      onClick={() => {
                        setSelectedCity(city);
                        closeFilterPicker();
                      }}
                    >
                      <span className="branch-tile-title">{city}</span>
                      <span className="branch-tile-meta">
                        {formatRoomCount(cityCounts[city] || 0)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
