import { jwtVerify } from "jose";
import { normalizeQuantity, normalizeUnit } from "@/lib/ingredients";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Cache for database queries
const CACHE_MAX_AGE = 30; // 30 seconds

export async function GET(request: Request) {
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
    const token = request.headers.get("Authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );
    const userId = payload.userId as number;

    const body = await request.json();
    const { recipeIds, listId } = body;

    console.log("Request body:", { recipeIds, listId, userId });

    if (!recipeIds?.length) {
      return NextResponse.json(
        { error: "No recipes provided" },
        { status: 400 }
      );
    }

    // Get all ingredients from the selected recipes
    let recipes;
    try {
      console.log("Attempting to fetch recipes with:", { recipeIds, userId });
      recipes = await prisma.recipe.findMany({
        where: {
          id: { in: recipeIds },
          userId,
        },
        include: {
          ingredients: {
            include: {
              ingredient: true
            },
          },
        },
      });
      console.log("Found recipes:", recipes.map(r => ({ id: r.id, title: r.title })));
      console.log("Filtered recipes for user:", recipes.length);
    } catch (error) {
      const err = error as Error;
      console.error("Error fetching recipes:", {
        message: err.message,
        stack: err.stack,
        recipeIds,
        userId
      });
      throw new Error(`Failed to fetch recipes: ${err.message}`);
    }

    if (recipes.length === 0) {
      console.log("No recipes found for:", { recipeIds, userId });
      return NextResponse.json(
        { error: "No valid recipes found for the current user" },
        { status: 404 }
      );
    }

    // Define a type alias for the saved list structure
    type SavedListType = {
      id: number;
      recipes: Array<{
        id: number;
        ingredients: Array<{
          ingredient: {
            id: number;
            name: string;
            category?: string | null;
          };
          quantity?: number | null;
          unit?: string | null;
        }>;
      }>;
      ingredients: Array<{
        id: number;
        ingredient: {
          id: number;
          name: string;
          category?: string | null;
        };
        quantity: number;
        unit: string;
        category: string;
      }>;
    };

    // Define the type for savedList
    let savedList: SavedListType | null = null;
    
    if (listId) {
      // Verify the list exists and belongs to the user
      try {
        const existingList = await prisma.savedList.findFirst({
          where: {
            id: listId,
            userId,
          },
          include: {
            recipes: true,
          },
        });

        if (!existingList) {
          return NextResponse.json(
            { error: "List not found" },
            { status: 404 }
          );
        }

        // Update existing list by adding new recipes
        savedList = await prisma.savedList.update({
          where: {
            id: listId,
            userId,
          },
          data: {
            recipes: {
              connect: recipeIds.map((id: number) => ({ id })),
            },
          },
          include: {
            recipes: {
              include: {
                ingredients: {
                  include: {
                    ingredient: true
                  }
                }
              }
            },
            ingredients: {
              include: {
                ingredient: true
              }
            },
          },
        });

        // Process ingredients for existing list
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

        // Update ingredients
        if (ingredientMap.size > 0) {
          await Promise.all(
            Array.from(ingredientMap.values()).map((item) =>
              prisma.savedIngredient.upsert({
                where: {
                  savedListId_ingredientId: {
                    savedListId: savedList!.id,
                    ingredientId: item.ingredientId,
                  },
                },
                create: {
                  savedListId: savedList!.id,
                  ingredientId: item.ingredientId,
                  quantity: normalizeQuantity(item.quantity),
                  unit: normalizeUnit(item.unit),
                  category: item.category,
                  checked: false,
                },
                update: {
                  quantity: normalizeQuantity(item.quantity),
                  unit: normalizeUnit(item.unit),
                  category: item.category,
                },
              })
            )
          );
        }

        if (savedList) {
          console.log("Updated existing list:", savedList.id);
        }
      } catch (error) {
        console.error("Error updating existing list:", error);
        throw new Error("Failed to update existing list");
      }
    } else {
      // Create a new list
      try {
        savedList = await prisma.savedList.create({
          data: {
            userId,
            recipes: {
              connect: recipeIds.map((id: number) => ({ id })),
            },
          },
          include: {
            recipes: {
              include: {
                ingredients: {
                  include: {
                    ingredient: true
                  }
                }
              }
            },
            ingredients: {
              include: {
                ingredient: true
              }
            },
          },
        });

        // Process ingredients for new list
        const ingredientMap = new Map<string, {
          ingredientId: number;
          quantity: number;
          unit: string;
          category: string;
        }>();
        
        if (savedList) {
          savedList.recipes.forEach((recipe) => {
            recipe.ingredients.forEach((ri) => {
              const key = `${ri.ingredient.id}-${ri.unit}`;
              if (ingredientMap.has(key)) {
                const existing = ingredientMap.get(key)!;
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
        }

        // Create ingredients
        if (ingredientMap.size > 0) {
          await Promise.all(
            Array.from(ingredientMap.values()).map((item) =>
              prisma.savedIngredient.upsert({
                where: {
                  savedListId_ingredientId: {
                    savedListId: savedList!.id,
                    ingredientId: item.ingredientId,
                  },
                },
                create: {
                  savedListId: savedList!.id,
                  ingredientId: item.ingredientId,
                  quantity: normalizeQuantity(item.quantity),
                  unit: normalizeUnit(item.unit),
                  category: item.category,
                  checked: false,
                },
                update: {
                  quantity: normalizeQuantity(item.quantity),
                  unit: normalizeUnit(item.unit),
                  category: item.category,
                },
              })
            )
          );
        }

        if (savedList) {
          console.log("Created new list:", savedList.id);
        }
      } catch (error) {
        console.error("Error creating new list:", error);
        throw new Error("Failed to create new list");
      }
    }

    // Fetch the final state of the list
    const updatedList = await prisma.savedList.findUnique({
      where: { id: savedList!.id },
      include: {
        recipes: {
          include: {
            ingredients: {
              include: {
                ingredient: true
              }
            }
          }
        },
        ingredients: {
          include: {
            ingredient: true
          }
        },
      },
    });

    if (!updatedList) {
      throw new Error("Failed to fetch updated list");
    }

    return NextResponse.json(updatedList);
  } catch (error) {
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
    const token = request.headers.get("Authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );
    const userId = payload.userId as number;

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