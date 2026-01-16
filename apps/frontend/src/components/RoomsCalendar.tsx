import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";
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
const WORLD_MAP_URL = new URL("../assets/world-map.svg", import.meta.url).href;
const MAP_VIEWBOX_WIDTH = 1010;
const MAP_VIEWBOX_HEIGHT = 666;
const MAP_SCALE = 1.2;
const MAP_OFFSET_X = -0.1;
const MAP_OFFSET_Y = -0.06;
const BRANCH_POSITIONS: Record<string, { x: number; y: number }> = {
  polska: { x: 528.55, y: 292.22 },
  warszawa: { x: 528.55, y: 292.22 },
  usa: { x: 205.9, y: 347.21 },
  "nowy jork": { x: 215, y: 275 },
  japonia: { x: 853.09, y: 356.53 },
  tokio: { x: 853.09, y: 356.53 },
  europa: { x: 0.52 * MAP_VIEWBOX_WIDTH, y: 0.44 * MAP_VIEWBOX_HEIGHT },
  azja: { x: 0.76 * MAP_VIEWBOX_WIDTH, y: 0.54 * MAP_VIEWBOX_HEIGHT },
  ameryka: { x: 0.18 * MAP_VIEWBOX_WIDTH, y: 0.44 * MAP_VIEWBOX_HEIGHT }
};

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

function formatCityList(cities: string[]) {
  if (cities.length <= 1) {
    return cities[0] || "Brak miasta";
  }
  if (cities.length === 2) {
    return `${cities[0]} • ${cities[1]}`;
  }
  return `${cities[0]}, ${cities[1]} +${cities.length - 2}`;
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

function resolveAvailabilityTier(ratio: number) {
  if (ratio >= 0.7) {
    return { key: "high", label: "Wysoka dostępność" };
  }
  if (ratio >= 0.4) {
    return { key: "medium", label: "Umiarkowana dostępność" };
  }
  return { key: "low", label: "Niska dostępność" };
}

function resolveBranchPosition(label: string, index: number, total: number) {
  const key = label.toLowerCase();
  const known = BRANCH_POSITIONS[key];
  if (known) {
    return known;
  }
  const count = Math.max(total, 1);
  const angle = (index / count) * Math.PI * 2;
  return {
    x: (0.5 + 0.32 * Math.cos(angle)) * MAP_VIEWBOX_WIDTH,
    y: (0.5 + 0.22 * Math.sin(angle)) * MAP_VIEWBOX_HEIGHT
  };
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
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapImageRef = useRef<HTMLImageElement | null>(null);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [mapLayout, setMapLayout] = useState<{
    width: number;
    height: number;
    mapLeft: number;
    mapTop: number;
    scale: number;
  } | null>(null);
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

  useLayoutEffect(() => {
    const node = mapRef.current;
    if (!node) {
      return;
    }

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setMapSize((current) => {
        if (current.width === rect.width && current.height === rect.height) {
          return current;
        }
        return { width: rect.width, height: rect.height };
      });
    };

    updateSize();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const updateMapLayout = useCallback(() => {
    const container = mapRef.current;
    const image = mapImageRef.current;
    if (!container || !image) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    if (!containerRect.width || !containerRect.height) {
      return;
    }

    const naturalWidth = image.naturalWidth || MAP_VIEWBOX_WIDTH;
    const naturalHeight = image.naturalHeight || MAP_VIEWBOX_HEIGHT;
    if (!naturalWidth || !naturalHeight || !imageRect.width || !imageRect.height) {
      return;
    }

    const viewScale = Math.min(
      naturalWidth / MAP_VIEWBOX_WIDTH,
      naturalHeight / MAP_VIEWBOX_HEIGHT
    );
    const viewWidth = MAP_VIEWBOX_WIDTH * viewScale;
    const viewHeight = MAP_VIEWBOX_HEIGHT * viewScale;
    const viewLeft = (naturalWidth - viewWidth) / 2;
    const viewTop = (naturalHeight - viewHeight) / 2;

    const scale = Math.min(
      imageRect.width / naturalWidth,
      imageRect.height / naturalHeight
    );
    const renderWidth = naturalWidth * scale;
    const renderHeight = naturalHeight * scale;
    const mapLeft =
      imageRect.left -
      containerRect.left +
      (imageRect.width - renderWidth) / 2 +
      viewLeft * scale;
    const mapTop =
      imageRect.top -
      containerRect.top +
      (imageRect.height - renderHeight) / 2 +
      viewTop * scale;

    setMapLayout({
      width: containerRect.width,
      height: containerRect.height,
      mapLeft,
      mapTop,
      scale: scale * viewScale
    });
  }, []);

  useLayoutEffect(() => {
    if (!mapSize.width || !mapSize.height) {
      return;
    }
    updateMapLayout();
  }, [mapSize, updateMapLayout]);

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

  const branchSummaries = useMemo(() => {
    const summaryMap = new Map<
      string,
      {
        rooms: Room[];
        freeSlots: number;
        totalSlots: number;
        cities: Set<string>;
      }
    >();
    const roomFreeSlots = new Map<string, number>();
    const totalSlotsPerRoom = slots.length;

    for (const room of rooms) {
      let freeSlots = 0;
      for (const slot of slots) {
        const reserved = room.reservations.some((reservation) =>
          hasOverlap(reservation, slot.start, slot.end)
        );
        if (!reserved) {
          freeSlots += 1;
        }
      }
      roomFreeSlots.set(room.id, freeSlots);

      const branch = room.branch || "Pozostałe";
      if (!summaryMap.has(branch)) {
        summaryMap.set(branch, {
          rooms: [],
          freeSlots: 0,
          totalSlots: 0,
          cities: new Set<string>()
        });
      }
      const entry = summaryMap.get(branch)!;
      entry.rooms.push(room);
      entry.freeSlots += freeSlots;
      entry.totalSlots += totalSlotsPerRoom;
      entry.cities.add(normalizeRoomLocation(room.location));
    }

    return Array.from(summaryMap.entries())
      .map(([branch, entry]) => {
        const ratio =
          entry.totalSlots > 0 ? entry.freeSlots / entry.totalSlots : 0;
        const tier = resolveAvailabilityTier(ratio);
        const cities = Array.from(entry.cities).sort((left, right) =>
          left.localeCompare(right, "pl")
        );
        const topRooms = entry.rooms
          .map((room) => ({
            name: room.name,
            freeSlots: roomFreeSlots.get(room.id) || 0
          }))
          .sort((left, right) => right.freeSlots - left.freeSlots)
          .slice(0, 3)
          .map((room) => room.name);

        return {
          branch,
          roomsCount: entry.rooms.length,
          freeSlots: entry.freeSlots,
          totalSlots: entry.totalSlots,
          availabilityKey: tier.key,
          availabilityLabel: tier.label,
          cities,
          topRooms
        };
      })
      .sort((left, right) => left.branch.localeCompare(right.branch, "pl"));
  }, [rooms, slots]);

  const branchMarkers = useMemo(() => {
    if (!mapLayout) {
      return [];
    }

    const labelOffset = Math.max(80, mapLayout.height * 0.22);
    const arrowStartOffset = 18;

    return branchSummaries.map((summary, index) => {
      const anchor = resolveBranchPosition(
        summary.branch,
        index,
        branchSummaries.length
      );
      const targetX = mapLayout.mapLeft + anchor.x * mapLayout.scale;
      const targetY = mapLayout.mapTop + anchor.y * mapLayout.scale;
      const labelY = Math.max(targetY - labelOffset, 20);
      const labelX = targetX;

      return {
        ...summary,
        targetX,
        targetY,
        labelX,
        labelY,
        arrowStartX: labelX,
        arrowStartY: labelY + arrowStartOffset
      };
    });
  }, [branchSummaries, mapLayout]);

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
      <section className="panel branch-overview" data-animate>
        <div className="section-head">
          <div>
            <p className="eyebrow">Mapa oddziałów</p>
            <h2>Sieć operacyjna</h2>
            <p className="muted">
              Zobacz poziom dostępności w każdej lokalizacji i wybierz priorytet.
            </p>
          </div>
          <div className="availability-legend">
            <span className="availability-pill high">Wysoka</span>
            <span className="availability-pill medium">Umiarkowana</span>
            <span className="availability-pill low">Niska</span>
          </div>
        </div>
        <div className="branch-overview-body">
          <div
            className="branch-map"
            ref={mapRef}
            style={
              {
                "--map-scale": MAP_SCALE,
                "--map-offset-x": MAP_OFFSET_X,
                "--map-offset-y": MAP_OFFSET_Y
              } as CSSProperties
            }
          >
            <div className="branch-map-veil" aria-hidden="true" />
            <img
              ref={mapImageRef}
              className="branch-map-svg"
              src={WORLD_MAP_URL}
              alt=""
              aria-hidden="true"
              onLoad={updateMapLayout}
            />
            {mapLayout ? (
              <svg
                className="branch-map-arrows"
                viewBox={`0 0 ${mapLayout.width} ${mapLayout.height}`}
                aria-hidden="true"
              >
                <defs>
                  <marker
                    id="branch-arrow"
                    markerWidth="10"
                    markerHeight="10"
                    refX="10"
                    refY="5"
                    orient="auto"
                    markerUnits="userSpaceOnUse"
                  >
                    <path d="M0,0 L10,5 L0,10 Z" fill="currentColor" />
                  </marker>
                </defs>
                {branchMarkers.map((summary) => (
                  <line
                    key={`${summary.branch}-arrow`}
                    className={`map-arrow ${summary.availabilityKey}`}
                    x1={summary.arrowStartX}
                    y1={summary.arrowStartY}
                    x2={summary.targetX}
                    y2={summary.targetY}
                    markerEnd="url(#branch-arrow)"
                  />
                ))}
              </svg>
            ) : null}
            {branchMarkers.map((summary) => {
              const style = {
                "--x": `${summary.labelX}px`,
                "--y": `${summary.labelY}px`
              } as CSSProperties;

              return (
                <button
                  key={summary.branch}
                  type="button"
                  className={`map-marker ${summary.availabilityKey} ${
                    selectedBranch === summary.branch ? "active" : ""
                  }`}
                  style={style}
                  onClick={() => {
                    setSelectedBranch(summary.branch);
                    setSelectedCity("all");
                  }}
                >
                  <span className="marker-dot" aria-hidden="true" />
                  <span className="marker-label">{summary.branch}</span>
                  <span className="marker-meta">{summary.availabilityLabel}</span>
                </button>
              );
            })}
          </div>
          <div className="branch-cards">
            {branchSummaries.map((summary) => (
              <article
                key={summary.branch}
                className={`branch-card ${summary.availabilityKey} ${
                  selectedBranch === summary.branch ? "selected" : ""
                }`}
              >
                <div className="branch-card-head">
                  <div>
                    <p className="eyebrow">Oddział</p>
                    <h3>{summary.branch}</h3>
                  </div>
                  <span className={`availability-pill ${summary.availabilityKey}`}>
                    {summary.availabilityLabel}
                  </span>
                </div>
                <p className="muted">{formatCityList(summary.cities)}</p>
                <div className="branch-card-stats">
                  <div>
                    <p className="muted small">Sale</p>
                    <p className="stat-strong">{summary.roomsCount}</p>
                  </div>
                  <div>
                    <p className="muted small">Wolne sloty</p>
                    <p className="stat-strong">
                      {summary.freeSlots}/{summary.totalSlots}
                    </p>
                  </div>
                </div>
                <div className="chip-row">
                  {summary.topRooms.map((room) => (
                    <span key={room} className="chip">
                      {room}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

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
