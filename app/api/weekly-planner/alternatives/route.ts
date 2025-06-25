import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import anthropic from "@/app/lib/anthropic";
import { RecipeWithIngredients, RecipeIngredientWithSeason } from "@/types";

interface AlternativeRecipe {
  recipeId: number;
  reasoning: string;
  seasonalScore: number;
  healthScore: number;
  ingredientEfficiencyScore: number;
}

interface WeeklyPlanRecipe {
  id: number;
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get("Authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );
    const userId = payload.userId as number;

    const { rejectedRecipeId, currentWeeklyPlan } = await request.json();

    // Get all user's recipes with ingredients and seasonal data
    const recipes = (await prisma.recipe.findMany({
      where: { userId },
      include: {
        ingredients: {
          include: {
            ingredient: {
              include: {
                seasons: {
                  select: {
                    month: true,
                  },
                },
              },
            },
          },
        },
      },
    })) as unknown as RecipeWithIngredients[];

    // Filter out the rejected recipe and recipes already in the weekly plan
    const availableRecipes = recipes.filter(
      (recipe: RecipeWithIngredients) =>
        recipe.id !== rejectedRecipeId &&
        !currentWeeklyPlan.some(
          (planRecipe: WeeklyPlanRecipe) => planRecipe.id === recipe.id
        )
    );

    if (availableRecipes.length === 0) {
      return NextResponse.json(
        { error: "No alternative recipes available" },
        { status: 400 }
      );
    }

    const currentMonth = new Date().getMonth() + 1; // 1-12

    // Prepare recipe data for Claude analysis
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

    // Create prompt for Claude to select 3 alternative recipes
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

    // Get Claude's selection
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      temperature: 0.3,
      messages: [
        {
          role: "user",
          content: selectionPrompt,
        },
      ],
    });

    // Parse Claude's response
    // @ts-expect-error response format
    const responseText = response.content[0].text.trim();
    let selectionResult: { alternativeRecipes: AlternativeRecipe[] };

    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        selectionResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (error) {
      console.error("Error parsing Claude response:", error);
      console.error("Response text:", responseText);
      return NextResponse.json(
        { error: "Failed to analyze recipes" },
        { status: 500 }
      );
    }

    // Validate and format the response
    if (
      !selectionResult.alternativeRecipes ||
      selectionResult.alternativeRecipes.length !== 3
    ) {
      return NextResponse.json(
        { error: "Invalid recipe selection format" },
        { status: 500 }
      );
    }

    // Get the full recipe data for selected recipes
    const alternativeRecipes = selectionResult.alternativeRecipes.map(
      (selection: AlternativeRecipe) => {
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

    return NextResponse.json({
      alternatives: alternativeRecipes,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating alternatives:", error);
    return NextResponse.json(
      { error: "Failed to generate alternatives" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
