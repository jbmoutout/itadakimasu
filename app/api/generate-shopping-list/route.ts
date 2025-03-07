import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { jwtVerify } from "jose";
import convert, { Unit } from "convert-units";
import { Recipe } from "@prisma/client";

const convertToBaseUnit = (
  quantity: number,
  unit: string
): { quantity: number; unit: string } => {
  try {
    // Common volume units
    if (["ml", "l", "cup", "tbsp", "tsp"].includes(unit)) {
      const unitMap: { [key: string]: Unit } = {
        ml: "ml",
        l: "l",
        cup: "cup",
        tbsp: "Tbs",
        tsp: "tsp",
      } as const;
      return {
        quantity: convert(quantity).from(unitMap[unit]).to("ml"),
        unit: "ml",
      };
    }
    // Common weight units
    if (["g", "kg", "oz", "lb"].includes(unit)) {
      const weightMap: { [key: string]: Unit } = {
        g: "g",
        kg: "kg",
        oz: "oz",
        lb: "lb",
      } as const;
      return {
        quantity: convert(quantity).from(weightMap[unit]).to("g"),
        unit: "g",
      };
    }
    // If unit is not convertible, return as is
    return { quantity, unit };
  } catch (error) {
    // If conversion fails, return original values
    console.log(error);
    return { quantity, unit };
  }
};

export async function POST(request: Request) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendLog = async (log: string) => {
    await writer.write(encoder.encode(JSON.stringify({ log }) + "\n"));
  };

  const generateShoppingList = async () => {
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

      const { recipeIds } = await request.json();
      if (!recipeIds || !Array.isArray(recipeIds)) {
        throw new Error("Recipe IDs are required");
      }

      await sendLog("Fetching recipes from database...");
      const recipes = await prisma.recipe.findMany({
        where: {
          id: {
            in: recipeIds,
          },
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

      await sendLog(`Found ${recipes.length} recipes.`);

      // Create shopping list structure
      const shoppingListData: {
        selectedRecipes: Recipe[];
        items: Array<{
          ingredient: string;
          quantity: number;
          unit: string;
          recipes: string;
        }>;
      } = {
        selectedRecipes: recipes,
        items: [],
      };

      // Process ingredients from all recipes
      const ingredientMap = new Map();

      const normalizeIngredientName = (name: string): string => {
        return name.toLowerCase().trim();
      };

      for (const recipe of recipes) {
        for (const recipeIngredient of recipe.ingredients) {
          const { ingredient, quantity, unit } = recipeIngredient;
          const normalizedName = normalizeIngredientName(ingredient.name);

          // Use only the normalized name as key (removing unit from key)
          const key = normalizedName;

          if (ingredientMap.has(key)) {
            const existing = ingredientMap.get(key);
            const converted = convertToBaseUnit(
              quantity || 0,
              (unit || "unit").toLowerCase()
            );
            const existingConverted = convertToBaseUnit(
              existing.quantity,
              existing.unit
            );

            if (converted.unit === existingConverted.unit) {
              existing.quantity =
                existingConverted.quantity + converted.quantity;
              existing.unit = converted.unit;
            } else {
              // If units can't be converted, keep them separate with a '+'
              existing.quantity = existing.quantity;
              existing.unit = `${existing.unit} + ${quantity}${unit || "unit"}`;
            }

            existing.recipes.add(recipe.title || recipe.url);
            if (!existing.nameCounts[ingredient.name]) {
              existing.nameCounts[ingredient.name] = 1;
            } else {
              existing.nameCounts[ingredient.name]++;
            }
            const mostFrequentName = Object.entries<number>(
              existing.nameCounts
            ).reduce<[string, number]>(
              (a, b) => (a[1] > b[1] ? a : b),
              ["", 0]
            )[0];
            existing.ingredient = mostFrequentName;
          } else {
            const converted = convertToBaseUnit(
              quantity || 0,
              (unit || "unit").toLowerCase()
            );
            ingredientMap.set(key, {
              ingredient: ingredient.name,
              quantity: Number(converted.quantity.toFixed(2)),
              unit: converted.unit,
              recipes: new Set([recipe.title || recipe.url]),
              nameCounts: { [ingredient.name]: 1 },
            });
          }
        }
      }

      // Convert the Map to the final shopping list format
      shoppingListData.items = Array.from(ingredientMap.values()).map(
        (item) => ({
          ingredient: item.ingredient,
          quantity: item.quantity,
          unit: item.unit,
          recipes: Array.from(item.recipes).join(", "),
        })
      );

      await sendLog("Shopping list generated successfully.");

      await sendLog("Saving shopping list to database...");
      await prisma.shoppingList.create({
        data: {
          data: shoppingListData,
          userId: userId,
        },
      });
      await sendLog("Shopping list saved to database.");

      await writer.write(
        encoder.encode(
          JSON.stringify({ shoppingList: shoppingListData }) + "\n"
        )
      );
    } catch (error) {
      await sendLog(`Error: ${error}`);
    } finally {
      await writer.close();
    }
  };

  generateShoppingList();

  return new NextResponse(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
