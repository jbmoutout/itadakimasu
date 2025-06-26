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

// Add timeout configuration
const FUNCTION_TIMEOUT = 25000; // 25 seconds (5 seconds buffer before Vercel's 30s limit)
const API_TIMEOUT = 15000; // 15 seconds for external API calls

// Timeout wrapper for async operations
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    ),
  ]);
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Check if we're approaching timeout
    const checkTimeout = () => {
      if (Date.now() - startTime > FUNCTION_TIMEOUT) {
        throw new Error('Function timeout approaching');
      }
    };

    // Clean up old history records (with timeout) - make this non-blocking
    cleanupWeeklyPlanHistory().catch(error => {
      console.error("Cleanup failed:", error);
    });

    checkTimeout();

    // Optimize database query - limit and select only necessary fields
    const recipes = await withTimeout(
      prisma.recipe.findMany({
        where: { userId },
        take: 100, // Limit to first 100 recipes to prevent excessive processing
        include: {
          ingredients: {
            take: 20, // Limit ingredients per recipe
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
          { starred: 'desc' }, // Prioritize starred recipes
          { createdAt: 'desc' }
        ]
      }),
      10000 // 10 second timeout for DB query
    ) as unknown as RecipeWithIngredients[];

    if (recipes.length === 0) {
      return NextResponse.json({ error: "No recipes found" }, { status: 404 });
    }

    checkTimeout();

    // Get checked ingredients with timeout
    const checkedIngredients = await withTimeout(
      prisma.shoppingList.findMany({
        where: {
          userId,
          checked: true,
        },
        take: 50, // Limit to prevent excessive processing
      }),
      5000 // 5 second timeout
    );

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

    checkTimeout();

    // Get recipe history with timeout
    const history = await withTimeout(
      getRecipeHistory(userId),
      5000 // 5 second timeout
    );

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

    checkTimeout();

    // Get current month for seasonality
    const currentMonth = new Date().getMonth() + 1; // 1-12

    // Prepare recipe data for AI analysis - limit to top 20 recipes by weight
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
          ingredients: recipe.ingredients.slice(0, 10).map( // Limit ingredients to reduce prompt size
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

    // Sort recipes by weight and take top 20 to reduce prompt size
    recipeData.sort((a: RecipeData, b: RecipeData) => b.weight - a.weight);
    const topRecipes = recipeData.slice(0, 20);

    checkTimeout();

    // Create optimized prompt for Anthropic API cost efficiency
    const prompt = `You are a French cuisine expert. Select exactly 5 recipes from these ${topRecipes.length} options for a weekly meal plan.

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

    checkTimeout();

    // Call Anthropic API with timeout
    const response = await withTimeout(
      anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 200, // Reduced to speed up response
        temperature: 0.1, // Lower temperature for more deterministic results
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

    // Parse the response to extract recipe IDs
    const recipeIdsMatch = content.text.match(/\[(\d+(?:,\s*\d+)*)\]/);
    if (!recipeIdsMatch) {
      // Fallback: select top 5 recipes by weight if AI parsing fails
      const fallbackIds = topRecipes.slice(0, 5).map(r => r.id);
      console.warn("AI parsing failed, using fallback selection:", fallbackIds);
      
      const fallbackRecipes = recipes.filter(r => fallbackIds.includes(r.id));
      
      return NextResponse.json({
        recipes: fallbackRecipes.map(formatRecipeResponse),
        totalRecipes: recipes.length,
        checkedIngredients: checkedIngredientNames,
        fallbackUsed: true,
      });
    }

    const selectedRecipeIds = recipeIdsMatch[1]
      .split(",")
      .map((id) => parseInt(id.trim()))
      .filter(id => !isNaN(id))
      .slice(0, 5); // Ensure we only get 5 recipes max

    checkTimeout();

    // Get the selected recipes with full details
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

    // Record these recipes as "suggested" in the history (non-blocking)
    Promise.all(
      selectedRecipeIds.map(recipeId =>
        recordWeeklyPlanUsage(userId, recipeId, "suggested").catch(error => {
          console.error(`Failed to record usage for recipe ${recipeId}:`, error);
        })
      )
    );

    // Format the response
    const formattedRecipes = selectedRecipes.map(formatRecipeResponse);

    return NextResponse.json({
      recipes: formattedRecipes,
      totalRecipes: recipes.length,
      checkedIngredients: checkedIngredientNames,
      processingTime: Date.now() - startTime,
    });
  } catch (error) {
    console.error("Error generating weekly plan:", error);
    
    // Return a more specific error message
    if (error instanceof Error && error.message.includes('timeout')) {
      return NextResponse.json(
        { 
          error: "Request timed out. Please try again.", 
          timeout: true,
          processingTime: Date.now() - startTime 
        },
        { status: 504 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to generate weekly plan" },
      { status: 500 }
    );
  }
}

// Helper function to format recipe response
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
