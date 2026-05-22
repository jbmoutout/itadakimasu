import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import {
  RecipeWithIngredients,
  RecipeData,
  RecipeWeight,
  RecipeIngredientWithSeason,
} from "@/types";

const FUNCTION_TIMEOUT = 25000;
const API_TIMEOUT = 15000;

const WEIGHTS = {
  recentlyAccepted: -50,
  recentlyRejected: -20,
  recentlySuggested: -10,
  starred: 10,
  neverUsed: 30,
  seasonalBonus: 5,
  healthBonus: 3,
  historyRetentionDays: 30,
  lookbackWeeks: 4,
  minRecipesForVariety: 5,
  maxRecentlyUsedInFallback: 2,
} as const;

export interface PlanResult {
  recipes: Array<{
    id: number;
    title: string;
    description: string;
    image: string | null;
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
  }>;
  totalRecipes: number;
  checkedIngredients: string[];
  processingTime?: number;
  fallbackUsed?: boolean;
}

export interface AlternativeResult {
  alternatives: Array<{
    id: number;
    title: string;
    description: string;
    url: string;
    image: string;
    starred: boolean;
    ingredients: Array<{
      ingredient: { id: number; name: string; seasons: Array<{ month: number }> };
      quantity: number;
      unit: string;
    }>;
    reasoning: string;
    seasonalScore: number;
    healthScore: number;
    ingredientEfficiencyScore: number;
  }>;
  generatedAt: string;
}

export class Planner {
  constructor(private anthropic: Anthropic) {}

  async generatePlan(userId: number): Promise<PlanResult> {
    const startTime = Date.now();

    const checkTimeout = () => {
      if (Date.now() - startTime > FUNCTION_TIMEOUT) {
        throw new Error("Function timeout approaching");
      }
    };

    this.cleanupHistory().catch((error) => {
      console.error("Cleanup failed:", error);
    });

    checkTimeout();

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
                  seasons: { select: { month: true } },
                },
              },
            },
          },
        },
        orderBy: [{ starred: "desc" }, { createdAt: "desc" }],
      }),
      10000
    );

    if (recipes.length === 0) {
      throw new Error("No recipes found");
    }

    checkTimeout();

    const checkedIngredients = await withTimeout(
      prisma.shoppingList.findMany({
        where: { userId, checked: true },
        take: 50,
      }),
      5000
    );

    const checkedIngredientNames: string[] = [];
    checkedIngredients.forEach((item) => {
      try {
        const data = item.data as { name?: string };
        if (data && data.name) {
          checkedIngredientNames.push(data.name.toLowerCase());
        }
      } catch (error) {
        console.error("Error parsing shopping list item:", error);
      }
    });

    checkTimeout();

    const history = await withTimeout(getRecipeHistory(userId), 5000);

    const starredRecipeIds = new Set<number>(
      recipes.filter((r) => r.starred).map((r) => r.id)
    );

    const recipeWeights = calculateRecipeWeights(
      recipes.map((r) => r.id),
      history,
      starredRecipeIds
    );

    checkTimeout();

    const currentMonth = new Date().getMonth() + 1;

    const recipeData: RecipeData[] = (recipes as unknown as RecipeWithIngredients[]).map(
      (recipe) => {
        const weight = recipeWeights.find((w) => w.recipeId === recipe.id);
        const seasonalIngredients = recipe.ingredients.filter((ri) =>
          ri.ingredient.seasons.some((s) => s.month === currentMonth)
        );

        return {
          id: recipe.id,
          title: recipe.title || "Untitled Recipe",
          description: recipe.description || "",
          ingredients: recipe.ingredients.slice(0, 10).map((ri) => ({
            name: ri.ingredient.name,
            englishName: ri.ingredient.englishName,
            isSeasonal: ri.ingredient.seasons.some(
              (s) => s.month === currentMonth
            ),
          })),
          seasonalScore:
            seasonalIngredients.length / Math.max(recipe.ingredients.length, 1),
          weight: weight?.weight || 0,
          weightReason: weight?.reason || "No history",
          starred: recipe.starred,
        };
      }
    );

    recipeData.sort((a, b) => b.weight - a.weight);
    const topRecipes = recipeData.slice(0, 20);

    checkTimeout();

    const prompt = buildPlannerPrompt(
      topRecipes,
      currentMonth,
      checkedIngredientNames
    );

    checkTimeout();

    const response = await withTimeout(
      this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 200,
        temperature: 0.1,
        messages: [{ role: "user", content: prompt }],
      }),
      API_TIMEOUT
    );

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Anthropic");
    }

    const recipeIdsMatch = content.text.match(/\[(\d+(?:,\s*\d+)*)\]/);
    if (!recipeIdsMatch) {
      const fallbackIds = topRecipes.slice(0, 5).map((r) => r.id);
      const fallbackRecipes = (recipes as unknown as RecipeWithIngredients[]).filter((r) =>
        fallbackIds.includes(r.id)
      );

      return {
        recipes: fallbackRecipes.map((r) => formatRecipeResponse(r, [])),
        totalRecipes: recipes.length,
        checkedIngredients: checkedIngredientNames,
        fallbackUsed: true,
      };
    }

    const selectedRecipeIds = recipeIdsMatch[1]
      .split(",")
      .map((id) => parseInt(id.trim()))
      .filter((id) => !isNaN(id))
      .slice(0, 5);

    checkTimeout();

    const selectedRecipes = (await withTimeout(
      prisma.recipe.findMany({
        where: { id: { in: selectedRecipeIds }, userId },
        include: {
          ingredients: {
            include: {
              ingredient: {
                select: {
                  name: true,
                  englishName: true,
                  seasons: { select: { month: true } },
                },
              },
            },
          },
        },
      }),
      5000
    )) as unknown as RecipeWithIngredients[];

    Promise.all(
      selectedRecipeIds.map((recipeId) =>
        recordUsage(userId, recipeId, "suggested").catch((error) => {
          console.error(`Failed to record usage for recipe ${recipeId}:`, error);
        })
      )
    );

    const formattedRecipes = selectedRecipes.map((r) =>
      formatRecipeResponse(r, checkedIngredientNames)
    );

    return {
      recipes: formattedRecipes,
      totalRecipes: recipes.length,
      checkedIngredients: checkedIngredientNames,
      processingTime: Date.now() - startTime,
    };
  }

  async generateAlternatives(
    userId: number,
    rejectedRecipeId: number,
    currentWeeklyPlan: { id: number }[]
  ): Promise<AlternativeResult> {
    const recipes = (await prisma.recipe.findMany({
      where: { userId },
      include: {
        ingredients: {
          include: {
            ingredient: {
              include: {
                seasons: { select: { month: true } },
              },
            },
          },
        },
      },
    })) as unknown as RecipeWithIngredients[];

    const availableRecipes = recipes.filter(
      (recipe) =>
        recipe.id !== rejectedRecipeId &&
        !currentWeeklyPlan.some((planRecipe) => planRecipe.id === recipe.id)
    );

    if (availableRecipes.length === 0) {
      throw new Error("No alternative recipes available");
    }

    const currentMonth = new Date().getMonth() + 1;

    const recipeData = availableRecipes.map((recipe) => ({
      id: recipe.id,
      title: recipe.title || "Untitled Recipe",
      description: recipe.description || "",
      url: recipe.url,
      image: recipe.image || "",
      starred: recipe.starred,
      ingredients: recipe.ingredients.map((ri) => ({
        name: ri.ingredient.name,
        quantity: ri.quantity || 0,
        unit: ri.unit || "unit",
        seasons: ri.ingredient.seasons.map((s) => s.month),
      })),
    }));

    const prompt = buildAlternativesPrompt(
      recipeData,
      rejectedRecipeId,
      currentMonth
    );

    const response = await this.anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });

    const responseContent = response.content[0];
    if (responseContent.type !== "text") {
      throw new Error("Unexpected response type from Anthropic");
    }

    const responseText = responseContent.text.trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const selectionResult = JSON.parse(jsonMatch[0]) as {
      alternativeRecipes: Array<{
        recipeId: number;
        reasoning: string;
        seasonalScore: number;
        healthScore: number;
        ingredientEfficiencyScore: number;
      }>;
    };

    if (
      !selectionResult.alternativeRecipes ||
      selectionResult.alternativeRecipes.length !== 3
    ) {
      throw new Error("Invalid recipe selection format");
    }

    const alternatives = selectionResult.alternativeRecipes.map((selection) => {
      const recipe = availableRecipes.find((r) => r.id === selection.recipeId);
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
        ingredients: recipe.ingredients.map((ri) => ({
          ingredient: {
            id: ri.ingredient.id,
            name: ri.ingredient.name,
            seasons: ri.ingredient.seasons,
          },
          quantity: ri.quantity || 0,
          unit: ri.unit || "unit",
        })),
        reasoning: selection.reasoning,
        seasonalScore: selection.seasonalScore,
        healthScore: selection.healthScore,
        ingredientEfficiencyScore: selection.ingredientEfficiencyScore,
      };
    });

    return {
      alternatives,
      generatedAt: new Date().toISOString(),
    };
  }

  async recordDecision(
    userId: number,
    recipeId: number,
    status: "accepted" | "rejected" | "suggested"
  ): Promise<void> {
    await recordUsage(userId, recipeId, status);
  }

  async resetHistory(userId: number): Promise<number> {
    const result = await prisma.weeklyPlanHistory.deleteMany({
      where: { userId },
    });
    return result.count;
  }

  async cleanupHistory(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - WEIGHTS.historyRetentionDays);

    const result = await prisma.weeklyPlanHistory.deleteMany({
      where: { createdAt: { lt: cutoffDate } },
    });

    return result.count;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Operation timed out")), timeoutMs)
    ),
  ]);
}

interface RecipeHistory {
  recipeId: number;
  status: "accepted" | "rejected" | "suggested";
  planDate: Date;
}

async function getRecipeHistory(userId: number): Promise<RecipeHistory[]> {
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - WEIGHTS.lookbackWeeks * 7);

  const records = await prisma.weeklyPlanHistory.findMany({
    where: {
      userId,
      planDate: { gte: lookbackDate },
    },
    select: {
      recipeId: true,
      status: true,
      planDate: true,
    },
    orderBy: { planDate: "desc" },
  });

  return records.map((record) => ({
    recipeId: record.recipeId,
    status: record.status as "accepted" | "rejected" | "suggested",
    planDate: record.planDate,
  }));
}

async function recordUsage(
  userId: number,
  recipeId: number,
  status: "accepted" | "rejected" | "suggested"
): Promise<void> {
  await prisma.weeklyPlanHistory.create({
    data: {
      userId,
      recipeId,
      status,
      planDate: new Date(),
    },
  });
}

function calculateRecipeWeights(
  recipeIds: number[],
  history: RecipeHistory[],
  starredRecipeIds: Set<number>
): RecipeWeight[] {
  const weights: RecipeWeight[] = [];
  const historyMap = new Map<number, RecipeHistory[]>();

  history.forEach((record) => {
    if (!historyMap.has(record.recipeId)) {
      historyMap.set(record.recipeId, []);
    }
    historyMap.get(record.recipeId)!.push(record);
  });

  recipeIds.forEach((recipeId) => {
    let weight = 0;
    const reasons: string[] = [];
    const recipeHistory = historyMap.get(recipeId) || [];

    if (recipeHistory.length > 0) {
      const latestRecord = recipeHistory[0];

      switch (latestRecord.status) {
        case "accepted":
          weight += WEIGHTS.recentlyAccepted;
          reasons.push("Recently accepted");
          break;
        case "rejected":
          weight += WEIGHTS.recentlyRejected;
          reasons.push("Recently rejected");
          break;
        case "suggested":
          weight += WEIGHTS.recentlySuggested;
          reasons.push("Recently suggested");
          break;
      }
    } else {
      weight += WEIGHTS.neverUsed;
      reasons.push("Never used in weekly plans");
    }

    if (starredRecipeIds.has(recipeId)) {
      weight += WEIGHTS.starred;
      reasons.push("Starred recipe");
    }

    weights.push({
      recipeId,
      weight,
      reason: reasons.join(", "),
    });
  });

  return weights.sort((a, b) => b.weight - a.weight);
}

function buildPlannerPrompt(
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
    (recipe) =>
      `ID: ${recipe.id} | ${recipe.title} | Weight: ${recipe.weight} | Seasonal: ${(recipe.seasonalScore * 100).toFixed(0)}% | Starred: ${recipe.starred ? "Yes" : "No"}`
  )
  .join("\n")}

Return ONLY a JSON array with exactly 5 recipe IDs: [123, 456, 789, 101, 112]`;
}

function buildAlternativesPrompt(
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
  rejectedRecipeId: number,
  currentMonth: number
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

function getMonthName(month: number): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return months[month - 1];
}

function formatRecipeResponse(
  recipe: RecipeWithIngredients,
  checkedIngredients: string[]
) {
  const currentMonth = new Date().getMonth() + 1;
  const seasonalIngredients = recipe.ingredients.filter((ri) =>
    ri.ingredient.seasons.some((s) => s.month === currentMonth)
  );

  return {
    id: recipe.id,
    title: recipe.title || "Untitled Recipe",
    description: recipe.description || "",
    image: recipe.image ?? null,
    url: recipe.url,
    ingredients: recipe.ingredients.map((ri) => ({
      name: ri.ingredient.name,
      englishName: ri.ingredient.englishName,
      isSeasonal: ri.ingredient.seasons.some((s) => s.month === currentMonth),
    })),
    seasonalScore:
      seasonalIngredients.length / Math.max(recipe.ingredients.length, 1),
    healthScore: calculateHealthScore(seasonalIngredients),
    ingredientEfficiencyScore: calculateIngredientEfficiencyScore(
      seasonalIngredients,
      checkedIngredients
    ),
    reasoning: generateReasoning(recipe, seasonalIngredients, checkedIngredients),
  };
}

function calculateHealthScore(
  ingredients: RecipeIngredientWithSeason[]
): number {
  const seasonalCount = ingredients.filter((ri) =>
    ri.ingredient.seasons.some(
      (s) => s.month === new Date().getMonth() + 1
    )
  ).length;

  const varietyScore = Math.min(ingredients.length / 10, 1);
  const seasonalScore = seasonalCount / (ingredients.length || 1);

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

  const efficiencyRatio = matchingIngredients.length / (ingredients.length || 1);
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

  const matchingChecked = recipe.ingredients.filter((ri) =>
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