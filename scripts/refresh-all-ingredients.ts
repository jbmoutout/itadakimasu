import { PrismaClient } from '@prisma/client';
import { extractIngredientsFromUrl, ExtractedIngredient } from '../app/api/extract-ingredients/extractor';
import { normalizeQuantity, normalizeUnit, shouldIncludeIngredient } from '../lib/ingredients';

const prisma = new PrismaClient();

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function refreshAllIngredients() {
  console.log('Fetching all recipes...');

  // Find all recipes
  const allRecipes = await prisma.recipe.findMany({
    include: {
      ingredients: {
        include: {
          ingredient: true
        }
      }
    }
  });

  console.log(`Found ${allRecipes.length} recipes total`);

  for (const [index, recipe] of allRecipes.entries()) {
    try {
      console.log(`\nProcessing recipe ${index + 1}/${allRecipes.length}: ${recipe.title || recipe.url}`);
      console.log(`Current ingredients: ${recipe.ingredients.length}`);
      
      // Extract ingredients from the URL
      const extractedIngredients = await extractIngredientsFromUrl(recipe.url);
      
      if (!extractedIngredients?.length) {
        console.log('No ingredients found for this recipe, skipping...');
        // Wait 2 seconds before next recipe even if this one failed
        await delay(2000);
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

      // Delete existing recipe-ingredient relationships
      await prisma.recipeIngredient.deleteMany({
        where: {
          recipeId: recipe.id
        }
      });

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
          await prisma.recipeIngredient.create({
            data: {
              recipeId: recipe.id,
              ingredientId: existingIngredient.id,
              quantity: ing.quantity,
              unit: ing.unit
            }
          });
        } catch (error) {
          console.error(`Error processing ingredient ${ing.name}:`, error);
        }
      }

      console.log(`Successfully updated recipe with ${validIngredients.length} ingredients`);
      
      // Wait 2 seconds before processing next recipe to avoid rate limits
      await delay(2000);
    } catch (error) {
      console.error(`Error processing recipe ${recipe.url}:`, error);
      // Wait 2 seconds before next recipe even if this one failed
      await delay(2000);
    }
  }
}

async function main() {
  try {
    await refreshAllIngredients();
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 