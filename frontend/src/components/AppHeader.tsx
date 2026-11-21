import { useEffect, useRef, useState } from "react";

type HeaderTheme = "light" | "dark";

const NAV_LINKS = [
  { label: "Trade", href: "/trade" },
  { label: "Community", href: "/#community" },
  { label: "About", href: "/about" },
  { label: "New", href: "/#how-it-works", isNew: true },
];

function NavigationLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {NAV_LINKS.map((item) => (
        <a
          key={item.label}
          href={item.href}
          onClick={onNavigate}
          className="group/nav relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-2 font-sans text-xs font-semibold uppercase tracking-[0.08em] text-forge-ice transition-opacity duration-200 hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forge-coral motion-reduce:transition-none sm:px-3 sm:text-sm"
        >
          {item.label}
          {item.isNew && (
            <span aria-hidden="true" className="size-2 rounded-full bg-forge-coral" />
          )}
          <span
            aria-hidden="true"
            className="absolute inset-x-5 bottom-1.5 h-px origin-left scale-x-0 bg-current transition-transform duration-200 group-hover/nav:scale-x-100 motion-reduce:transition-none"
          />
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
      className="inline-flex items-center select-none font-sans"
    >
      <a
        href="#/login"
        aria-current={selected === "login" ? "page" : undefined}
        onClick={() => {
          setSelected("login");
          onNavigate?.();
        }}
        style={{
          clipPath: "polygon(8px 0, 100% 0, calc(100% - 16px) 55%, calc(100% - 6px) 55%, calc(100% - 22px) 100%, 0 100%, 0 8px)",
        }}
        className={`relative z-10 inline-flex h-9 items-center pl-4 pr-7 text-[10px] font-black uppercase tracking-[0.08em] transition-[filter,opacity,transform] duration-200 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forge-ice motion-reduce:transition-none bg-linear-to-r from-[#059669] via-[#10B981] to-[#6EE7B7] text-[#042F2E] sm:text-[11px] ${
          selected === "login" ? "opacity-100 shadow-[0_0_16px_rgba(16,185,129,0.3)]" : "opacity-75"
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
        style={{
          clipPath: "polygon(22px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 16px 45%, 6px 45%)",
          marginLeft: "-17px",
        }}
        className={`relative z-20 inline-flex h-9 items-center gap-1.5 pl-7 pr-4 text-[10px] font-black uppercase tracking-[0.08em] transition-[filter,opacity,transform] duration-200 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forge-coral motion-reduce:transition-none bg-linear-to-r from-[#F43F5E] via-[#EF4444] to-[#F97316] text-white sm:text-[11px] ${
          selected === "signup" ? "opacity-100 shadow-[0_0_16px_rgba(244,63,94,0.3)]" : "opacity-75"
        }`}
      >
        Sign Up
      </a>
    </div>
  );
}

export function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<HeaderTheme>("dark");
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let frame = 0;

    function syncThemeToSurface() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const header = headerRef.current;
        const headerBar = header?.querySelector<HTMLElement>("[data-header-bar]");
        const headerBottom = headerBar?.getBoundingClientRect().bottom ?? 92;
        const y = Math.min(Math.ceil(headerBottom + 2), window.innerHeight - 1);
        const previousVisibility = header?.style.visibility;
        if (header) header.style.visibility = "hidden";
        const underHeader = document.elementFromPoint(Math.floor(window.innerWidth / 2), y);
        if (header) header.style.visibility = previousVisibility ?? "";
        const surface = underHeader?.closest<HTMLElement>("[data-header-theme]");
        const nextTheme = surface?.dataset.headerTheme;

        if (nextTheme === "light" || nextTheme === "dark") {
          setTheme((current) => (current === nextTheme ? current : nextTheme));
        }
      });
    }

    syncThemeToSurface();
    window.addEventListener("scroll", syncThemeToSurface, { passive: true });
    window.addEventListener("resize", syncThemeToSurface);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", syncThemeToSurface);
      window.removeEventListener("resize", syncThemeToSurface);
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header ref={headerRef} className="fixed inset-x-0 top-0 z-50 bg-[#0A0A0A]/85 px-3 backdrop-blur-md sm:px-6 lg:px-8">
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent ${theme === "light" ? "via-forge-coral/50" : "via-forge-ice/45"} to-transparent`} />
      
      <div className="mx-auto max-w-[1600px]">
        <div data-header-bar className="flex min-h-[62px] items-center justify-between gap-3 sm:min-h-[66px] lg:gap-5">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <a className="inline-flex shrink-0 items-center" href="/" aria-label="Market Forge home">
              <img
                className="h-8 w-auto object-contain sm:h-9 lg:h-10"
                src="/images/market-forge-logo-full.png"
                alt="Market Forge"
                width="1936"
                height="350"
              />
            </a>

            <span aria-hidden="true" className="hidden h-6 w-px shrink-0 bg-forge-ice/35 lg:block" />
            <nav aria-label="Main navigation" className="hidden items-center gap-0.5 lg:flex xl:gap-1">
              <NavigationLinks />
            </nav>
          </div>

          <div className="hidden shrink-0 lg:block">
            <AuthLinks />
          </div>

          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full border border-forge-ice/35 bg-transparent font-sans text-xl text-forge-ice transition-transform duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forge-coral motion-reduce:transition-none lg:hidden"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true" className="leading-none">{menuOpen ? "×" : "☰"}</span>
          </button>
        </div>

        <div
          id="mobile-navigation"
          className={`${menuOpen ? "block" : "hidden"} border-t border-forge-ice/20 bg-forge-navy/95 pb-4 pt-3 backdrop-blur-md lg:hidden`}
        >
          <nav aria-label="Mobile navigation" className="flex flex-col items-start">
            <NavigationLinks onNavigate={closeMenu} />
          </nav>
          <div className="mt-3 border-t border-white/20 pt-3">
            <AuthLinks onNavigate={closeMenu} />
          </div>
        </div>
      </div>
    </header>
  );
}
