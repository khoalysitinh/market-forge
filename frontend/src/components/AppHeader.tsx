import { useEffect, useRef, useState } from "react";

type HeaderTheme = "light" | "dark";

const NAV_LINKS = [
  { label: "Product", href: "#product" },
  { label: "Community", href: "#community" },
  { label: "About", href: "#about" },
  { label: "New", href: "#how-it-works", isNew: true },
];

function NavigationLinks({ onNavigate, theme }: { onNavigate?: () => void; theme: HeaderTheme }) {
  const textColor = theme === "light" ? "text-[#011c40]" : "text-white";
  const focusColor = theme === "light" ? "focus-visible:outline-[#26658c]" : "focus-visible:outline-[#a7ebf2]";

  return (
    <>
      {NAV_LINKS.map((item) => (
        <a
          key={item.label}
          href={item.href}
          onClick={onNavigate}
          className={`group/nav relative inline-flex items-center gap-2 rounded-full px-3 py-2.5 font-sans text-xs font-semibold uppercase tracking-[0.08em] ${textColor} transition-opacity duration-200 hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 ${focusColor} motion-reduce:transition-none sm:px-4 sm:text-sm`}
        >
          {item.label}
          {item.isNew && (
            <span aria-hidden="true" className="size-1.5 rounded-full bg-[#a7ebf2]" />
          )}
          <span
            aria-hidden="true"
            className="absolute inset-x-4 bottom-1 h-px origin-left scale-x-0 bg-current transition-transform duration-200 group-hover/nav:scale-x-100 motion-reduce:transition-none"
          />
        </a>
      ))}
    </>
  );
}

function AuthLinks({ onNavigate, theme }: { onNavigate?: () => void; theme: HeaderTheme }) {
  const [selected, setSelected] = useState<"login" | "signup">("login");
  const idleText = theme === "light" ? "text-[#011c40]" : "text-white";
  const border = theme === "light" ? "border-[#011c40]/30" : "border-white/35";
  const focusOutline = theme === "light" ? "focus-visible:outline-[#26658c]" : "focus-visible:outline-[#a7ebf2]";

  return (
    <div
      role="group"
      aria-label="Account access"
      className={`group/auth relative grid min-w-44 grid-cols-2 overflow-hidden rounded-full border ${border} bg-transparent p-1 font-sans text-xs font-semibold uppercase tracking-[0.06em] sm:min-w-48 sm:text-sm`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-1 left-1 z-0 w-[calc(50%-0.25rem)] rounded-full border border-[#a7ebf2]/60 bg-[#a7ebf2] shadow-[0_2px_16px_rgba(167,235,242,0.18)] transition-transform duration-300 ease-out motion-reduce:transition-none ${
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
        className={`relative z-10 rounded-full px-3 py-2.5 text-center transition-[opacity,color,font-weight] duration-200 motion-reduce:transition-none hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 ${focusOutline} group-hover/auth:opacity-55 group-focus-within/auth:opacity-70 ${
          selected === "login"
            ? "font-bold text-[#011c40] opacity-100"
            : `font-semibold ${idleText} opacity-80`
        }`}
      >
        Log In
      </a>
      <a
        href="#/signup"
        aria-current={selected === "signup" ? "page" : undefined}
        onClick={() => {
          setSelected("signup");
          onNavigate?.();
        }}
        className={`relative z-10 rounded-full px-3 py-2.5 text-center transition-[opacity,color,font-weight] duration-200 motion-reduce:transition-none hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 ${focusOutline} group-hover/auth:opacity-55 group-focus-within/auth:opacity-70 ${
          selected === "signup"
            ? "font-bold text-[#011c40] opacity-100"
            : `font-semibold ${idleText} opacity-80`
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
        const headerBottom = headerBar?.getBoundingClientRect().bottom ?? 84;
        const y = Math.min(Math.ceil(headerBottom + 2), window.innerHeight - 1);
        // The expanded mobile menu sits at this point and would hide the section
        // underneath from elementFromPoint. Hide it from hit-testing for this
        // synchronous read, then restore it before the browser paints.
        const previousVisibility = header?.style.visibility;
        if (header) header.style.visibility = "hidden";
        const underHeader = document.elementFromPoint(Math.floor(window.innerWidth / 2), y);
        if (header) header.style.visibility = previousVisibility ?? "";
        const surface = underHeader?.closest<HTMLElement>("[data-header-theme]");
        const nextTheme = surface?.dataset.headerTheme;

        if (nextTheme === "light" || nextTheme === "dark") {
          setTheme((current) => current === nextTheme ? current : nextTheme);
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
    <header ref={headerRef} className="fixed inset-x-0 top-0 z-50 bg-transparent px-4 backdrop-blur-[2px] sm:px-6">
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent ${theme === "light" ? "via-[#26658c]/30" : "via-[#a7ebf2]/35"} to-transparent`} />
      <div className="mx-auto max-w-6xl">
        <div data-header-bar className="flex min-h-[84px] items-center justify-between gap-3 lg:gap-6">
          <a className="inline-flex shrink-0 items-center gap-3" href="#/" aria-label="Market Forge home">
            <img
              className="size-10 object-contain sm:size-12"
              src="https://i.ibb.co/TDzWCTrr/Bi-u-t-ng-F-m-i-t-n-th-y-tinh-xanh-ng-c.png"
              alt=""
              width="48"
              height="48"
              aria-hidden="true"
            />
            <span className={`font-sans text-lg font-semibold tracking-[-0.04em] transition-colors duration-200 motion-reduce:transition-none sm:text-xl ${theme === "light" ? "text-[#011c40]" : "text-white"}`}>
              MARKET FORGE
            </span>
          </a>

          <nav aria-label="Main navigation" className="hidden items-center gap-0.5 lg:flex">
            <NavigationLinks theme={theme} />
          </nav>

          <div className="hidden lg:block">
            <AuthLinks theme={theme} />
          </div>

          <button
            type="button"
            className={`inline-flex size-10 items-center justify-center rounded-full border bg-transparent font-sans text-xl transition-transform duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 motion-reduce:transition-none lg:hidden ${theme === "light" ? "border-[#011c40]/30 text-[#011c40] focus-visible:outline-[#26658c]" : "border-white/35 text-white focus-visible:outline-[#a7ebf2]"}`}
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
          className={`${menuOpen ? "block" : "hidden"} border-t pb-4 pt-3 backdrop-blur-md lg:hidden ${theme === "light" ? "border-[#011c40]/20" : "border-white/25"}`}
        >
          <nav aria-label="Mobile navigation" className="flex flex-col items-start">
            <NavigationLinks onNavigate={closeMenu} theme={theme} />
          </nav>
          <div className={`mt-3 border-t pt-3 ${theme === "light" ? "border-[#011c40]/20" : "border-white/20"}`}>
            <AuthLinks onNavigate={closeMenu} theme={theme} />
          </div>
        </div>
      </div>
    </header>
  );
}
