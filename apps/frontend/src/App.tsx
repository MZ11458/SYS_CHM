import { useEffect, useState } from "react";
import LoginForm from "./components/LoginForm";
import RoomsCalendar from "./components/RoomsCalendar";
import ReservationsPanel from "./components/ReservationsPanel";
import AdminPanel from "./components/AdminPanel";
import type { User } from "./types";

const STORAGE_KEY = "room-booking-auth";

type StoredAuth = {
  token: string;
  user: User;
};

type View = "rooms" | "reservations" | "admin";

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
          <p className="eyebrow">Availability first</p>
          <h2>Plan the workday before it gets busy.</h2>
          <p className="muted">
            See whats free, claim your slot, and keep every team in sync
            without the email back and forth.
          </p>
          <div className="stat-grid">
            <div>
              <span className="stat">12</span>
              <span className="stat-label">Rooms</span>
            </div>
            <div>
              <span className="stat">8</span>
              <span className="stat-label">Resource kits</span>
            </div>
            <div>
              <span className="stat">3</span>
              <span className="stat-label">Sites</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Room Booking</p>
          <h1>Welcome, {user.fullName}</h1>
        </div>
        <div className="header-actions">
          <span className="pill">{user.role}</span>
          <button onClick={handleLogout} className="ghost-button">
            Sign out
          </button>
        </div>
      </header>
      <nav className="app-nav">
        <button
          className={`nav-button ${view === "rooms" ? "active" : ""}`}
          onClick={() => setView("rooms")}
        >
          Rooms
        </button>
        <button
          className={`nav-button ${view === "reservations" ? "active" : ""}`}
          onClick={() => setView("reservations")}
        >
          My reservations
        </button>
        {user.role === "admin" ? (
          <button
            className={`nav-button ${view === "admin" ? "active" : ""}`}
            onClick={() => setView("admin")}
          >
            Admin
          </button>
        ) : null}
      </nav>
      <main className="dashboard">
        {view === "rooms" ? <RoomsCalendar token={token} /> : null}
        {view === "reservations" ? <ReservationsPanel token={token} /> : null}
        {view === "admin" ? <AdminPanel token={token} /> : null}
      </main>
    </div>
  );
}
