import { prisma } from "@/lib/prisma";
import anthropic from "@/app/lib/anthropic";
import {
  getRecipeHistory,
  calculateRecipeWeights,
  recordWeeklyPlanUsage,
  cleanupWeeklyPlanHistory,
} from "@/lib/weekly-plan-history";
import {
  RecipeWithIngredients,
  RecipeIngredientWithSeason,
} from "@/types";
import { withTimeout } from "./timeout";
import { buildRecipeData } from "./context";
import { buildMainPlannerPrompt } from "./prompt";
import { selectFallbackRecipes, parseRecipeIdsFromAIResponse } from "./fallback";
import { formatRecipeResponse } from "./format";
import type { FormattedRecipe } from "./format";

const API_TIMEOUT = 15000;

export { FormattedRecipe };

export interface PlanResult {
  recipes: FormattedRecipe[];
  totalRecipes: number;
  checkedIngredients: string[];
  processingTime?: number;
  fallbackUsed?: boolean;
}

export interface AlternativeRecipe {
  id: number;
  title: string;
  description: string;
  url: string;
  image: string | null;
  starred: boolean;
  ingredients: Array<{
    ingredient: {
      id: number;
      name: string;
      seasons: Array<{ month: number }>;
    };
    quantity: number;
    unit: string;
  }>;
  reasoning: string;
  seasonalScore: number;
  healthScore: number;
  ingredientEfficiencyScore: number;
}

export interface AlternativesResult {
  alternatives: AlternativeRecipe[];
  generatedAt: string;
}

interface WeeklyPlanRecipe {
  id: number;
}

export async function generateWeeklyPlan(userId: number): Promise<PlanResult> {
  const startTime = Date.now();

  cleanupWeeklyPlanHistory().catch(error => {
    console.error("Cleanup failed:", error);
  });

  const recipes = await withTimeout(
    prisma.recipe.findMany({
      where: { userId },
      take: 100,
      include: {
        ingredients: {
          take: 20,
          include: {
            ingredient: {
              select: {
                name: true,
                englishName: true,
                seasons: {
                  select: {
                    month: true
                  }
                }
              },
            },
          },
        },
      },
      orderBy: [
        { starred: 'desc' },
        { createdAt: 'desc' }
      ]
    }),
    10000
  ) as unknown as RecipeWithIngredients[];

  if (recipes.length === 0) {
    throw new Error("No recipes found");
  }

  const checkedIngredients = await withTimeout(
    prisma.savedIngredient.findMany({
      where: {
        savedList: { userId },
        checked: true,
      },
      include: {
        ingredient: {
          select: { name: true }
        }
      },
      take: 50,
    }),
    5000
  );

  const checkedIngredientNames = checkedIngredients.map(
    (item) => item.ingredient.name.toLowerCase()
  );

  const history = await withTimeout(
    getRecipeHistory(userId),
    5000
  );

  const starredRecipeIds = new Set<number>(
    recipes
      .filter((recipe: RecipeWithIngredients) => recipe.starred)
      .map((recipe: RecipeWithIngredients) => recipe.id)
  );

  const recipeWeights = calculateRecipeWeights(
    recipes.map((r: RecipeWithIngredients) => r.id),
    history,
    starredRecipeIds
  );

  const currentMonth = new Date().getMonth() + 1;

  const recipeData = buildRecipeData(recipes, recipeWeights, checkedIngredientNames, currentMonth);

  recipeData.sort((a, b) => b.weight - a.weight);
  const topRecipes = recipeData.slice(0, 20);

  const prompt = buildMainPlannerPrompt(topRecipes, currentMonth, checkedIngredientNames);

  const response = await withTimeout(
    anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
    API_TIMEOUT
  );

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Anthropic");
  }

  const selectedRecipeIds = parseRecipeIdsFromAIResponse(content.text);
  if (!selectedRecipeIds) {
    const fallbackIds = selectFallbackRecipes(topRecipes);
    console.warn("AI parsing failed, using fallback selection:", fallbackIds);

    const fallbackRecipes = recipes.filter(r => fallbackIds.includes(r.id));

    return {
      recipes: fallbackRecipes.map(r => formatRecipeResponse(r, checkedIngredientNames)),
      totalRecipes: recipes.length,
      checkedIngredients: checkedIngredientNames,
      fallbackUsed: true,
      processingTime: Date.now() - startTime,
    };
  }

  const selectedRecipes = await withTimeout(
    prisma.recipe.findMany({
      where: {
        id: { in: selectedRecipeIds },
        userId,
      },
      include: {
        ingredients: {
          include: {
            ingredient: {
              select: {
                name: true,
                englishName: true,
                seasons: {
                  select: {
                    month: true
                  }
                }
              },
            },
          },
        },
      },
    }),
    5000
  ) as unknown as RecipeWithIngredients[];

  Promise.all(
    selectedRecipeIds.map(recipeId =>
      recordWeeklyPlanUsage(userId, recipeId, "suggested").catch(error => {
        console.error(`Failed to record usage for recipe ${recipeId}:`, error);
      })
    )
  );

  return {
    recipes: selectedRecipes.map(r => formatRecipeResponse(r, checkedIngredientNames)),
    totalRecipes: recipes.length,
    checkedIngredients: checkedIngredientNames,
    processingTime: Date.now() - startTime,
  };
}

export async function generateAlternatives(
  userId: number,
  rejectedRecipeId: number,
  currentWeeklyPlan: WeeklyPlanRecipe[]
): Promise<AlternativesResult> {
  const recipes = await withTimeout(
    prisma.recipe.findMany({
      where: { userId },
      include: {
        ingredients: {
          include: {
            ingredient: {
              include: {
                seasons: {
                  select: { month: true },
                },
              },
            },
          },
        },
      },
    }),
    10000
  ) as unknown as RecipeWithIngredients[];

  const availableRecipes = recipes.filter(
    (recipe: RecipeWithIngredients) =>
      recipe.id !== rejectedRecipeId &&
      !currentWeeklyPlan.some(
        (planRecipe: WeeklyPlanRecipe) => planRecipe.id === recipe.id
      )
  );

  if (availableRecipes.length === 0) {
    throw new Error("No alternative recipes available");
  }

  const currentMonth = new Date().getMonth() + 1;

  const recipeData = availableRecipes.map(
    (recipe: RecipeWithIngredients) => ({
      id: recipe.id,
      title: recipe.title || "Untitled Recipe",
      description: recipe.description || "",
      url: recipe.url,
      image: recipe.image || "",
      starred: recipe.starred,
      ingredients: recipe.ingredients.map(
        (ri: RecipeIngredientWithSeason) => ({
          name: ri.ingredient.name,
          quantity: ri.quantity || 0,
          unit: ri.unit || "unit",
          seasons: ri.ingredient.seasons.map(
            (s: { month: number }) => s.month
          ),
        })
      ),
    })
  );

  const selectionPrompt = `
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

  const response = await withTimeout(
    anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      temperature: 0.3,
      messages: [
        {
          role: "user",
          content: selectionPrompt,
        },
      ],
    }),
    API_TIMEOUT
  );

  const altContent = response.content[0];
  if (altContent.type !== "text") {
    throw new Error("Unexpected response type from Anthropic");
  }
  const responseText = altContent.text.trim();
  let selectionResult: { alternativeRecipes: Array<{
    recipeId: number;
    reasoning: string;
    seasonalScore: number;
    healthScore: number;
    ingredientEfficiencyScore: number;
  }> };

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      selectionResult = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("No JSON found in response");
    }
  } catch (error) {
    console.error("Error parsing Claude response:", error);
    console.error("Response text:", responseText);
    throw new Error("Failed to analyze recipes");
  }

  if (
    !selectionResult.alternativeRecipes ||
    selectionResult.alternativeRecipes.length !== 3
  ) {
    throw new Error("Invalid recipe selection format");
  }

  const alternativeRecipes = selectionResult.alternativeRecipes.map(
    (selection) => {
      const recipe = availableRecipes.find(
        (r: RecipeWithIngredients) => r.id === selection.recipeId
      );
      if (!recipe) {
        throw new Error(`Recipe ${selection.recipeId} not found`);
      }

      return {
        id: recipe.id,
        title: recipe.title || "Untitled Recipe",
        description: recipe.description || "",
        url: recipe.url,
        image: recipe.image || "",
        starred: recipe.starred,
        ingredients: recipe.ingredients.map(
          (ri: RecipeIngredientWithSeason) => ({
            ingredient: {
              id: ri.ingredient.id,
              name: ri.ingredient.name,
              seasons: ri.ingredient.seasons,
            },
            quantity: ri.quantity || 0,
            unit: ri.unit || "unit",
          })
        ),
        reasoning: selection.reasoning,
        seasonalScore: selection.seasonalScore,
        healthScore: selection.healthScore,
        ingredientEfficiencyScore: selection.ingredientEfficiencyScore,
      };
    }
  );

  return {
    alternatives: alternativeRecipes,
    generatedAt: new Date().toISOString(),
  };
}
