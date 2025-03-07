import { prisma } from '../lib/prisma';
import { EXCLUDED_INGREDIENTS } from '../lib/ingredients';

async function cleanExcludedIngredients() {
  try {
    // First, delete all recipe-ingredient relationships for excluded ingredients
    await prisma.recipeIngredient.deleteMany({
      where: {
        ingredient: {
          name: {
            in: Array.from(EXCLUDED_INGREDIENTS)
          }
        }
      }
    });

    // Then delete all saved-ingredient relationships for excluded ingredients
    await prisma.savedIngredient.deleteMany({
      where: {
        ingredient: {
          name: {
            in: Array.from(EXCLUDED_INGREDIENTS)
          }
        }
      }
    });

    // Finally, delete the excluded ingredients themselves
    await prisma.ingredient.deleteMany({
      where: {
        name: {
          in: Array.from(EXCLUDED_INGREDIENTS)
        }
      }
    });

    console.log('Successfully cleaned up excluded ingredients');
  } catch (error) {
    console.error('Error cleaning up excluded ingredients:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanExcludedIngredients(); 