# Settled Design: Prisma Client Seam Consolidation

## The seam

The Prisma client instantiation — currently split across two files with different configs and different import paths.

## What sits behind the seam

- `lib/prisma.ts` — the **survivor**. A PrismaClient singleton with no query logging. GlobalThis caching in dev.
- `app/lib/prisma.ts` — **to delete**. A second PrismaClient singleton with `log: ['query']`. Global caching (different key).
- ~20 route files importing one or the other.

## Before vs after

| Before | After |
|--------|-------|
| Two `PrismaClient` instances, two connection pools | One canonical singleton |
| Inconsistent logging: some queries logged from `app/lib/prisma.ts`, none from `lib/prisma.ts` | No logging (suppressed) |
| 11 files use relative imports (e.g. `../../lib/prisma`) resolving to one of the two files | All 21 files use `@/lib/prisma` |
| `globalThis` vs `global` — two caching strategies | One pattern (`globalThis`) |

## Decisions locked during grilling

1. **`log: ['query']` is a dev artifact.** Suppressed. The surviving file keeps its current no-logging config.
2. **Normalize to `@/lib/prisma`.** The tsconfig `@/*` → `./*` alias resolves to the survivor. All 11 files using relative paths are edited.
3. **Delete `app/lib/prisma.ts`.** The file and its directory are removed.

## PR sequence (single change, no dependency ordering)

1. Edit `lib/prisma.ts` — no changes needed (already clean).
2. Edit all 11 files with relative imports → `@/lib/prisma`.
3. Delete `app/lib/prisma.ts`.
4. Delete `app/lib/` directory (empty after step 3).
5. Build check: `npx next build` or `npx tsc --noEmit`.

## Files affected

### Reads unchanged (already use `@/lib/prisma`)
- `lib/weekly-plan-history.ts`
- `app/api/saved-lists/route.ts`
- `app/api/weekly-planner/route.ts`
- `app/api/weekly-planner/alternatives/route.ts`
- `app/api/saved-lists/[listId]/route.ts`
- `app/api/saved-lists/[listId]/recipes/route.ts`
- `app/api/recipes/[recipeId]/route.ts`
- `app/api/recipes/remove-duplicates/route.ts`
- `app/api/rating/route.ts`
- `app/api/ingredients/route.ts`

### Edits (relative import → `@/lib/prisma`)
1. `scripts/clean-excluded-ingredients.ts`
2. `app/api/update-shopping-list/route.ts`
3. `app/api/recipes/route.ts`
4. `app/api/saved-lists/[listId]/recipes/[recipeId]/route.ts`
5. `app/api/recipes/[recipeId]/star/route.ts`
6. `app/api/extract-ingredients/route.ts`
7. `app/api/auth/signup/route.ts`
8. `app/api/preview-metadata/route.ts`
9. `app/api/last-shopping-list/route.ts`
10. `app/api/auth/login/route.ts`
11. `app/api/add-recipe/route.ts`

### Deleted
- `app/lib/prisma.ts`
- `app/lib/` (directory, if empty)