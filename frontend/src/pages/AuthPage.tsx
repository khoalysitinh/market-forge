import { useState, type FormEvent } from "react";
import { api, ApiError, setCsrfToken } from "../api/client";
import type { User } from "../api/types";
import { ErrorBox } from "../components/Status";

export function AuthPage({ onLogin }: { onLogin: (u: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      if (mode === "register") await api.register(username, password, displayName);
      const me = await api.login(username, password);
      setCsrfToken(me.csrf_token);
      onLogin(me.user);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card auth">
      <div className="tabs">
        <button className={mode === "login" ? "tab active" : "tab"} onClick={() => setMode("login")}>Login</button>
        <button className={mode === "register" ? "tab active" : "tab"} onClick={() => setMode("register")}>Register</button>
      </div>
      <form onSubmit={submit} className="form">
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username"
            required minLength={3} maxLength={32} pattern="[A-Za-z0-9_]+" />
        </label>
        {mode === "register" && (
          <label>
            Display name
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={64} />
          </label>
        )}
        <label>
          Password {mode === "register" && <span className="muted">(min 10 characters)</span>}
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 10 : 1} />
        </label>
        <ErrorBox error={error} />
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Login" : "Create account"}
        </button>
      </form>
    </section>
  );
}
