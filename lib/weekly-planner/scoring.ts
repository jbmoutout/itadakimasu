import { RecipeWithIngredients, RecipeIngredientWithSeason } from "@/types";

export function calculateHealthScore(
  ingredients: RecipeIngredientWithSeason[]
): number {
  const seasonalCount = ingredients.filter((ri) =>
    ri.ingredient.seasons.some(
      (season: { month: number }) => season.month === new Date().getMonth() + 1
    )
  ).length;

  const varietyScore = Math.min(ingredients.length / 10, 1);
  const seasonalScore = seasonalCount / ingredients.length;

  return Math.round((varietyScore * 0.6 + seasonalScore * 0.4) * 100);
}

export function calculateIngredientEfficiencyScore(
  ingredients: RecipeIngredientWithSeason[],
  checkedIngredients: string[]
): number {
  if (checkedIngredients.length === 0) return 50;

  const matchingIngredients = ingredients.filter((ri) =>
    checkedIngredients.includes(ri.ingredient.name.toLowerCase())
  );

  const efficiencyRatio = matchingIngredients.length / ingredients.length;
  return Math.round(efficiencyRatio * 100);
}

export function generateReasoning(
  recipe: RecipeWithIngredients,
  seasonalIngredients: RecipeIngredientWithSeason[],
  checkedIngredients: string[]
): string {
  const reasons: string[] = [];

  if (seasonalIngredients.length > 0) {
    reasons.push(`Uses ${seasonalIngredients.length} seasonal ingredients`);
  }

  const matchingChecked = recipe.ingredients.filter(
    (ri: RecipeIngredientWithSeason) =>
      checkedIngredients.includes(ri.ingredient.name.toLowerCase())
  );

  if (matchingChecked.length > 0) {
    reasons.push(`Uses ${matchingChecked.length} ingredients you already have`);
  }

  if (recipe.starred) {
    reasons.push("One of your starred recipes");
  }

  if (reasons.length === 0) {
    reasons.push("Good variety and nutritional balance");
  }

  return reasons.join(", ");
}
