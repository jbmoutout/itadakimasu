import { RecipeData } from "@/types";

function getMonthName(month: number): string {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return months[month - 1];
}

export function buildMainPlannerPrompt(
  topRecipes: RecipeData[],
  currentMonth: number,
  checkedIngredientNames: string[]
): string {
  return `You are a French cuisine expert. Select exactly 5 recipes from these ${topRecipes.length} options for a weekly meal plan.

Current month: ${currentMonth} (${getMonthName(currentMonth)})
Checked ingredients: ${checkedIngredientNames.slice(0, 10).join(", ") || "None"}

Top recipes by weight:
${topRecipes
  .map(
    (recipe: RecipeData) =>
      `ID: ${recipe.id} | ${recipe.title} | Weight: ${recipe.weight} | Seasonal: ${(recipe.seasonalScore * 100).toFixed(0)}% | Starred: ${recipe.starred ? 'Yes' : 'No'}`
  )
  .join("\n")}

Return ONLY a JSON array with exactly 5 recipe IDs: [123, 456, 789, 101, 112]`;
}
