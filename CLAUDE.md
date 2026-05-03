# CLAUDE.md — JR Dashboard Salones

## Project

Next.js 14 + Supabase dashboard for multi-salon financial management.
Full knowledge base: `JR_CONSULTORIA_APP.md` (update with every significant change).

## Commands

- Build: `npm run build`
- Test: `npm run test`
- Dev: `npm run dev` (port 3000)
- Lint: `npm run lint`

## Style

- All components use `"use client"`
- Tailwind + inline styles for `salonColor`
- Mobile-first (iPhone PWA)
- Font sizes: `text-[11px]` to `text-[14px]`
- `formatMoney()` for all currency display
- Framer Motion for animations
- Warm palette: bg `#F8F3ED`, accent `#7B4F2E`, gold `#C8963C`

## Git

- Production: `main` (Vercel auto-deploy)
- Development: `claude/fix-vercel-production-branch-pj9gq`

## Environment

Required env vars (see `.env.example` for names):
- Supabase URL and anon key
- Google Sheets API key

Never commit `.env.local` or actual secrets to the repo.

## Critical Rules

- FK disambiguation: always use `bolsas!bolsas_salon_id_fkey(*)` in Supabase selects
- `initStore()` must NEVER cache — always fetch fresh
- `deleteSalon()`: nullify FK first, delete children in order, then delete salon
- `addSalon()`: insert with null FK, create bolsas, then update FK
- `updateSalon()`: upsert strategy for bolsas (never delete+insert)
- `addCierre()`: check for existing cierre before inserting
- `supabase/functions/` excluded from tsconfig (Deno-style imports)

## Edit Discipline (Karpathy-inspired)

When modifying existing code (dashboards, scripts, slides):

1. **Surgical scope**: Every changed line must trace directly to the request.
   Don't refactor adjacent code, comments, or formatting.
   Match existing style even if you'd do it differently.

2. **Orphan cleanup only**: Remove imports/vars that YOUR changes made unused.
   Pre-existing dead code: mention it, don't delete it.

3. **Goal-driven verification**: For non-trivial tasks, state success criteria
   before implementing. Format:
     1. [Step] → verify: [observable check]

Exception: Design system tokens, brand palette, and pre-calculated layout
coordinates are project constants — never simplified or "cleaned up".
