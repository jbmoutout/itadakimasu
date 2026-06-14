import { describe, it, expect } from "vitest";
import {
  aggregateRecipeIngredients,
  type AggregateInputRecipe,
} from "@/lib/saved-list-ingredients";

// Concise builders so each test reads as data.
const ri = (
  id: number,
  quantity: number | null,
  unit: string | null,
  category: string | null = "groceries"
) => ({ ingredient: { id, category }, quantity, unit });

const recipe = (...ingredients: AggregateInputRecipe["ingredients"]) => ({
  ingredients,
});

const byId = (rows: ReturnType<typeof aggregateRecipeIngredients>) =>
  new Map(rows.map((r) => [r.ingredientId, r]));

describe("aggregateRecipeIngredients", () => {
  it("sums the same ingredient in the same unit across recipes", () => {
    const result = aggregateRecipeIngredients([
      recipe(ri(1, 100, "g")),
      recipe(ri(1, 150, "g")),
    ]);
    expect(result).toEqual([
      { ingredientId: 1, quantity: 250, unit: "g", category: "groceries" },
    ]);
  });

  it("keeps a shared ingredient's total when one contributing recipe is removed", () => {
    // Headline data-loss bug, as a projection assertion: onion (id 1) is shared
    // by two recipes. Recompute over the surviving recipe must keep onion, not
    // drop it.
    const both = aggregateRecipeIngredients([
      recipe(ri(1, 2, "pc"), ri(2, 100, "g")), // recipe A: onion + flour
      recipe(ri(1, 3, "pc")), // recipe B: onion
    ]);
    expect(byId(both).get(1)).toEqual({
      ingredientId: 1,
      quantity: 5,
      unit: "pc",
      category: "groceries",
    });

    // Remove recipe B → onion is still present, now at recipe A's amount.
    const afterRemoval = aggregateRecipeIngredients([
      recipe(ri(1, 2, "pc"), ri(2, 100, "g")),
    ]);
    expect(byId(afterRemoval).get(1)).toEqual({
      ingredientId: 1,
      quantity: 2,
      unit: "pc",
      category: "groceries",
    });
  });

  it("collapses multiple units to the unit with the most line-items", () => {
    // grams contributed by 2 line-items, cups by 1 → grams wins, regardless of
    // the larger cup quantity.
    const result = aggregateRecipeIngredients([
      recipe(ri(1, 50, "g")),
      recipe(ri(1, 50, "g")),
      recipe(ri(1, 999, "cup")),
    ]);
    expect(result).toEqual([
      { ingredientId: 1, quantity: 100, unit: "g", category: "groceries" },
    ]);
  });

  it("breaks unit ties lexicographically, never by quantity magnitude", () => {
    // One line-item each in 'cup' and 'g'. Tie on count → smallest unit name
    // wins ('cup' < 'g'), even though the gram quantity is far larger.
    const result = aggregateRecipeIngredients([
      recipe(ri(1, 1, "cup")),
      recipe(ri(1, 9999, "g")),
    ]);
    expect(result).toEqual([
      { ingredientId: 1, quantity: 1, unit: "cup", category: "groceries" },
    ]);
  });

  it("is independent of input order", () => {
    const a = aggregateRecipeIngredients([
      recipe(ri(1, 9999, "g")),
      recipe(ri(1, 1, "cup")),
    ]);
    const b = aggregateRecipeIngredients([
      recipe(ri(1, 1, "cup")),
      recipe(ri(1, 9999, "g")),
    ]);
    expect(a).toEqual(b);
  });

  it("normalizes unit aliases and clamps negative/NaN quantities to zero", () => {
    const result = aggregateRecipeIngredients([
      recipe(ri(1, 100, "grams")), // alias → "g"
      recipe(ri(1, -5, "g")), // clamped to 0
    ]);
    expect(result).toEqual([
      { ingredientId: 1, quantity: 100, unit: "g", category: "groceries" },
    ]);
  });

  it("defaults missing unit and category", () => {
    const result = aggregateRecipeIngredients([
      recipe(ri(1, null, null, null)),
    ]);
    expect(result).toEqual([
      { ingredientId: 1, quantity: 0, unit: "unit", category: "groceries" },
    ]);
  });

  it("returns an empty projection for no recipes", () => {
    expect(aggregateRecipeIngredients([])).toEqual([]);
    expect(aggregateRecipeIngredients([recipe()])).toEqual([]);
  });
});
