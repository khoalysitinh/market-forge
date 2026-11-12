import { useState, type FormEvent } from "react";

const SOCIAL_LINKS = [
  { name: "X / Twitter", handle: "Follow the market notes", href: "#" },
  { name: "Discord", handle: "Practice with the community", href: "#" },
  { name: "GitHub", handle: "Explore the project", href: "https://github.com/khoalysitinh/market-forge" },
  { name: "Telegram", handle: "Get session updates", href: "#" },
];

export function AppFooter() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    setMessage("Thanks for your interest. Newsletter signup is coming soon; your email was not sent.");
  }

  return (
    <footer data-header-theme="dark" className="relative overflow-hidden border-t border-white/10 bg-[#011c40] px-5 pb-6 pt-14 text-slate-300 sm:px-8 sm:pt-16">
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-36 size-80 rounded-full bg-[#1b98e0]/10 blur-3xl" />
      <div className="relative mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-10 border-b border-white/10 pb-12 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-3">
            <a href="#/" aria-label="Market Forge home" className="inline-flex rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a7ebf2]">
              <img src="/images/market-forge-logo-white-text.png" alt="Market Forge" className="h-auto w-56 max-w-full object-contain sm:w-64" width="512" height="120" />
            </a>
            <p className="mt-5 max-w-xs text-sm leading-6 text-slate-400">A calmer place to practice market decisions, sharpen your process, and learn together.</p>
          </div>

          <div className="md:col-span-6">
            <p className="font-sans text-sm font-semibold uppercase tracking-[0.1em] text-white">Stay in the loop</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">Get occasional product notes and new practice ideas. No market noise, just useful updates.</p>
            <form onSubmit={handleSubmit} className="mt-5 flex max-w-lg flex-col gap-3 sm:flex-row">
              <input
                id="footer-email"
                aria-label="Email address"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => { setEmail(event.target.value); setMessage(""); }}
                placeholder="Your email address"
                className="min-h-12 min-w-0 flex-1 rounded-lg border border-white/15 bg-white/[0.06] px-4 font-sans text-sm text-white placeholder:text-slate-500 outline-none transition-colors focus:border-[#a7ebf2] focus:ring-2 focus:ring-[#a7ebf2]/20"
              />
              <button type="submit" className="min-h-12 rounded-lg bg-[#a7ebf2] px-6 font-sans text-sm font-bold uppercase tracking-[0.06em] text-[#011c40] transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a7ebf2] motion-reduce:transition-none">
                Send <span aria-hidden="true">→</span>
              </button>
            </form>
            <p aria-live="polite" className="mt-3 min-h-5 text-xs leading-5 text-slate-400">{message || "Newsletter signup is a preview and is not connected yet."}</p>
          </div>

          <div className="md:col-span-3">
            <p className="font-sans text-sm font-semibold uppercase tracking-[0.1em] text-white">Find your people</p>
            <ul className="mt-4 space-y-1">
              {SOCIAL_LINKS.map((social) => (
                <li key={social.name}>
                  {social.href === "#" ? (
                    <span className="flex items-center justify-between gap-3 rounded-md py-2 font-sans text-sm text-slate-400" title="Coming soon">
                      <span className="transition-colors">{social.name}</span>
                      <span className="font-mono text-[9px] uppercase tracking-wider text-slate-600">Soon</span>
                    </span>
                  ) : (
                    <a href={social.href} target="_blank" rel="noreferrer" aria-label={`${social.name}: ${social.handle}`} className="flex items-center justify-between gap-3 rounded-md py-2 font-sans text-sm text-slate-300 transition-colors hover:text-[#a7ebf2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a7ebf2]">
                      <span>{social.name}</span><span aria-hidden="true" className="text-[#a7ebf2]">↗</span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-5 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Market Forge. Built for better decisions.</p>
          <p className="max-w-xl leading-5 sm:text-right">Synthetic market data only · Not real NAS100 · Not financial advice</p>
        </div>
      </div>
    </footer>
  );
}
