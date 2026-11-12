import { useEffect, useState } from "react";
import { AppFooter } from "./components/AppFooter";
import { AppHeader } from "./components/AppHeader";
import { AuthPage } from "./pages/AuthPage";
import { LandingPage } from "./pages/LandingPage";
import { TradePage } from "./pages/TradePage";

type Route = "home" | "trade" | "login" | "signup";

function getRoute(): Route {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (window.location.hash === "#/login") return "login";
  if (window.location.hash === "#/signup") return "signup";
  if (path === "/trade") return "trade";
  if (path === "/login") return "login";
  if (path === "/signup") return "signup";
  return "home";
}

export function App() {
  const [route, setRoute] = useState<Route>(getRoute);

  useEffect(() => {
    const syncRoute = () => setRoute(getRoute());
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    return () => {
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);

  const isTradeRoute = route === "trade";
  const isAuthRoute = route === "login" || route === "signup";

  return (
    <div className={`flex flex-col font-sans antialiased ${isTradeRoute ? "h-dvh overflow-hidden bg-luna-950 text-text-primary" : isAuthRoute ? "min-h-screen bg-[#00050d] text-white" : "min-h-screen bg-slate-100 text-slate-900"}`}>
      {!isTradeRoute && !isAuthRoute && <AppHeader />}
      <main className={`flex-1 ${isTradeRoute ? "min-h-0" : ""}`}>
        {isTradeRoute ? <TradePage /> : route === "login" || route === "signup" ? <AuthPage key={route} mode={route} /> : <LandingPage />}
      </main>
      {!isTradeRoute && !isAuthRoute && <AppFooter />}
    </div>
  );
}
