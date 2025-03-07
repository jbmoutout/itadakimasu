import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { normalizeQuantity, normalizeUnit } from "@/lib/ingredients";

export async function GET(request: Request) {
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

    const lists = await prisma.savedList.findMany({
      where: { userId },
      include: {
        recipes: {
          include: {
            ingredients: {
              include: {
                ingredient: true,
              },
            },
          },
        },
        ingredients: {
          include: {
            ingredient: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(lists);
  } catch (error) {
    console.error("Failed to fetch saved lists:", error);
    return NextResponse.json(
      { error: "Failed to fetch saved lists" },
      { status: 500 }
    );
  }
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

    const body = await request.json();
    const { recipeIds } = body;

    // Get all ingredients from the selected recipes
    const recipes = await prisma.recipe.findMany({
      where: {
        id: { in: recipeIds },
        userId,
      },
      include: {
        ingredients: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    // Create a new saved list
    const savedList = await prisma.savedList.create({
      data: {
        userId,
        recipes: {
          connect: recipeIds.map((id: number) => ({ id })),
        },
      },
      include: {
        recipes: true,
        ingredients: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    // Merge and categorize ingredients
    const ingredientMap = new Map();
    recipes.forEach((recipe) => {
      recipe.ingredients.forEach((ri) => {
        const key = `${ri.ingredient.id}-${ri.unit}`;
        if (ingredientMap.has(key)) {
          const existing = ingredientMap.get(key);
          existing.quantity += ri.quantity || 0;
        } else {
          ingredientMap.set(key, {
            ingredientId: ri.ingredient.id,
            quantity: ri.quantity || 0,
            unit: ri.unit || "unit",
            category: ri.ingredient.category || "groceries",
          });
        }
      });
    });

    // Create saved ingredients
    const savedIngredients = await Promise.all(
      Array.from(ingredientMap.values()).map((item) =>
        prisma.savedIngredient.upsert({
          where: {
            savedListId_ingredientId: {
              savedListId: savedList.id,
              ingredientId: item.ingredientId,
            },
          },
          create: {
            savedListId: savedList.id,
            ingredientId: item.ingredientId,
            quantity: normalizeQuantity(item.quantity),
            unit: normalizeUnit(item.unit),
            category: item.category,
          },
          update: {
            quantity: normalizeQuantity(item.quantity),
            unit: normalizeUnit(item.unit),
            category: item.category,
          },
          include: {
            ingredient: true,
          },
        })
      )
    );

    return NextResponse.json({
      id: savedList.id,
      name: savedList.name,
      createdAt: savedList.createdAt,
      userId: savedList.userId,
      recipes: savedList.recipes,
      ingredients: savedIngredients.map(ing => ({
        ...ing,
        ingredient: ing.ingredient
      })),
    });
  } catch (error) {
    console.error("Failed to create saved list:", error);
    return NextResponse.json(
      { error: "Failed to create saved list" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
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

    const body = await request.json();
    const { ingredientId, checked } = body;

    const ingredient = await prisma.savedIngredient.findFirst({
      where: { 
        id: ingredientId,
        savedList: { userId }
      },
      include: {
        ingredient: true,
      },
    });

    if (!ingredient) {
      return NextResponse.json({ error: "Ingredient not found" }, { status: 404 });
    }

    const updatedIngredient = await prisma.savedIngredient.update({
      where: { id: ingredientId },
      data: { checked },
      include: {
        ingredient: true,
      },
    });

    return NextResponse.json(updatedIngredient);
  } catch (error) {
    console.error("Failed to update ingredient:", error);
    return NextResponse.json(
      { error: "Failed to update ingredient" },
      { status: 500 }
    );
  }
} 