import { useEffect, useRef, useState } from "react";

type HeaderTheme = "light" | "dark";

const NAV_LINKS = [
  { label: "Trade", href: "/trade" },
  { label: "Community", href: "/#community" },
  { label: "About", href: "/#about" },
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
          // Tăng chữ từ text-xs sm:text-sm -> text-sm sm:text-base và nới padding ngang sm:px-5
          className="group/nav relative inline-flex items-center gap-2 rounded-full px-3.5 py-2.5 font-sans text-sm font-semibold uppercase tracking-[0.08em] text-white transition-opacity duration-200 hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a7ebf2] motion-reduce:transition-none sm:px-5 sm:text-base"
        >
          {item.label}
          {item.isNew && (
            <span aria-hidden="true" className="size-2 rounded-full bg-[#a7ebf2]" />
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
  const idleText = "text-white";
  const border = "border-white/35";

  return (
    <div
      role="group"
      aria-label="Account access"
      // Tăng độ rộng nút từ sm:min-w-48 -> sm:min-w-56 và cỡ chữ lên text-sm sm:text-base
      className={`group/auth relative grid min-w-48 grid-cols-2 overflow-hidden rounded-full border ${border} bg-transparent p-1.5 font-sans text-sm font-semibold uppercase tracking-[0.06em] sm:min-w-56 sm:text-base`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-1.5 left-1.5 z-0 w-[calc(50%-0.375rem)] rounded-full border border-[#a7ebf2]/60 bg-[#a7ebf2] shadow-[0_2px_16px_rgba(167,235,242,0.18)] transition-transform duration-300 ease-out motion-reduce:transition-none ${
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
        className={`relative z-10 rounded-full px-4 py-2.5 text-center transition-[opacity,color,font-weight] duration-200 motion-reduce:transition-none hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a7ebf2] group-hover/auth:opacity-55 group-focus-within/auth:opacity-70 ${
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
        className={`relative z-10 rounded-full px-4 py-2.5 text-center transition-[opacity,color,font-weight] duration-200 motion-reduce:transition-none hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a7ebf2] group-hover/auth:opacity-55 group-focus-within/auth:opacity-70 ${
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
    <header ref={headerRef} className="fixed inset-x-0 top-0 z-50 bg-[#011c40]/75 px-4 backdrop-blur-md sm:px-8 lg:px-12">
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent ${theme === "light" ? "via-[#26658c]/30" : "via-[#a7ebf2]/35"} to-transparent`} />
      
      {/* Mở rộng từ max-w-6xl lên max-w-[1440px] để đẩy Logo sang trái và Auth sang phải */}
      <div className="mx-auto max-w-[1440px]">
        <div data-header-bar className="flex min-h-[92px] items-center justify-between gap-4 lg:gap-8">
          <a className="inline-flex shrink-0 items-center" href="/" aria-label="Market Forge home">
            {/* Tăng kích thước logo: h-12 sm:h-14 lg:h-16 */}
            <img
              className="h-12 w-auto object-contain sm:h-14 lg:h-16"
              src="/images/market-forge-logo-full.png"
              alt="Market Forge"
              width="1936"
              height="350"
            />
          </a>

          {/* Tăng khoảng cách giữa các mục menu: gap-1 xl:gap-3 */}
          <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex xl:gap-3">
            <NavigationLinks />
          </nav>

          <div className="hidden lg:block">
            <AuthLinks />
          </div>

          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full border border-white/35 bg-transparent font-sans text-xl text-white transition-transform duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a7ebf2] motion-reduce:transition-none lg:hidden"
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
          className={`${menuOpen ? "block" : "hidden"} border-t border-white/20 bg-[#011c40]/90 pb-4 pt-3 backdrop-blur-md lg:hidden`}
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