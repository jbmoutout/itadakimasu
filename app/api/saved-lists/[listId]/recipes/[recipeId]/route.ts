import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { recomputeSavedListIngredients } from "@/lib/saved-list-recompute";

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
      where: { id: listId, userId },
    });

    if (!savedList) {
      return NextResponse.json(
        { error: "Saved list not found" },
        { status: 404 }
      );
    }

    // Disconnect the recipe and recompute the list's Saved Ingredients from the
    // recipes that remain. Recompute (not delete-by-membership) is what keeps a
    // shared ingredient's total intact when another recipe still contributes it.
    await prisma.$transaction(async (tx) => {
      await tx.savedList.update({
        where: { id: listId },
        data: { recipes: { disconnect: { id: recipeId } } },
      });
      await recomputeSavedListIngredients(tx, listId);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove recipe from saved list:", error);
    return NextResponse.json(
      { error: "Failed to remove recipe from saved list" },
      { status: 500 }
    );
  }
}
