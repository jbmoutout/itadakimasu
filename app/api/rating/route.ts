import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jwtVerify } from "jose";

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

    const { recipeId } = await request.json();
    if (!recipeId) {
      return NextResponse.json(
        { error: "Recipe ID is required" },
        { status: 400 }
      );
    }

    // Check if recipe exists and belongs to user
    const recipe = await prisma.recipe.findUnique({
      where: { 
        id: recipeId,
        userId: userId
      },
      select: { starred: true },
    });

    if (!recipe) {
      return NextResponse.json(
        { error: "Recipe not found or unauthorized" },
        { status: 404 }
      );
    }

    // Toggle starred status
    const updatedRecipe = await prisma.recipe.update({
      where: { id: recipeId },
      data: { starred: !recipe.starred },
    });

    return NextResponse.json(updatedRecipe);
  } catch (error) {
    console.error("Error updating recipe star status:", error);
    return NextResponse.json(
      { error: "Failed to update recipe star status" },
      { status: 500 }
    );
  }
}
