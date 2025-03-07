import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { jwtVerify } from "jose";

export async function PATCH(
  request: Request,
  { params }: { params: { recipeId: string } }
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