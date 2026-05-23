import { normalizeQuantity, normalizeUnit } from "@/lib/ingredients";

export type AggregatedIngredient = {
  ingredientId: number;
  quantity: number;
  unit: string;
  category: string;
};

type RecipeWithIngredients = {
  ingredients: Array<{
    ingredient: { id: number; category?: string | null };
    quantity?: number | null;
    unit?: string | null;
  }>;
};

export function aggregateIngredients(
  recipes: RecipeWithIngredients[]
): AggregatedIngredient[] {
  const map = new Map<string, AggregatedIngredient>();

  for (const recipe of recipes) {
    for (const ri of recipe.ingredients) {
      const key = `${ri.ingredient.id}-${ri.unit}`;
      const existing = map.get(key);
      if (existing) {
        existing.quantity += ri.quantity || 0;
      } else {
        map.set(key, {
          ingredientId: ri.ingredient.id,
          quantity: ri.quantity || 0,
          unit: ri.unit || "unit",
          category: ri.ingredient.category || "groceries",
        });
      }
    }
  }

  return Array.from(map.values()).map((item) => ({
    ...item,
    quantity: normalizeQuantity(item.quantity),
    unit: normalizeUnit(item.unit),
  }));
}
