import type { PrismaClient } from "@prisma/client";
import type Anthropic from "@anthropic-ai/sdk";
import {
  getRecipeHistory,
  calculateRecipeWeights,
  recordWeeklyPlanUsage,
  cleanupWeeklyPlanHistory,
} from "@/lib/weekly-plan-history";
import type {
  RecipeWithIngredients,
  RecipeIngredientWithSeason,
  RecipeData,
} from "@/types";
import type { CheckedIngredientSource } from "@/lib/checked-ingredient-source";

export interface WeeklyPlanRecipe {
  id: number;
  title: string;
  description: string;
  image: string | null;
  url: string;
  starred: boolean;
  ingredients: Array<{
    name: string;
    englishName: string | null;
    isSeasonal: boolean;
  }>;
  seasonalScore: number;
  healthScore: number;
  ingredientEfficiencyScore: number;
  reasoning: string;
}

export type GenerateResult =
  | { ok: WeeklyPlanRecipe[] }
  | { fallback: WeeklyPlanRecipe[] };

export interface GenerateOptions {
  mode?: "plan" | "alternatives";
  excludeRecipeIds?: number[];
  timeoutMs?: number;
}

export interface WeeklyPlannerDeps {
  prisma: PrismaClient;
  anthropic: Anthropic;
  checkedIngredients: CheckedIngredientSource;
}

const DEFAULT_TIMEOUT_MS = 25000;
const DB_TIMEOUT_MS = 10000;
const AI_TIMEOUT_MS = 15000;
const PLAN_COUNT = 5;
const ALTERNATIVES_COUNT = 3;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Operation timed out")), timeoutMs)
    ),
  ]);
}

function getMonthName(month: number): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return months[month - 1];
}

function calculateHealthScore(
  ingredients: RecipeIngredientWithSeason[]
): number {
  const currentMonth = new Date().getMonth() + 1;
  const seasonalCount = ingredients.filter((ri) =>
    ri.ingredient.seasons.some((s) => s.month === currentMonth)
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
  const matching = ingredients.filter((ri) =>
    checkedIngredients.includes(ri.ingredient.name.toLowerCase())
  );
  return Math.round((matching.length / ingredients.length) * 100);
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

function formatRecipeResponse(
  recipe: RecipeWithIngredients,
  checkedIngredientNames: string[]
): WeeklyPlanRecipe {
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
    starred: recipe.starred,
    ingredients: recipe.ingredients.map((ri) => ({
      name: ri.ingredient.name,
      englishName: ri.ingredient.englishName ?? null,
      isSeasonal: ri.ingredient.seasons.some((s) => s.month === currentMonth),
    })),
    seasonalScore:
      seasonalIngredients.length / Math.max(recipe.ingredients.length, 1),
    healthScore: calculateHealthScore(seasonalIngredients),
    ingredientEfficiencyScore: calculateIngredientEfficiencyScore(
      recipe.ingredients,
      checkedIngredientNames
    ),
    reasoning: generateReasoning(recipe, seasonalIngredients, checkedIngredientNames),
  };
}

function buildPlanPrompt(
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
  availableRecipes: RecipeData[],
  currentMonth: number
): string {
  return `You are a culinary expert and nutritionist specializing in French seasonal cooking. A user has rejected a recipe from their weekly meal plan and needs 3 alternative options.

Current month: ${currentMonth} (France seasonal context)

CRITERIA (in order of importance):
1. HEALTH: Prioritize recipes with vegetables, lean proteins, whole grains, and balanced nutrition
2. SEASONALITY: Favor recipes with ingredients currently in season in France (month ${currentMonth})
3. INGREDIENT EFFICIENCY: Select recipes that share ingredients with the current weekly plan to minimize waste
4. VARIETY: Ensure diverse flavors, cooking methods, and cuisine types
5. USER PREFERENCES: Slightly favor starred/favorite recipes (marked as starred: true)

AVAILABLE RECIPES:
${JSON.stringify(availableRecipes, null, 2)}

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

Focus on providing diverse, healthy, and practical alternatives that complement the existing weekly plan.`;
}

async function fetchRecipes(
  prisma: PrismaClient,
  userId: number,
  excludeIds?: number[]
): Promise<RecipeWithIngredients[]> {
  const where: Record<string, unknown> = { userId };
  if (excludeIds && excludeIds.length > 0) {
    where.id = { notIn: excludeIds };
  }

  return prisma.recipe.findMany({
    where,
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
    orderBy: [
      { starred: "desc" },
      { createdAt: "desc" },
    ],
  }) as unknown as RecipeWithIngredients[];
}

async function generate(
  userId: number,
  deps: WeeklyPlannerDeps,
  options?: GenerateOptions
): Promise<GenerateResult> {
  const mode = options?.mode || "plan";
  const timeoutMs = options?.timeoutMs || DEFAULT_TIMEOUT_MS;
  const startTime = Date.now();

  const checkTimeout = () => {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error("Function timeout approaching");
    }
  };

  cleanupWeeklyPlanHistory().catch(() => {});

  checkTimeout();

  const recipes = await withTimeout(
    fetchRecipes(deps.prisma, userId, options?.excludeRecipeIds),
    DB_TIMEOUT_MS
  );

  if (recipes.length === 0) {
    throw new Error("No recipes found");
  }

  checkTimeout();

  const checkedIngredientNames = await withTimeout(
    deps.checkedIngredients.getCheckedIngredientNames(userId),
    5000
  );

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
  const count = mode === "alternatives" ? ALTERNATIVES_COUNT : PLAN_COUNT;

  const recipeData: RecipeData[] = recipes.map((recipe) => {
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
        isSeasonal: ri.ingredient.seasons.some((s) => s.month === currentMonth),
      })),
      seasonalScore:
        seasonalIngredients.length / Math.max(recipe.ingredients.length, 1),
      weight: weight?.weight || 0,
      weightReason: weight?.reason || "No history",
      starred: recipe.starred,
    };
  });

  recipeData.sort((a, b) => b.weight - a.weight);
  const topRecipes = recipeData.slice(0, 20);

  checkTimeout();

  const prompt =
    mode === "alternatives"
      ? buildAlternativesPrompt(topRecipes, currentMonth)
      : buildPlanPrompt(topRecipes, currentMonth, checkedIngredientNames);

  const aiConfig =
    mode === "alternatives"
      ? { maxTokens: 1500, temperature: 0.3 }
      : { maxTokens: 200, temperature: 0.1 };

  const response = await withTimeout(
    deps.anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: aiConfig.maxTokens,
      temperature: aiConfig.temperature,
      messages: [{ role: "user", content: prompt }],
    }),
    AI_TIMEOUT_MS
  );

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Anthropic");
  }

  let selectedRecipeIds: number[];

  if (mode === "alternatives") {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return selectFallback(topRecipes, recipes, checkedIngredientNames, count);
    }
    let parsed: { alternativeRecipes: Array<{ recipeId: number }> };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return selectFallback(topRecipes, recipes, checkedIngredientNames, count);
    }
    if (
      !parsed.alternativeRecipes ||
      parsed.alternativeRecipes.length === 0
    ) {
      return selectFallback(topRecipes, recipes, checkedIngredientNames, count);
    }
    selectedRecipeIds = parsed.alternativeRecipes
      .map((a) => a.recipeId)
      .slice(0, count);
  } else {
    const idsMatch = content.text.match(/\[(\d+(?:,\s*\d+)*)\]/);
    if (!idsMatch) {
      return selectFallback(topRecipes, recipes, checkedIngredientNames, count);
    }
    selectedRecipeIds = idsMatch[1]
      .split(",")
      .map((id) => parseInt(id.trim()))
      .filter((id) => !isNaN(id))
      .slice(0, count);
  }

  checkTimeout();

  const selectedRecipes = (await withTimeout(
    deps.prisma.recipe.findMany({
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
    selectedRecipes.map((r) =>
      recordWeeklyPlanUsage(userId, r.id, "suggested").catch(() => {})
    )
  );

  const formatted = selectedRecipes.map((r) =>
    formatRecipeResponse(r, checkedIngredientNames)
  );

  return { ok: formatted };
}

async function selectFallback(
  topRecipes: RecipeData[],
  recipes: RecipeWithIngredients[],
  checkedIngredientNames: string[],
  count: number
): Promise<GenerateResult> {
  const fallbackIds = topRecipes.slice(0, count).map((r) => r.id);
  const fallbackRecipes = recipes.filter((r) =>
    fallbackIds.includes(r.id)
  );
  const formatted = fallbackRecipes.map((r) =>
    formatRecipeResponse(r, checkedIngredientNames)
  );
  return { fallback: formatted };
}

export function createWeeklyPlanner(deps: WeeklyPlannerDeps) {
  return (userId: number, options?: GenerateOptions): Promise<GenerateResult> =>
    generate(userId, deps, options);
}
