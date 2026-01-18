import { useState } from "react";
import { login, register } from "../api";
import type { User } from "../types";

interface LoginFormProps {
  onAuth: (token: string, user: User) => void;
}

const errorMessages: Record<string, string> = {
  missing_credentials: "Podaj adres email i hasło.",
  invalid_credentials: "Nieprawidłowy email lub hasło.",
  inactive_user: "Twoje konto jest zablokowane. Skontaktuj się z administratorem.",
  login_failed: "Nie udało się zalogować. Spróbuj ponownie.",
  missing_fields: "Uzupełnij wszystkie pola.",
  weak_password: "Hasło musi mieć co najmniej 8 znaków.",
  email_exists: "Konto z tym adresem już istnieje.",
  register_failed: "Nie udało się utworzyć konta.",
  request_failed: "Nie udało się połączyć z serwerem."
};

export default function LoginForm({ onAuth }: LoginFormProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = isRegister
        ? await register(email, password, fullName)
        : await login(email, password);
      onAuth(result.token, result.user);
    } catch (err: any) {
      const fallback = isRegister
        ? "Nie udało się utworzyć konta."
        : "Nie udało się zalogować.";
      setError(errorMessages[err?.message] || fallback);
    } finally {
      setLoading(false);
    }
  };

  const headline = isRegister ? "Utwórz konto" : "Zaloguj się do systemu";
  const submitLabel = isRegister ? "Utwórz konto" : "Zaloguj się";

  return (
    <div className="login-card" data-animate>
      <div className="login-header">
        <span className="login-badge">
          {isRegister ? "Rejestracja" : "Dostęp użytkownika"}
        </span>
        <h1>{headline}</h1>
        <p className="muted">
          Zarządzaj rezerwacjami sal i zasobów w jednym, spójnym panelu.
        </p>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        {isRegister ? (
          <label>
            Imię i nazwisko
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Ada Lovelace"
              required
            />
          </label>
        ) : null}

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ty@firma.pl"
            required
          />
        </label>

        <label>
          Hasło
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="********"
            required
          />
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" disabled={loading}>
          {loading ? "Przetwarzanie..." : submitLabel}
        </button>
      </form>

      <div className="login-footer">
        <button
          type="button"
          className="link-button"
          onClick={() => setIsRegister(!isRegister)}
        >
          {isRegister
            ? "Masz już konto? Zaloguj się"
            : "Nowy użytkownik? Utwórz konto"}
        </button>
        <p className="note">Demo admina: admin@local.test / admin123</p>
      </div>
    </div>
  );
}
