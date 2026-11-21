# Frontend Agent Instructions (`frontend/`)

This workspace uses React 19, TypeScript 6 (strict), Vite 8, Tailwind CSS v4, and Vitest.
Before writing or refactoring code in `frontend/`, load the relevant skills from `.agents/skills/`:

- **Always load first:** `.agents/skills/market-forge-frontend/SKILL.md` (project tokens, API client, F1–F15 invariants, R1–R10 rules, and no-unapproved-dependency policy).
- **UI design & layout:** `.agents/skills/frontend-design/SKILL.md`
- **React performance & hooks:** `.agents/skills/vercel-react-best-practices/SKILL.md`
- **Component refactoring & composition:** `.agents/skills/vercel-composition-patterns/SKILL.md`
- **Accessibility & UX audit:** `.agents/skills/web-design-guidelines/SKILL.md`
- **Vite config & Vitest tests:** `.agents/skills/vite/SKILL.md` and `.agents/skills/vitest/SKILL.md`

## Quick Verification

Always verify changes from `frontend/` with:

```bash
npm run typecheck && npm test && npm run build
```
