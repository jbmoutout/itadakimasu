import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getUserId } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: { recipeId: string } }
) {
  try {
    const userId = getUserId(request);

    const recipeId = parseInt(params.recipeId);

    // Get current recipe to toggle starred status
    const recipe = await prisma.recipe.findFirst({
      where: {
        id: recipeId,
        userId: userId,
      },
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

    // Update the recipe's starred status
    const updatedRecipe = await prisma.recipe.update({
      where: { id: recipeId },
      data: { starred: !recipe.starred },
      include: {
        ingredients: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    return NextResponse.json(updatedRecipe);
  } catch (error) {
    console.error("Failed to update recipe star:", error);
    return NextResponse.json(
      { error: "Failed to update recipe star" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 