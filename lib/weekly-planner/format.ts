import { RecipeWithIngredients, RecipeIngredientWithSeason } from "@/types";
import { calculateHealthScore, calculateIngredientEfficiencyScore, generateReasoning } from "./scoring";

export interface FormattedRecipe {
  id: number;
  title: string;
  description: string;
  image?: string | null;
  url: string;
  ingredients: Array<{
    name: string;
    englishName?: string;
    isSeasonal: boolean;
  }>;
  seasonalScore: number;
  healthScore: number;
  ingredientEfficiencyScore: number;
  reasoning: string;
}

export function formatRecipeResponse(
  recipe: RecipeWithIngredients,
  checkedIngredients: string[]
): FormattedRecipe {
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
      checkedIngredients
    ),
    reasoning: generateReasoning(recipe, seasonalIngredients, checkedIngredients),
  };
}
