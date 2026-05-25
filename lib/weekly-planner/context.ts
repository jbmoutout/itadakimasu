import {
  RecipeWithIngredients,
  RecipeData,
  RecipeWeight,
  RecipeIngredientWithSeason,
} from "@/types";

export function buildRecipeData(
  recipes: RecipeWithIngredients[],
  weights: RecipeWeight[],
  checkedIngredients: string[],
  currentMonth: number
): RecipeData[] {
  return recipes.map(
    (recipe: RecipeWithIngredients) => {
      const weight = weights.find(
        (w: RecipeWeight) => w.recipeId === recipe.id
      );
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
        ingredients: recipe.ingredients.slice(0, 10).map(
          (ri: RecipeIngredientWithSeason) => ({
            name: ri.ingredient.name,
            englishName: ri.ingredient.englishName,
            isSeasonal: ri.ingredient.seasons.some(
              (season: { month: number }) => season.month === currentMonth
            ),
          })
        ),
        seasonalScore: seasonalIngredients.length / Math.max(recipe.ingredients.length, 1),
        weight: weight?.weight || 0,
        weightReason: weight?.reason || "No history",
        starred: recipe.starred,
      };
    }
  );
}
