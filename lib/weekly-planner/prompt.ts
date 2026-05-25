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

export function buildAlternativesPrompt(
  recipeData: Array<{
    id: number;
    title: string;
    description: string;
    url: string;
    image: string;
    starred: boolean;
    ingredients: Array<{
      name: string;
      quantity: number;
      unit: string;
      seasons: number[];
    }>;
  }>,
  currentMonth: number,
  rejectedRecipeId: number
): string {
  return `
You are a culinary expert and nutritionist specializing in French seasonal cooking. A user has rejected a recipe from their weekly meal plan and needs 3 alternative options.

Current month: ${currentMonth} (France seasonal context)
Rejected recipe ID: ${rejectedRecipeId}

CRITERIA (in order of importance):
1. HEALTH: Prioritize recipes with vegetables, lean proteins, whole grains, and balanced nutrition
2. SEASONALITY: Favor recipes with ingredients currently in season in France (month ${currentMonth})
3. INGREDIENT EFFICIENCY: Select recipes that share ingredients with the current weekly plan to minimize waste
4. VARIETY: Ensure diverse flavors, cooking methods, and cuisine types
5. USER PREFERENCES: Slightly favor starred/favorite recipes (marked as starred: true)

AVAILABLE RECIPES:
${JSON.stringify(recipeData, null, 2)}

TASK:
Analyze all available recipes and select exactly 3 that best meet the criteria above. For each selected recipe, provide:
- A brief reasoning (2-3 sentences) explaining why it was chosen as an alternative
- Seasonal score (0-10): how many seasonal ingredients it contains
- Health score (0-10): nutritional balance assessment
- Ingredient efficiency score (0-10): potential for ingredient sharing

Return ONLY a JSON object with this structure:
{
  "alternativeRecipes": [
    {
      "recipeId": number,
      "reasoning": "string",
      "seasonalScore": number,
      "healthScore": number,
      "ingredientEfficiencyScore": number
    }
  ]
}

Focus on providing diverse, healthy, and practical alternatives that complement the existing weekly plan.
`;
}
