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
- Marca apalabra (rama `claude/rediseno-apalabra`): papel `#FFF4F9`, tinta `#1C0B14`
  (dinero y texto), rosa `#D9007A` (marca, nunca estado), mandarina `#FF7A1A` (solo botón
  principal), patio `#FFC83D` (logros); estados entra `#0E8A5F` / atento `#9A4A00` / sale `#B3261E`
- Fuentes: Gabarito (`font-brand`, `.font-numbers` para cifras) + Figtree (`font-display`, texto)
- `salonColor` solo en el avatar del salón (`SalonAvatar`); no pinta botones ni pestañas
- Primitivas compartidas en `components/ui/Primitives.tsx` e íconos en `components/ui/Icons.tsx`
- Mobile-first (iPhone PWA), barra inferior de pestañas
- Font sizes: `text-[11px]` to `text-[14px]` en texto; cifras protagonistas pueden ser mayores
- `formatMoney()` for all currency display; negativos con signo `−`
- Framer Motion for animations

## Git

- Production: `claude/fix-vercel-production-branch-pj9gq` (Production Branch real
  configurada en Vercel Project Settings → Git; auto-deploy en jr-dashboard-salones.vercel.app).
  Nombre histórico confuso, pero es la que Vercel realmente usa — verificado con
  `target: "production"` en los deployments (2026-09-21).
- Development: ramas `claude/*` por feature; al terminar, merge a
  `claude/fix-vercel-production-branch-pj9gq` (no siempre es fast-forward puro:
  puede requerir un merge commit si la rama de producción tiene commits propios).
- `claude/main` NO es la rama de producción pese a su nombre — solo genera
  previews. Antes de asumir cuál rama despliega, confirmar con Vercel
  (`target: "production"` en `list_deployments` o `get_project`), no con el nombre.

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
