import { useEffect, useState } from "react";
import { api, ApiError, setCsrfToken } from "./api/client";
import type { User } from "./api/types";
import { ErrorBox, Loading } from "./components/Status";
import { AuthPage } from "./pages/AuthPage";
import { LobbyPage } from "./pages/LobbyPage";
import { RoomPage } from "./pages/RoomPage";
import { TrialPage } from "./pages/TrialPage";
import { navigate, parseHash, type Route } from "./lib/router";

export function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  const [user, setUser] = useState<User | null>();
  const [bootError, setBootError] = useState<ApiError>();

  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    api
      .me()
      .then((me) => {
        setCsrfToken(me.csrf_token);
        setUser(me.user);
      })
      .catch((e: ApiError) => (e.status === 401 ? setUser(null) : setBootError(e)));
  }, []);

  async function logout() {
    try {
      await api.logout();
    } finally {
      setCsrfToken("");
      setUser(null);
      navigate("/");
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          <strong>MARKET FORGE</strong> <span className="muted">The Trading Dojo</span>
        </a>
        <span className="tagline muted">Train the decision. Not just the trade.</span>
        {user && (
          <span className="topbar-user">
            {user.display_name} <span className="muted">@{user.username}</span>
            <button className="btn btn-ghost" onClick={logout}>Logout</button>
          </span>
        )}
      </header>
      <main className="content">
        {bootError ? (
          <ErrorBox error={bootError} onRetry={() => window.location.reload()} />
        ) : user === undefined ? (
          <Loading what="Checking session" />
        ) : user === null ? (
          <AuthPage onLogin={(u) => setUser(u)} />
        ) : route.name === "room" ? (
          <RoomPage roomId={route.id} />
        ) : route.name === "trial" ? (
          <TrialPage trialId={route.id} me={user} />
        ) : (
          <LobbyPage />
        )}
      </main>
      <footer className="footer muted">
        v0.1 Foundation · Practice only · All prices are SYNTHETIC — no real market data, no real trading.
      </footer>
    </div>
  );
}
