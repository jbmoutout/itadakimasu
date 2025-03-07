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

    // Find all recipes for the user
    const recipes = await prisma.recipe.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    // Create a map to track unique URLs and their recipe IDs
    const urlMap = new Map<string, number[]>();
    recipes.forEach((recipe) => {
      const urls = urlMap.get(recipe.url) || [];
      urls.push(recipe.id);
      urlMap.set(recipe.url, urls);
    });

    // Find duplicates (URLs with multiple recipe IDs)
    const duplicates = Array.from(urlMap.entries())
      .filter(([, ids]) => ids.length > 1)
      .map(([url, ids]) => ({
        url,
        ids,
      }));

    // Keep the most recently created recipe for each URL
    // and delete the others
    const deletedRecipes = [];
    for (const { url, ids } of duplicates) {
      // Keep the first ID (most recent due to orderBy)
      const [keepId, ...deleteIds] = ids;
      
      // Delete the duplicate recipes
      await prisma.recipe.deleteMany({
        where: {
          id: { in: deleteIds },
        },
      });

      deletedRecipes.push({
        url,
        keptId: keepId,
        deletedIds: deleteIds,
      });
    }

    return NextResponse.json({
      success: true,
      deletedRecipes,
      totalDuplicates: duplicates.length,
    });
  } catch (error) {
    console.error("Failed to remove duplicate recipes:", error);
    return NextResponse.json(
      { error: "Failed to remove duplicate recipes" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 