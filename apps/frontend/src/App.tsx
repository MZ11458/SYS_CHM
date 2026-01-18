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
      <div className="auth-screen">
        <LoginForm onAuth={handleAuth} />
        <div className="auth-aside" data-animate>
          <p className="eyebrow">Najpierw dostępność</p>
          <h2>Zaplanuj dzień pracy, zanim zrobi się tłoczno.</h2>
          <p className="muted">
            Sprawdź, co jest wolne, zarezerwuj slot i utrzymaj zespoły w
            synchronizacji bez maili w tę i z powrotem.
          </p>
          <div className="stat-grid">
            <div>
              <span className="stat">12</span>
              <span className="stat-label">Sale</span>
            </div>
            <div>
              <span className="stat">8</span>
              <span className="stat-label">Zestawy sprzętu</span>
            </div>
            <div>
              <span className="stat">3</span>
              <span className="stat-label">Lokalizacje</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const roleLabel = user.role === "admin" ? "Administrator" : "Użytkownik";

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Rezerwacje sal</p>
          <h1>Witaj, {user.fullName}</h1>
        </div>
        <div className="header-actions">
          <span className="pill">{roleLabel}</span>
          <button onClick={handleLogout} className="ghost-button">
            Wyloguj się
          </button>
        </div>
      </header>
      <nav className="app-nav">
        <button
          className={`nav-button ${view === "rooms" ? "active" : ""}`}
          onClick={() => setView("rooms")}
        >
          Sale
        </button>
        <button
          className={`nav-button ${view === "reservations" ? "active" : ""}`}
          onClick={() => setView("reservations")}
        >
          Moje rezerwacje
        </button>
        <button
          className={`nav-button ${view === "account" ? "active" : ""}`}
          onClick={() => setView("account")}
        >
          Moje konto
        </button>
        {user.role === "admin" ? (
          <button
            className={`nav-button ${view === "admin" ? "active" : ""}`}
            onClick={() => setView("admin")}
          >
            Panel admina
          </button>
        ) : null}
      </nav>
      <main className="dashboard">
        {view === "rooms" ? <RoomsCalendar token={token} /> : null}
        {view === "reservations" ? <ReservationsPanel token={token} /> : null}
        {view === "account" ? (
          <AccountPanel token={token} user={user} />
        ) : null}
        {view === "admin" ? <AdminPanel token={token} /> : null}
      </main>
    </div>
  );
}