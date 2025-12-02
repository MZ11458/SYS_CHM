import { useEffect, useState } from "react";
import LoginForm from "./components/LoginForm";
import type { User } from "./types";

const STORAGE_KEY = "room-booking-auth";

type StoredAuth = {
  token: string;
  user: User;
};

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

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
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: nextToken, user: nextUser })
    );
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
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
      <main className="dashboard">
        <section className="card" data-animate>
          <h2>Next up</h2>
          <p className="muted">
            Calendar, reservations, and admin insights appear in the next
            milestones.
          </p>
        </section>
        <section className="card highlight" data-animate>
          <h2>Your spaces</h2>
          <p className="muted">
            Track meeting rooms, projectors, and focus booths across the office.
          </p>
        </section>
      </main>
    </div>
  );
}
