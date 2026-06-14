import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { recomputeSavedListIngredients } from "@/lib/saved-list-recompute";

export async function POST(
  request: Request,
  { params }: { params: { listId: string } }
) {
  try {
    const userId = getUserId(request);

    const { recipeIds } = await request.json();
    const listId = parseInt(params.listId);

    if (!recipeIds?.length) {
      return NextResponse.json(
        { error: "No recipes provided" },
        { status: 400 }
      );
    }

    // Verify the list belongs to the user
    const list = await prisma.savedList.findFirst({
      where: { id: listId, userId },
    });

    if (!list) {
      return NextResponse.json(
        { error: "List not found or unauthorized" },
        { status: 404 }
      );
    }

    // Ownership guard: every requested recipe must belong to the caller before
    // it is connected to the list. Reject the whole request otherwise.
    const requestedIds = Array.from(new Set<number>(recipeIds));
    const ownedRecipes = await prisma.recipe.findMany({
      where: { id: { in: requestedIds }, userId },
      select: { id: true },
    });

    if (ownedRecipes.length !== requestedIds.length) {
      return NextResponse.json(
        { error: "No valid recipes found for the current user" },
        { status: 404 }
      );
    }

    // Connect the recipes and recompute the list's Saved Ingredients from all of
    // its recipes — recompute-from-truth, so totals accumulate across the whole
    // list rather than being overwritten by the newly-added subset.
    await prisma.$transaction(async (tx) => {
      await tx.savedList.update({
        where: { id: listId },
        data: {
          recipes: { connect: requestedIds.map((id) => ({ id })) },
        },
      });
      await recomputeSavedListIngredients(tx, listId);
    });

    // Fetch the updated list with all related data
    const updatedList = await prisma.savedList.findUnique({
      where: { id: listId },
      include: {
        recipes: {
          include: {
            ingredients: { include: { ingredient: true } },
          },
        },
        ingredients: { include: { ingredient: true } },
      },
    });

    return NextResponse.json(updatedList);
  } catch (error) {
    console.error("Failed to add recipes to list:", error);
    return NextResponse.json(
      { error: "Failed to add recipes to list" },
      { status: 500 }
    );
  }
}
