import { PrismaClient } from '@prisma/client';
import { extractIngredientsFromUrl, ExtractedIngredient } from '../app/api/extract-ingredients/extractor';
import { normalizeQuantity, normalizeUnit, shouldIncludeIngredient } from '../lib/ingredients';

const prisma = new PrismaClient();

async function fixMissingIngredients() {
  console.log('Looking for recipes without ingredients...');

  // Find recipes that have no ingredients
  const recipesWithoutIngredients = await prisma.recipe.findMany({
    where: {
      ingredients: {
        none: {}
      }
    },
    include: {
      ingredients: true
    }
  });

  console.log(`Found ${recipesWithoutIngredients.length} recipes without ingredients`);

  for (const recipe of recipesWithoutIngredients) {
    try {
      console.log(`\nProcessing recipe: ${recipe.title || recipe.url}`);
      
      // Extract ingredients from the URL
      const extractedIngredients = await extractIngredientsFromUrl(recipe.url);
      
      if (!extractedIngredients?.length) {
        console.log('No ingredients found for this recipe, skipping...');
        continue;
      }

      // Filter and normalize ingredients
      const validIngredients = extractedIngredients
        .filter((ing: ExtractedIngredient) => shouldIncludeIngredient(ing.name))
        .map((ing: ExtractedIngredient) => ({
          ...ing,
          name: ing.name.trim(),
          quantity: ing.quantity === null ? 0 : normalizeQuantity(ing.quantity),
          unit: normalizeUnit(ing.unit || ''),
        }));

      console.log(`Found ${validIngredients.length} valid ingredients`);

      // Create ingredients and recipe-ingredient relationships
      for (const ing of validIngredients) {
        try {
          // Find or create ingredient
          const existingIngredient = await prisma.ingredient.upsert({
            where: { name: ing.name },
            create: { name: ing.name },
            update: {}
          });

          // Create recipe-ingredient relationship
          await prisma.recipeIngredient.upsert({
            where: {
              recipeId_ingredientId: {
                recipeId: recipe.id,
                ingredientId: existingIngredient.id
              }
            },
            create: {
              recipeId: recipe.id,
              ingredientId: existingIngredient.id,
              quantity: ing.quantity,
              unit: ing.unit
            },
            update: {
              quantity: ing.quantity,
              unit: ing.unit
            }
          });
        } catch (error) {
          console.error(`Error processing ingredient ${ing.name}:`, error);
        }
      }

      console.log(`Successfully updated recipe with ${validIngredients.length} ingredients`);
    } catch (error) {
      console.error(`Error processing recipe ${recipe.url}:`, error);
    }
  }
}

async function main() {
  try {
    await fixMissingIngredients();
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 