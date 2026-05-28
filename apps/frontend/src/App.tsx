import { useEffect, useState } from "react";
import { fetchHealth, fetchReservations } from "./api";
import LoginForm from "./components/LoginForm";
import RoomsCalendar from "./components/RoomsCalendar";
import ReservationsPanel from "./components/ReservationsPanel";
import AdminPanel from "./components/AdminPanel";
import AccountPanel from "./components/AccountPanel";
import NotificationsPanel from "./components/NotificationsPanel";
import ToastStack from "./components/ToastStack";
import type {
  Alert,
  NotifyPayload,
  Reminder,
  StatusLevel,
  StatusUpdate,
  SystemStatus
} from "./notifications";
import type { User, UserReservation } from "./types";

const STORAGE_KEY = "room-booking-auth";
const MAX_ALERTS = 6;
const MAX_TOASTS = 3;
const TOAST_DURATION_MS = 6500;
const HEALTH_POLL_MS = 15000;

type StoredAuth = {
  token: string;
  user: User;
};

type View = "rooms" | "reservations" | "account" | "admin";

const systemStatusLabels: Record<StatusLevel, string> = {
  ok: "Stabilny",
  warning: "Ostrzeżenie",
  down: "Niedostępny"
};

const createAlertId = () =>
  `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const buildReminders = (reservations: UserReservation[]): Reminder[] => {
  const now = Date.now();
  return reservations
    .filter(
      (reservation) =>
        reservation.status === "active" &&
        new Date(reservation.startTime).getTime() > now
    )
    .sort(
      (left, right) =>
        new Date(left.startTime).getTime() -
        new Date(right.startTime).getTime()
    )
    .slice(0, 3)
    .map((reservation) => ({
      id: reservation.id,
      title: reservation.roomName,
      location: reservation.roomLocation,
      startTime: reservation.startTime
    }));
};

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("rooms");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [toasts, setToasts] = useState<Alert[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(true);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>(() => ({
    api: navigator.onLine ? "ok" : "down",
    updatedAt: Date.now()
  }));

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as StoredAuth;
      setToken(parsed.token);
      setUser(parsed.user);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => updateStatus({ api: "ok" });
    const handleOffline = () => updateStatus({ api: "down" });

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (token) {
      refreshReminders();
    }
  }, [token]);

  const updateStatus = (update: StatusUpdate) => {
    if (Object.keys(update).length === 0) {
      return;
    }

    setSystemStatus((prev) => ({
      ...prev,
      ...update,
      updatedAt: Date.now()
    }));
  };

  useEffect(() => {
    let active = true;

    const pollHealth = async () => {
      try {
        const result = await fetchHealth();
        if (!active) {
          return;
        }
        updateStatus({
          api: result.api === "ok" ? "ok" : "down"
        });
      } catch {
        if (!active) {
          return;
        }
        updateStatus({
          api: "down"
        });
      }
    };

    pollHealth();
    const timer = window.setInterval(pollHealth, HEALTH_POLL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const handleOpenNotifications = () => {
    setNotificationsOpen(true);
    const target = document.getElementById("notifications-center");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleToggleNotifications = () => {
    setNotificationsOpen((prev) => !prev);
  };

  const addToast = (alert: Alert) => {
    setToasts((prev) => [alert, ...prev].slice(0, MAX_TOASTS));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== alert.id));
    }, TOAST_DURATION_MS);
  };

  const notify = (payload: NotifyPayload) => {
    const alert: Alert = {
      id: createAlertId(),
      title: payload.title,
      message: payload.message,
      tone: payload.tone,
      createdAt: Date.now()
    };

    setAlerts((prev) => [alert, ...prev].slice(0, MAX_ALERTS));
    addToast(alert);

    if (payload.status) {
      updateStatus(payload.status);
    }
  };

  const refreshReminders = async () => {
    if (!token) {
      return;
    }

    try {
      const result = await fetchReservations(token);
      setReminders(buildReminders(result.reservations));
      updateStatus({ api: "ok" });
    } catch {
      updateStatus({ api: "warning" });
    }
  };

  const handleRemindersUpdate = (reservations: UserReservation[]) => {
    setReminders(buildReminders(reservations));
  };

  const handleDismissAlert = (alertId: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
    setToasts((prev) => prev.filter((toast) => toast.id !== alertId));
  };

  const handleDismissToast = (toastId: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== toastId));
  };

  const handleClearAlerts = () => {
    setAlerts([]);
    setToasts([]);
  };

  const handleAuth = (nextToken: string, nextUser: User) => {
    setToken(nextToken);
    setUser(nextUser);
    setView("rooms");
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: nextToken, user: nextUser })
    );
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setView("rooms");
    setAlerts([]);
    setToasts([]);
    setReminders([]);
    setNotificationsOpen(true);
    localStorage.removeItem(STORAGE_KEY);
  };

  if (!token || !user) {
    const systemLabel = systemStatusLabels[systemStatus.api];

    return (
      <div className="auth-shell">
        <aside className="auth-visual" data-animate>
          <div className="brand-row">
            <span className="brand-mark">SYS</span>
            <div>
              <p className="eyebrow">Rezerwacje zasobów</p>
              <h1>Centrum operacyjne</h1>
            </div>
          </div>
          <p className="muted">
            Planowanie sal, sprzętu i stref pracy w jednym miejscu. Sprawdź
            dostępność, blokuj sloty i utrzymuj rytm zespołów bez zbędnych maili.
          </p>
          <div className="auth-kpis">
            <div className="kpi-card">
              <span className="kpi-value">12</span>
              <span className="kpi-label">Sale</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-value">8</span>
              <span className="kpi-label">Zestawy sprzętu</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-value">3</span>
              <span className="kpi-label">Lokalizacje</span>
            </div>
          </div>
          <div className="auth-status">
            <div className="status-card">
              <span className="status-label">System</span>
              <span className={`status-value ${systemStatus.api}`}>
                {systemLabel}
              </span>
            </div>
            <div className="status-card">
              <span className="status-label">Dane aplikacji</span>
              <span className={`status-value ${systemStatus.api}`}>
                {systemLabel}
              </span>
            </div>
          </div>
        </aside>
        <LoginForm onAuth={handleAuth} onNotify={notify} />
        <ToastStack
          toasts={toasts}
          openLabel="Otwórz centrum"
          dismissLabel="Schowaj"
          onDismissToast={handleDismissToast}
          onOpenNotifications={handleOpenNotifications}
        />
      </div>
    );
  }

  const roleLabel = user.role === "admin" ? "Administrator" : "Użytkownik";
  const todayLabel = new Date().toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  return (
    <div className="app-shell">
      <aside className="app-rail">
        <div className="rail-brand">
          <span className="brand-mark">SYS</span>
          <div>
            <p className="rail-title">Planer zasobów</p>
            <p className="rail-subtitle">Centrum rezerwacji</p>
          </div>
        </div>
        <nav className="rail-nav">
          <button
            className={`rail-link ${view === "rooms" ? "active" : ""}`}
            onClick={() => setView("rooms")}
          >
            <span className="rail-index">01</span>
            <span className="rail-text">Sale i zasoby</span>
          </button>
          <button
            className={`rail-link ${view === "reservations" ? "active" : ""}`}
            onClick={() => setView("reservations")}
          >
            <span className="rail-index">02</span>
            <span className="rail-text">Moje rezerwacje</span>
          </button>
          <button
            className={`rail-link ${view === "account" ? "active" : ""}`}
            onClick={() => setView("account")}
          >
            <span className="rail-index">03</span>
            <span className="rail-text">Moje konto</span>
          </button>
          {user.role === "admin" ? (
            <button
              className={`rail-link ${view === "admin" ? "active" : ""}`}
              onClick={() => setView("admin")}
            >
              <span className="rail-index">04</span>
              <span className="rail-text">Panel admina</span>
            </button>
          ) : null}
        </nav>
        <div className="rail-footer">
          <p className="muted small">Zalogowany jako</p>
          <p className="rail-user">{user.fullName}</p>
          <span className="pill">{roleLabel}</span>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div>
            <p className="eyebrow">Operacje dzienne</p>
            <h1>Witaj, {user.fullName}</h1>
            <p className="muted">Dzisiaj: {todayLabel}</p>
          </div>
          <div className="topbar-actions">
            <div className="status-chip">
              <span className="status-dot" />
              <span>{roleLabel}</span>
            </div>
            <button className="notification-chip" onClick={handleOpenNotifications}>
              <span>Alerty</span>
              <span className="notification-count">{alerts.length}</span>
            </button>
            <button onClick={handleLogout} className="ghost-button">
              Wyloguj się
            </button>
          </div>
        </header>
        <main className="dashboard">
          <div className="dashboard-main">
            {view === "rooms" ? (
              <RoomsCalendar
                token={token}
                onNotify={notify}
                onStatusUpdate={updateStatus}
                onRemindersRefresh={refreshReminders}
              />
            ) : null}
            {view === "reservations" ? (
              <ReservationsPanel
                token={token}
                onNotify={notify}
                onStatusUpdate={updateStatus}
                onRemindersUpdate={handleRemindersUpdate}
              />
            ) : null}
            {view === "account" ? (
              <AccountPanel
                token={token}
                user={user}
                onNotify={notify}
                onStatusUpdate={updateStatus}
              />
            ) : null}
            {view === "admin" ? (
              <AdminPanel
                token={token}
                onNotify={notify}
                onStatusUpdate={updateStatus}
              />
            ) : null}
          </div>
          <NotificationsPanel
            alerts={alerts}
            reminders={reminders}
            systemStatus={systemStatus}
            isOpen={notificationsOpen}
            onToggle={handleToggleNotifications}
            onDismissAlert={handleDismissAlert}
            onClearAlerts={handleClearAlerts}
            onRefresh={refreshReminders}
          />
        </main>
      </div>
      <ToastStack
        toasts={toasts}
        openLabel="Otwórz centrum"
        dismissLabel="Schowaj"
        onDismissToast={handleDismissToast}
        onOpenNotifications={handleOpenNotifications}
      />
    </div>
  );
}
