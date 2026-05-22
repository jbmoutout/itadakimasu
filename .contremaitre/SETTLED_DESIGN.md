# Settled design — Prisma access seam

## What

Unify the two PrismaClient singletons into one canonical module at `lib/prisma.ts`, port `weekly-plan-history.ts` from raw SQL to the typed Prisma client API, and fix all relative imports that bypass the alias.

## The seam

`lib/prisma.ts` is the single module that provides `PrismaClient`. Route handlers, library code, and scripts all import from `@/lib/prisma` (or a relative path that reaches root `lib/`). No other file creates a `PrismaClient`.

## What sits behind the seam

- `PrismaClient` constructor, env-guarded for `log: ['query']` via `LOG_QUERIES=true`
- Global singleton pattern for hot-reload safety in dev
- Nothing else — this is a thin singleton, not a repository layer

## PR sequence (single PR)

### 1. Modify `lib/prisma.ts`
- Add `log: ['query']` only when `process.env.LOG_QUERIES === 'true'`
- Keep existing global singleton pattern

### 2. Delete `app/lib/prisma.ts`
- Remove the file; nothing re-imports it

### 3. Rewrite the 5 raw-SQL calls in `weekly-plan-history.ts`
| Function | Raw SQL | Typed Prisma |
|---|---|---|
| `cleanupWeeklyPlanHistory` | `$executeRaw` DELETE | `weeklyPlanHistory.deleteMany` |
| `getRecipeHistory` | `$queryRaw` SELECT | `weeklyPlanHistory.findMany` |
| `recordWeeklyPlanUsage` | `$executeRaw` INSERT | `weeklyPlanHistory.create` |
| `resetWeeklyPlanHistory` | `$executeRaw` DELETE | `weeklyPlanHistory.deleteMany` |
| `getUsedRecipes` | `$queryRaw` SELECT + JOIN | `weeklyPlanHistory.findMany` + `include: { recipe }` |
- Keep try/catch "table may not exist yet" fallback (real concern in dev)

### 4. Fix 7 relative imports → `@/lib/prisma`
| File | Current import | New import |
|---|---|---|
| `app/api/auth/login/route.ts` | `../../../lib/prisma` | `@/lib/prisma` |
| `app/api/auth/signup/route.ts` | `../../../lib/prisma` | `@/lib/prisma` |
| `app/api/add-recipe/route.ts` | `../../lib/prisma` | `@/lib/prisma` |
| `app/api/extract-ingredients/route.ts` | `../../lib/prisma` | `@/lib/prisma` |
| `app/api/last-shopping-list/route.ts` | `../../lib/prisma` | `@/lib/prisma` |
| `app/api/preview-metadata/route.ts` | `../../lib/prisma` | `@/lib/prisma` |
| `app/api/update-shopping-list/route.ts` | `../../lib/prisma` | `@/lib/prisma` |

### 5. Scripts — leave unchanged
5 scripts use `new PrismaClient()` directly; `clean-excluded-ingredients.ts` already imports `@/lib/prisma`. None benefit from the change.

## What doesn't change
- `export const prisma: PrismaClient` — interface identical
- `@/lib/prisma` alias in `tsconfig.json` — already points to root
- Any `@/lib/prisma` import — already correct
- Route handler logic — no behavioural changes

## Load-bearing constraints
- The try/catch "table may not exist" in `weekly-plan-history.ts` is deliberate; Prisma's typed API throws if migration hasn't run
- Scripts importing `new PrismaClient()` are safe to leave — they're one-shot CLI runs that don't need hot-reload
