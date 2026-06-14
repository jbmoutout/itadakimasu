import type { Prisma } from "@prisma/client";
import { aggregateRecipeIngredients } from "@/lib/saved-list-ingredients";

/**
 * Recompute a Saved List's Saved Ingredients from its current recipes (see
 * CONTEXT.md → Aggregation). Call this inside a `$transaction`, after the
 * recipe connect/disconnect, so the projection and the recipe set commit
 * together.
 *
 * Reconcile, not delete-and-recreate: rows whose ingredient is no longer
 * contributed are deleted; the rest are upserted. `checked` is never written on
 * update, so cooking checkoff state survives a recipe being added or removed.
 */
export async function recomputeSavedListIngredients(
  tx: Prisma.TransactionClient,
  savedListId: number
): Promise<void> {
  const list = await tx.savedList.findUnique({
    where: { id: savedListId },
    include: {
      recipes: {
        include: {
          ingredients: { include: { ingredient: true } },
        },
      },
      ingredients: true,
    },
  });

  if (!list) return;

  const desired = aggregateRecipeIngredients(list.recipes);
  const desiredIngredientIds = new Set(desired.map((d) => d.ingredientId));

  const rowsToDelete = list.ingredients.filter(
    (row) => !desiredIngredientIds.has(row.ingredientId)
  );
  if (rowsToDelete.length > 0) {
    await tx.savedIngredient.deleteMany({
      where: { id: { in: rowsToDelete.map((row) => row.id) } },
    });
  }

  for (const item of desired) {
    await tx.savedIngredient.upsert({
      where: {
        savedListId_ingredientId: {
          savedListId,
          ingredientId: item.ingredientId,
        },
      },
      create: {
        savedListId,
        ingredientId: item.ingredientId,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        checked: false,
      },
      update: {
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
      },
    });
  }
}
