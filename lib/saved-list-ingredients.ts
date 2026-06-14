import { normalizeQuantity, normalizeUnit } from "@/lib/ingredients";

// Structural inputs — what aggregation needs from a recipe, and no more. Kept
// decoupled from Prisma's generated types so the core stays pure and DB-free.
export type AggregateInputIngredient = {
  quantity: number | null;
  unit: string | null;
  ingredient: { id: number; category?: string | null };
};

export type AggregateInputRecipe = {
  ingredients: AggregateInputIngredient[];
};

export type AggregatedIngredient = {
  ingredientId: number;
  quantity: number;
  unit: string;
  category: string;
};

/**
 * Aggregation (see CONTEXT.md): given a Saved List's current recipes, return the
 * Saved Ingredient set the list should have. Pure — no I/O, no Prisma.
 *
 * Grain is one row per ingredient (matching the `(savedListId, ingredientId)`
 * storage key). Quantities sum within a normalized unit. When an ingredient
 * appears in multiple units, the single row takes a deterministic, quantity-blind
 * winner: the unit contributed by the most line-items, tie-broken by the
 * lexicographically smallest normalized unit name. The selector never orders
 * cross-unit quantities, so the result does not depend on quantity magnitude or
 * on input order.
 */
export function aggregateRecipeIngredients(
  recipes: AggregateInputRecipe[]
): AggregatedIngredient[] {
  type UnitBucket = { quantity: number; count: number };
  type IngredientBucket = {
    ingredientId: number;
    category: string;
    units: Map<string, UnitBucket>;
  };

  const byIngredient = new Map<number, IngredientBucket>();

  for (const recipe of recipes) {
    for (const ri of recipe.ingredients) {
      const ingredientId = ri.ingredient.id;
      const unit = normalizeUnit(ri.unit || "unit");
      const quantity = normalizeQuantity(ri.quantity ?? 0);
      const category = ri.ingredient.category || "groceries";

      let bucket = byIngredient.get(ingredientId);
      if (!bucket) {
        bucket = { ingredientId, category, units: new Map() };
        byIngredient.set(ingredientId, bucket);
      }

      const unitBucket = bucket.units.get(unit);
      if (unitBucket) {
        unitBucket.quantity += quantity;
        unitBucket.count += 1;
      } else {
        bucket.units.set(unit, { quantity, count: 1 });
      }
    }
  }

  const result: AggregatedIngredient[] = [];
  for (const bucket of Array.from(byIngredient.values())) {
    let winnerUnit = "";
    let winner: UnitBucket | null = null;

    for (const [unit, candidate] of Array.from(bucket.units)) {
      const wins =
        winner === null ||
        candidate.count > winner.count ||
        (candidate.count === winner.count && unit < winnerUnit);
      if (wins) {
        winner = candidate;
        winnerUnit = unit;
      }
    }

    if (winner) {
      result.push({
        ingredientId: bucket.ingredientId,
        quantity: winner.quantity,
        unit: winnerUnit,
        category: bucket.category,
      });
    }
  }

  return result;
}
