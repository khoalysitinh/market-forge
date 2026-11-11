import { AppFooter } from "./components/AppFooter";
import { AppHeader } from "./components/AppHeader";
import { PagePlaceholder } from "./components/PagePlaceholder";

export function App() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100 font-sans text-slate-900 antialiased">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-12">
        <PagePlaceholder
          title="Market Forge"
          description="React application scaffold. Feature pages can be added here."
        />
      </main>
      <AppFooter />
    </div>
  );
}
