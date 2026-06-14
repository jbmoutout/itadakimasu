import { getUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recomputeSavedListIngredients } from "@/lib/saved-list-recompute";
import { NextResponse } from "next/server";

// Cache for database queries
const CACHE_MAX_AGE = 30; // 30 seconds

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);

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
      // Add take limit to prevent loading too many lists
      take: 10,
    });

    const response = NextResponse.json(lists);

    // Add cache control headers
    response.headers.set('Cache-Control', `public, s-maxage=${CACHE_MAX_AGE}, stale-while-revalidate`);

    return response;
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
    const userId = getUserId(request);

    const body = await request.json();
    const { recipeIds, listId } = body;

    if (!recipeIds?.length) {
      return NextResponse.json(
        { error: "No recipes provided" },
        { status: 400 }
      );
    }

    // Ownership guard: every requested recipe must belong to the caller before
    // it is connected to a list. Reject the whole request otherwise — never
    // connect a recipe the user does not own.
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
    // its recipes (Aggregation, see CONTEXT.md). One transaction so the recipe
    // set and its projection commit together.
    const savedListId = await prisma.$transaction(async (tx) => {
      if (listId) {
        const existingList = await tx.savedList.findFirst({
          where: { id: listId, userId },
          select: { id: true },
        });

        if (!existingList) {
          throw new ListNotFoundError();
        }

        await tx.savedList.update({
          where: { id: listId },
          data: {
            recipes: { connect: requestedIds.map((id) => ({ id })) },
          },
        });

        await recomputeSavedListIngredients(tx, listId);
        return listId as number;
      }

      const created = await tx.savedList.create({
        data: {
          userId,
          recipes: { connect: requestedIds.map((id) => ({ id })) },
        },
        select: { id: true },
      });

      await recomputeSavedListIngredients(tx, created.id);
      return created.id;
    });

    // Fetch the final state of the list
    const updatedList = await prisma.savedList.findUnique({
      where: { id: savedListId },
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

    if (!updatedList) {
      throw new Error("Failed to fetch updated list");
    }

    return NextResponse.json(updatedList);
  } catch (error) {
    if (error instanceof ListNotFoundError) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }
    const err = error as Error;
    console.error("Failed to create/update saved list:", {
      error: err.message,
      stack: err.stack,
    });
    return NextResponse.json(
      { error: err.message || "Failed to create/update saved list" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = getUserId(request);

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

// Signals a missing/unauthorized list from inside the POST transaction so the
// handler can return 404 rather than a generic 500.
class ListNotFoundError extends Error {}
