import { NextRequest, NextResponse } from "next/server";
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
  RecipeData,
  RecipeWeight,
  RecipeIngredientWithSeason,
} from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Clean up old history records (older than 1 month)
    await cleanupWeeklyPlanHistory();

    // Get user's recipes with ingredients and seasonal data
    const recipes = (await prisma.recipe.findMany({
      where: { userId },
      include: {
        ingredients: {
          include: {
            ingredient: {
              include: {
                seasons: true,
              },
            },
          },
        },
      },
    })) as unknown as RecipeWithIngredients[];

    if (recipes.length === 0) {
      return NextResponse.json({ error: "No recipes found" }, { status: 404 });
    }

    // Get checked ingredients for better ingredient efficiency scoring
    const checkedIngredients = await prisma.shoppingList.findMany({
      where: {
        userId,
        checked: true,
      },
    });

    // Extract ingredient names from the JSON data
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

    // Get recipe history for weighting
    const history = await getRecipeHistory(userId);

    // Get starred recipe IDs
    const starredRecipeIds = new Set<number>(
      recipes
        .filter((recipe: RecipeWithIngredients) => recipe.starred)
        .map((recipe: RecipeWithIngredients) => recipe.id)
    );

    // Calculate recipe weights based on history and preferences
    const recipeWeights = calculateRecipeWeights(
      recipes.map((r: RecipeWithIngredients) => r.id),
      history,
      starredRecipeIds
    );

    // Get current month for seasonality
    const currentMonth = new Date().getMonth() + 1; // 1-12

    // Prepare recipe data for AI analysis
    const recipeData: RecipeData[] = recipes.map(
      (recipe: RecipeWithIngredients) => {
        const weight = recipeWeights.find(
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
          ingredients: recipe.ingredients.map(
            (ri: RecipeIngredientWithSeason) => ({
              name: ri.ingredient.name,
              englishName: ri.ingredient.englishName,
              isSeasonal: ri.ingredient.seasons.some(
                (season: { month: number }) => season.month === currentMonth
              ),
            })
          ),
          seasonalScore: seasonalIngredients.length / recipe.ingredients.length,
          weight: weight?.weight || 0,
          weightReason: weight?.reason || "No history",
          starred: recipe.starred,
        };
      }
    );

    // Sort recipes by weight (highest first) to prioritize better candidates
    recipeData.sort((a: RecipeData, b: RecipeData) => b.weight - a.weight);

    // Create optimized prompt for Anthropic API cost efficiency
    const prompt = `You are a French cuisine expert helping to create a weekly meal plan. Select exactly 5 recipes from the provided list that balance health, seasonality (France-based), and ingredient efficiency.

Current month: ${currentMonth} (${getMonthName(currentMonth)})
Checked ingredients (already have): ${
      checkedIngredientNames.join(", ") || "None"
    }

Recipe weights (higher = better choice):
${recipeData
  .map(
    (recipe: RecipeData) =>
      `- ${recipe.title}: ${recipe.weight} (${recipe.weightReason})`
  )
  .join("\n")}

Available recipes:
${recipeData
  .map(
    (recipe: RecipeData) => `
ID: ${recipe.id}
Title: ${recipe.title}
Description: ${recipe.description}
Ingredients: ${recipe.ingredients
      .map(
        (i: { name: string; isSeasonal: boolean }) =>
          `${i.name}${i.isSeasonal ? " (seasonal)" : ""}`
      )
      .join(", ")}
Seasonal Score: ${(recipe.seasonalScore * 100).toFixed(1)}%
Weight: ${recipe.weight}
`
  )
  .join("\n")}

Instructions:
1. Select exactly 5 recipes that provide variety and balance
2. Prioritize recipes with higher weights (avoid recently used ones)
3. Consider seasonal ingredients (marked as seasonal)
4. Use checked ingredients efficiently to reduce waste
5. Ensure nutritional balance and variety
6. Prefer recipes with higher seasonal scores

Return ONLY a JSON array with exactly 5 recipe IDs in order of preference, like: [123, 456, 789, 101, 112]`;

    // Call Anthropic API
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      temperature: 0.3,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Anthropic");
    }

    // Parse the response to extract recipe IDs
    const recipeIdsMatch = content.text.match(/\[(\d+(?:,\s*\d+)*)\]/);
    if (!recipeIdsMatch) {
      throw new Error("Could not parse recipe IDs from AI response");
    }

    const selectedRecipeIds = recipeIdsMatch[1]
      .split(",")
      .map((id) => parseInt(id.trim()));

    // Get the selected recipes with full details
    const selectedRecipes = (await prisma.recipe.findMany({
      where: {
        id: { in: selectedRecipeIds },
        userId,
      },
      include: {
        ingredients: {
          include: {
            ingredient: {
              include: {
                seasons: true,
              },
            },
          },
        },
      },
    })) as unknown as RecipeWithIngredients[];

    // Record these recipes as "suggested" in the history
    for (const recipeId of selectedRecipeIds) {
      await recordWeeklyPlanUsage(userId, recipeId, "suggested");
    }

    // Format the response
    const formattedRecipes = selectedRecipes.map(
      (recipe: RecipeWithIngredients) => {
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
          seasonalScore: seasonalIngredients.length / recipe.ingredients.length,
          healthScore: calculateHealthScore(seasonalIngredients),
          ingredientEfficiencyScore: calculateIngredientEfficiencyScore(
            seasonalIngredients,
            checkedIngredientNames
          ),
          reasoning: generateReasoning(
            recipe,
            seasonalIngredients,
            checkedIngredientNames
          ),
        };
      }
    );

    return NextResponse.json({
      recipes: formattedRecipes,
      totalRecipes: recipes.length,
      checkedIngredients: checkedIngredientNames,
    });
  } catch (error) {
    console.error("Error generating weekly plan:", error);
    return NextResponse.json(
      { error: "Failed to generate weekly plan" },
      { status: 500 }
    );
  }
}

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

function calculateHealthScore(
  ingredients: RecipeIngredientWithSeason[]
): number {
  // Simple health scoring based on ingredient variety and seasonal ingredients
  const seasonalCount = ingredients.filter((ri) =>
    ri.ingredient.seasons.some(
      (season: { month: number }) => season.month === new Date().getMonth() + 1
    )
  ).length;

  const varietyScore = Math.min(ingredients.length / 10, 1); // More ingredients = better variety
  const seasonalScore = seasonalCount / ingredients.length;

  return Math.round((varietyScore * 0.6 + seasonalScore * 0.4) * 100);
}

function calculateIngredientEfficiencyScore(
  ingredients: RecipeIngredientWithSeason[],
  checkedIngredients: string[]
): number {
  if (checkedIngredients.length === 0) return 50; // Neutral score if no checked ingredients

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
  const reasons = [];

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
