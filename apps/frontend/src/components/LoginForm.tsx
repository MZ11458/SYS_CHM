import { useState } from "react";
import { login, register } from "../api";
import type { User } from "../types";

interface LoginFormProps {
  onAuth: (token: string, user: User) => void;
}

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
      setError(err?.message || "login_failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-card" data-animate>
      <div className="login-header">
        <p className="eyebrow">Planer biura</p>
        <h1>{isRegister ? "Utwórz konto" : "Witaj ponownie"}</h1>
        <p className="muted">
          Rezerwuj sale, sprzęt i strefy pracy w jednym wspólnym kalendarzu.
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
          {loading ? "Przetwarzanie..." : isRegister ? "Utwórz konto" : "Zaloguj się"}
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
            : "Nowy tutaj? Utwórz konto"}
        </button>
        <p className="note">Demo admina: admin@local.test / admin123</p>
      </div>
    </div>
  );
}