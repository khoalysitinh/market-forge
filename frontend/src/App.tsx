import { AppFooter } from "./components/AppFooter";
import { AppHeader } from "./components/AppHeader";
import { LandingPage } from "./pages/LandingPage";

export function App() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100 font-sans text-slate-900 antialiased">
      <AppHeader />
      <main className="flex-1">
        <LandingPage />
      </main>
      <AppFooter />
    </div>
  );
}
