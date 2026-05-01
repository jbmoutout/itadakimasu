import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { getUserId } from "@/lib/auth";

export async function DELETE(
  request: Request,
  { params }: { params: { listId: string; recipeId: string } }
) {
  try {
    const userId = getUserId(request);

    const listId = parseInt(params.listId);
    const recipeId = parseInt(params.recipeId);

    // Verify the saved list belongs to the user
    const savedList = await prisma.savedList.findFirst({
      where: {
        id: listId,
        userId: userId,
      },
      include: {
        ingredients: true,
      },
    });

    if (!savedList) {
      return NextResponse.json(
        { error: "Saved list not found" },
        { status: 404 }
      );
    }

    // Get the recipe's ingredients
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        ingredients: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    if (!recipe) {
      return NextResponse.json(
        { error: "Recipe not found" },
        { status: 404 }
      );
    }

    // Remove ingredients that were added by this recipe
    const recipeIngredientIds = recipe.ingredients.map(ri => ri.ingredientId);
    await prisma.savedIngredient.deleteMany({
      where: {
        savedListId: listId,
        ingredientId: {
          in: recipeIngredientIds,
        },
      },
    });

    // Remove the recipe from the saved list
    await prisma.savedList.update({
      where: { id: listId },
      data: {
        recipes: {
          disconnect: { id: recipeId },
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove recipe from saved list:", error);
    return NextResponse.json(
      { error: "Failed to remove recipe from saved list" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 