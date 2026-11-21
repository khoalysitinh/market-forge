---
name: market-forge-frontend
description: Project-specific frontend engineering skill for Market Forge (The Trading Dojo). Use when building, editing, refactoring, or auditing any file in frontend/ (React 19, Vite 8, TypeScript 6 strict, Tailwind CSS v4, Vitest, custom routing, and Go /api/v1 integration).
---

# Market Forge Frontend Skill

Project-specific rules, architecture, design tokens, and product invariants for `frontend/`. Always apply this skill alongside `vercel-react-best-practices`, `vercel-composition-patterns`, `frontend-design`, `web-design-guidelines`, `vite`, and `vitest`.

## 1. Stack & Dependency Discipline

- **Runtime & Tooling:** React 19.3, TypeScript 6 (`strict: true`, `noUncheckedIndexedAccess: true`), Vite 8 (dev port `5180`, proxy `/api` -> `http://127.0.0.1:8080`), Tailwind CSS v4 (`@tailwindcss/vite`, CSS-first `@import "tailwindcss";` and `@theme` in `src/styles.css`), Vitest 5.
- **No unapproved dependencies:** Do NOT install `react-router-dom`, `lucide-react`, `axios`, `zustand`, `shadcn/ui`, or any chart/UI library unless an ADR in `docs/adr/` explicitly approves it.
  - Icons: use inline `<svg>` `Icon` helpers matching `TradePage.tsx` / `CommunityPage.tsx`.
  - Routing: extend the custom `pathname` / `hash` router in `src/App.tsx` (or `src/lib/router.ts`).
  - HTTP: use `request()` from `src/api/client.ts` with `credentials: "same-origin"`.
- **No `tailwind.config.js`:** All theme tokens live in `src/styles.css` under `@theme`.

## 2. Design System & Aesthetic

Maintain Market Forge's 4-color visual identity:

- **Core 4-Tone Palette:**
  - Dark / Base Surface: `#0A0A0A` (`tech-dark`, `hero-black`, `forge-navy`)
  - Primary Accent / Action / Long: `#007BA7` (`tech-blue`, `hero-blue`, `trade-long`)
  - Secondary Accent / Alert / Short: `#FF2D95` (`tech-pink`, `hero-pink`, `forge-coral`, `trade-short`)
  - Ice / Foreground Text: `#DBF2FC` (`tech-ice`, `forge-ice`, `text-primary`)
- **No `--luna-*`:** Do NOT use or declare `--luna-*` variables or classes. All layouts, trade terminal panels, and landing surfaces use the 4 core Tailwind v4 theme colors and opacities (e.g. `border-white/10`, `bg-white/[0.04]`, `text-tech-blue`).
- **Typography & Data Formatting:**
  - Use `font-mono tabular-nums` for all prices, sizes, percentages, timestamps, and countdowns.
  - Format prices using integer `ticks` + `price_scale` helpers (never `parseFloat` + `.toFixed()` for display).
- **Accessibility & Motion:**
  - Respect `@media (prefers-reduced-motion: reduce)` and `motion-reduce:transition-none`.
  - Include `focus-visible:outline-2`, proper `aria-label` / `aria-expanded` / `aria-live`, and keyboard `Escape` + focus trapping on modals.
  - Responsive down to `360px` width with zero horizontal overflow.

## 3. Codebase Conventions & React Rules (R1–R10)

- **Strict TypeScript:** Never use `any`, `@ts-ignore`, or `@ts-expect-error`. Define API response/request types in `src/api/types.ts` matching `docs/api/API.md`.
- **Clean State & Rendering:**
  - Derive computed values during render rather than storing redundant state.
  - Use stable server IDs for `key` props (never array indices for dynamic/reordered lists).
  - Never mutate state/props in place; never use `dangerouslySetInnerHTML` for user-supplied text.
  - Never call `fetch()` directly inside components — route all API calls through `src/api/client.ts`.
- **Code Style:**
  - Named exports for components and pages (`export function TradePage()`), matching existing files.
  - Extract pure formatting/validation logic into `src/lib/` with Vitest unit tests.
  - Keep `src/styles.css` scoped cleanly by feature prefix (`about-*`, `community-*`, `profile-*`) when writing custom CSS, or use Tailwind v4 utility classes with `@theme` tokens.

## 4. Product & Security Invariants (F1–F15)

Never violate these rules when implementing Trading Dojo features:

1. **Server is source of truth (F1–F3):** Never compute or advance `clock_index` on the client, never send cutoff/timestamp parameters to fetch future candles, and never preload/cache unseen candles. Only fetch `GET /trials/{id}/candles` when `clock_index` changes.
2. **Sealed decisions & blind review (F4–F6):** When `decisions_sealed` is true, render only commit status (`committed` / `not committed`), never another user's decision content. Committed decisions have no edit/delete buttons; always ask confirmation before committing. Show review forms only when `round.status === "REVIEW_BLIND"` and never for the user's own decision.
3. **CSRF & Idempotency (F7–F9):** All mutating `POST` requests must go through `api/client.ts` with `X-CSRF-Token` (in memory) and `Idempotency-Key` (one key per user action: keep on retry, rotate on success). Never store tokens, passwords, or CSRF tokens in `localStorage` or `sessionStorage`.
4. **Product safety (F10, F13–F14):** Always display `SYNTHETIC MARKET DATA — NOT REAL NAS100` alongside market/chart views. Never display real-money P&L or win-rate metrics. Never render owner controls when `my_role !== "OWNER"`, and never present demo/mock data as live server data.
5. **All async states (F12):** Every data-driven screen must handle **Loading**, **Empty**, **Error** (keyed on `error.code`, not `error.message`), and **Success**.

## 5. Mandatory Verification

After every frontend edit, run inside `frontend/`:

```bash
npm run typecheck && npm test && npm run build
```

Report the exact command output; never claim checks passed without running them.
