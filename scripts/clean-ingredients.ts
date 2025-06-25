import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";

const prisma = new PrismaClient();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function validateIngredient(name: string): Promise<boolean> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `You are a culinary expert. Evaluate if this is a valid single ingredient name: "${name}".
          Consider these rules:
          - Must be a single, specific ingredient (not a list or combination)
          - Common fruits, vegetables, herbs, and spices are valid
          - Basic pantry items are valid
          - Terms containing "and" or commas are likely lists and should be invalid
          - General categories like "vegetables" alone are invalid
          - But specific items like "brussels sprouts" or "red cabbage" are valid
          
          Return ONLY "true" if it's a valid single ingredient, or "false" if it's a list/combination.
          Examples:
          - "grain and legume" -> false (contains "and")
          - "vegetables, honeybee, garlic" -> false (contains commas)
          - "brussels sprouts" -> true (single specific ingredient)
          - "red cabbage" -> true (single specific ingredient)
          - "vegetables" -> false (general category)
          - "carrot" -> true (single specific ingredient)`,
        },
      ],
    });

    // @ts-expect-error response format
    const result = response.content[0].text.toLowerCase().trim();
    return result === "true";
  } catch (error) {
    console.error(`Error validating ingredient ${name}:`, error);
    return true; // In case of error, keep the ingredient
  }
}

async function cleanIngredients() {
  // Get all ingredients that are not used in any recipe
  const unusedIngredients = await prisma.ingredient.findMany({
    where: {
      recipes: {
        none: {},
      },
    },
    include: {
      seasons: true,
    },
  });

  console.log(`Found ${unusedIngredients.length} unused ingredients`);

  for (const ingredient of unusedIngredients) {
    try {
      const isValid = await validateIngredient(ingredient.name);

      if (!isValid) {
        // Delete the ingredient and its seasonal data
        await prisma.ingredientSeason.deleteMany({
          where: { ingredientId: ingredient.id },
        });

        await prisma.ingredient.delete({
          where: { id: ingredient.id },
        });

        console.log(`Deleted invalid ingredient: ${ingredient.name}`);
      } else {
        console.log(`Kept valid ingredient: ${ingredient.name}`);
      }
    } catch (error) {
      console.error(`Error processing ingredient ${ingredient.name}:`, error);
    }
  }
}

async function main() {
  try {
    console.log("Starting database cleanup...");
    await cleanIngredients();
    console.log("Done!");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
