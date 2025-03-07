import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jwtVerify } from "jose";

export async function DELETE(
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

    // Verify the recipe belongs to the user
    const recipe = await prisma.recipe.findFirst({
      where: {
        id: recipeId,
        userId,
      },
    });

    if (!recipe) {
      return NextResponse.json(
        { error: "Recipe not found or unauthorized" },
        { status: 404 }
      );
    }

    // Delete all recipe ingredients first
    await prisma.recipeIngredient.deleteMany({
      where: {
        recipeId: recipeId,
      },
    });

    // Delete the recipe
    await prisma.recipe.delete({
      where: { id: recipeId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete recipe:", error);
    return NextResponse.json(
      { error: "Failed to delete recipe" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 