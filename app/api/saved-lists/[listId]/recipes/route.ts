import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jwtVerify } from "jose";
import { normalizeQuantity, normalizeUnit } from "@/lib/ingredients";

export async function POST(
  request: Request,
  { params }: { params: { listId: string } }
) {
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

    const { recipeIds } = await request.json();

    // Verify the list belongs to the user
    const list = await prisma.savedList.findFirst({
      where: {
        id: parseInt(params.listId),
        userId,
      },
    });

    if (!list) {
      return NextResponse.json(
        { error: "List not found or unauthorized" },
        { status: 404 }
      );
    }

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

    // Add recipes to the list
    await prisma.savedList.update({
      where: { id: parseInt(params.listId) },
      data: {
        recipes: {
          connect: recipeIds.map((id: number) => ({ id })),
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

    // Create or update saved ingredients
    await Promise.all(
      Array.from(ingredientMap.values()).map((item) =>
        prisma.savedIngredient.upsert({
          where: {
            savedListId_ingredientId: {
              savedListId: parseInt(params.listId),
              ingredientId: item.ingredientId,
            },
          },
          create: {
            savedListId: parseInt(params.listId),
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
        })
      )
    );

    // Fetch the updated list with all related data
    const updatedList = await prisma.savedList.findUnique({
      where: { id: parseInt(params.listId) },
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
    });

    return NextResponse.json(updatedList);
  } catch (error) {
    console.error("Failed to add recipes to list:", error);
    return NextResponse.json(
      { error: "Failed to add recipes to list" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 