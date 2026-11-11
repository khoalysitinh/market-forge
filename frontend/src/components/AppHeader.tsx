import { useState } from "react";

const NAV_LINKS = [
  { label: "Product", href: "#/product" },
  { label: "Community", href: "#/community" },
  { label: "About", href: "#/about" },
  { label: "New", href: "#/new", isNew: true },
];

function NavigationLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {NAV_LINKS.map((item) => (
        <a
          key={item.label}
          href={item.href}
          onClick={onNavigate}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-base font-medium text-black transition-colors duration-150 hover:bg-slate-200 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26658c]"
        >
          {item.label}
          {item.isNew && (
            <span aria-hidden="true" className="size-1.5 rounded-full bg-[#26658c]" />
          )}
        </a>
      ))}
    </>
  );
}

function AuthLinks({ onNavigate }: { onNavigate?: () => void }) {
  const [selected, setSelected] = useState<"login" | "signup">("login");

  return (
    <div
      role="group"
      aria-label="Account access"
      className="group/auth relative isolate grid min-w-48 grid-cols-2 overflow-hidden rounded-xl border border-slate-400 bg-transparent p-1 font-mono text-sm tracking-wide"
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-1 left-1 z-0 w-[calc(50%-0.25rem)] rounded-lg border border-[#26658c]/30 bg-[#a7ebf2] shadow-[0_0_14px_rgba(38,101,140,0.15)] transition-transform duration-300 ease-out motion-reduce:transition-none ${
          selected === "signup" ? "translate-x-full" : "translate-x-0"
        }`}
      />
      <a
        href="#/login"
        aria-current={selected === "login" ? "page" : undefined}
        onClick={() => {
          setSelected("login");
          onNavigate?.();
        }}
        className={`relative z-10 rounded-lg px-4 py-2.5 text-center text-black transition-[opacity,color,font-weight] duration-200 motion-reduce:transition-none hover:font-semibold hover:text-black hover:opacity-100 focus-visible:font-semibold focus-visible:text-black focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26658c] group-hover/auth:opacity-50 group-focus-within/auth:opacity-70 ${
          selected === "login"
            ? "font-semibold opacity-100"
            : "font-medium opacity-60"
        }`}
      >
        Login
      </a>
      <a
        href="#/signup"
        aria-current={selected === "signup" ? "page" : undefined}
        onClick={() => {
          setSelected("signup");
          onNavigate?.();
        }}
        className={`relative z-10 rounded-lg px-4 py-2.5 text-center text-black transition-[opacity,color,font-weight] duration-200 motion-reduce:transition-none hover:font-semibold hover:text-black hover:opacity-100 focus-visible:font-semibold focus-visible:text-black focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26658c] group-hover/auth:opacity-50 group-focus-within/auth:opacity-70 ${
          selected === "signup"
            ? "font-semibold opacity-100"
            : "font-medium opacity-60"
        }`}
      >
        Sign Up
      </a>
    </div>
  );
}

export function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="relative border-b border-slate-300/70 bg-transparent px-4 sm:px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[#26658c]/45 to-transparent" />
      <div className="mx-auto max-w-6xl">
        <div className="flex min-h-[92px] items-center justify-between gap-3 lg:gap-6">
          <a className="inline-flex shrink-0 items-center gap-3" href="#/" aria-label="Market Forge home">
            <span className="grid size-12 shrink-0 place-items-center sm:size-14">
              <img
                className="size-10 object-contain sm:size-12"
                src="https://i.ibb.co/TDzWCTrr/Bi-u-t-ng-F-m-i-t-n-th-y-tinh-xanh-ng-c.png"
                alt=""
                width="48" height="48"
                aria-hidden="true"
              />
            </span>
            <span className="flex flex-col">
              <span className="bg-linear-to-r from-[#011c40] via-[#26658c] to-[#a7ebf2] bg-clip-text font-mono text-lg font-bold tracking-[0.16em] text-transparent sm:text-xl">MARKET FORGE</span>
            </span>
          </a>

          <nav aria-label="Main navigation" className="hidden items-center gap-1 border-x border-slate-300 px-3 lg:flex">
            <NavigationLinks />
          </nav>

          <div className="hidden lg:block">
            <AuthLinks />
          </div>

          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-400 bg-transparent font-mono text-black transition-colors hover:border-[#26658c] hover:text-[#26658c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26658c] lg:hidden"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true" className="text-xl leading-none">{menuOpen ? "×" : "☰"}</span>
          </button>
        </div>

        <div
          id="mobile-navigation"
          className={`${menuOpen ? "block" : "hidden"} border-t border-slate-300 pb-4 pt-3 lg:hidden`}
        >
          <nav aria-label="Mobile navigation" className="flex flex-col font-mono tracking-wide">
            <NavigationLinks onNavigate={closeMenu} />
          </nav>
          <div className="mt-3 border-t border-slate-300 pt-3">
            <AuthLinks onNavigate={closeMenu} />
          </div>
        </div>
      </div>
    </header>
  );
}
