import {
  RecipeWithIngredients,
  RecipeIngredientWithSeason,
} from "@/types";

function getMonthName(month: number): string {
  const months = [
    "January", "February", "March",
    "April", "May", "June",
    "July", "August", "September",
    "October", "November", "December",
  ];
  return months[month - 1];
}

function calculateHealthScore(
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

function calculateIngredientEfficiencyScore(
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

function generateReasoning(
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

function formatRecipeResponse(recipe: RecipeWithIngredients) {
  const currentMonth = new Date().getMonth() + 1;
  const seasonalIngredients = recipe.ingredients.filter(
    (ri: RecipeIngredientWithSeason) =>
      ri.ingredient.seasons.some(
        (season: { month: number }) => season.month === currentMonth
      )
  );

  return {
    id: recipe.id,
    title: recipe.title || "Untitled Recipe",
    description: recipe.description || "",
    image: recipe.image,
    url: recipe.url,
    ingredients: recipe.ingredients.map(
      (ri: RecipeIngredientWithSeason) => ({
        name: ri.ingredient.name,
        englishName: ri.ingredient.englishName,
        isSeasonal: ri.ingredient.seasons.some(
          (season: { month: number }) => season.month === currentMonth
        ),
      })
    ),
    seasonalScore: seasonalIngredients.length / Math.max(recipe.ingredients.length, 1),
    healthScore: calculateHealthScore(seasonalIngredients),
    ingredientEfficiencyScore: calculateIngredientEfficiencyScore(
      seasonalIngredients,
      []
    ),
    reasoning: generateReasoning(recipe, seasonalIngredients, []),
  };
}

export {
  getMonthName,
  calculateHealthScore,
  calculateIngredientEfficiencyScore,
  generateReasoning,
  formatRecipeResponse,
};
