# Follow-ups

Deferred work captured during other refactors. Each entry: what, why deferred, what to do.

## Authorization check on `/api/extract-ingredients`

**File:** [app/api/extract-ingredients/route.ts](app/api/extract-ingredients/route.ts)

**Issue.** The route fetches the recipe by id without checking that the recipe belongs to the calling user. Any authenticated user can trigger ingredient extraction (and thus mutation of the `RecipeIngredient` join rows) for any recipe in the database, including recipes owned by other users.

**Why deferred.** Pre-existing — this gap predates the auth-seam refactor. The auth seam closed the *authentication* gap (verifying who the caller is); this is an *authorization* gap (does this caller own the resource they're acting on). Felt out of scope for one PR.

**Fix.** Add a `userId` ownership filter to the recipe lookup:

```ts
const recipe = await prisma.recipe.findFirst({
  where: { id: recipeId, userId: getUserId(request) },
});
if (!recipe) {
  await sendLog("Error: Recipe not found");
  throw new Error("Recipe not found");
}
```

Then audit the other routes that fetch resources by id without an ownership filter — `/api/recipes/[recipeId]/star/route.ts` and `/api/saved-lists/[listId]/recipes/[recipeId]/route.ts` already do it correctly; `/api/extract-ingredients` and any others should match that pattern.
