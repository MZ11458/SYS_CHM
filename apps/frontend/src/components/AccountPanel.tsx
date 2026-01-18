import { useState } from "react";
import { changePassword } from "../api";
import type { User } from "../types";

interface AccountPanelProps {
  token: string;
  user: User;
}

const errorMessages: Record<string, string> = {
  missing_fields: "Uzupełnij wszystkie pola.",
  weak_password: "Nowe hasło musi mieć co najmniej 8 znaków.",
  invalid_password: "Obecne hasło jest nieprawidłowe.",
  inactive_user: "Twoje konto jest zablokowane.",
  user_not_found: "Nie znaleziono użytkownika.",
  auth_lookup_failed: "Nie udało się zweryfikować użytkownika.",
  change_password_failed: "Nie udało się zmienić hasła.",
  request_failed: "Nie udało się zmienić hasła."
};

export default function AccountPanel({ token, user }: AccountPanelProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const roleLabel = user.role === "admin" ? "Administrator" : "Użytkownik";
  const statusLabel = user.isActive === false ? "Zablokowane" : "Aktywne";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Uzupełnij wszystkie pola.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Nowe hasło musi mieć co najmniej 8 znaków.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Nowe hasła nie są zgodne.");
      return;
    }

    setLoading(true);

    try {
      await changePassword(token, currentPassword, newPassword);
      setSuccess("Hasło zostało zmienione.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      const message = errorMessages[err?.message] || "Nie udało się zmienić hasła.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(null);
  };

  return (
    <section className="card" data-animate>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Moje konto</p>
          <h2>Dane i bezpieczeństwo</h2>
        </div>
      </div>

      <div className="account-grid">
        <div className="account-card">
          <p className="muted">Użytkownik</p>
          <h3>{user.fullName}</h3>
        </div>
        <div className="account-card">
          <p className="muted">Email</p>
          <h3>{user.email}</h3>
        </div>
        <div className="account-card">
          <p className="muted">Rola</p>
          <h3>{roleLabel}</h3>
        </div>
        <div className="account-card">
          <p className="muted">Status</p>
          <h3>{statusLabel}</h3>
        </div>
      </div>

      <div className="account-form">
        <p className="eyebrow">Zmiana hasła</p>
        <form onSubmit={handleSubmit}>
          <div className="account-fields">
            <label>
              Obecne hasło
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="********"
                required
              />
            </label>
            <label>
              Nowe hasło
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Minimum 8 znaków"
                required
              />
            </label>
            <label>
              Powtórz nowe hasło
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Powtórz nowe hasło"
                required
              />
            </label>
          </div>

          <p className="note">Hasło powinno mieć minimum 8 znaków.</p>
          {error ? <p className="error">{error}</p> : null}
          {success ? <p className="success">{success}</p> : null}

          <div className="account-actions">
            <button type="submit" disabled={loading}>
              {loading ? "Zmieniam..." : "Zmień hasło"}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={handleClear}
              disabled={loading}
            >
              Wyczyść
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
