import { useEffect, useState } from "react";
import LoginForm from "./components/LoginForm";
import RoomsCalendar from "./components/RoomsCalendar";
import ReservationsPanel from "./components/ReservationsPanel";
import AdminPanel from "./components/AdminPanel";
import AccountPanel from "./components/AccountPanel";
import type { User } from "./types";

const STORAGE_KEY = "room-booking-auth";

type StoredAuth = {
  token: string;
  user: User;
};

type View = "rooms" | "reservations" | "account" | "admin";

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("rooms");

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
    localStorage.removeItem(STORAGE_KEY);
  };

  if (!token || !user) {
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
              <span className="status-value ok">Stabilny</span>
            </div>
            <div className="status-card">
              <span className="status-label">Synchronizacja globalna</span>
              <span className="status-value">Aktywna</span>
            </div>
          </div>
        </aside>
        <LoginForm onAuth={handleAuth} />
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
            <button onClick={handleLogout} className="ghost-button">
              Wyloguj się
            </button>
          </div>
        </header>
        <main className="dashboard">
          {view === "rooms" ? <RoomsCalendar token={token} /> : null}
          {view === "reservations" ? <ReservationsPanel token={token} /> : null}
          {view === "account" ? (
            <AccountPanel token={token} user={user} />
          ) : null}
          {view === "admin" ? <AdminPanel token={token} /> : null}
        </main>
      </div>
    </div>
  );
}