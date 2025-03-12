import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface SeasonalIngredient {
  frenchName: string;
  englishName: string;
  months: number[];
}

interface SeasonalData {
  fruits: SeasonalIngredient[];
  vegetables: SeasonalIngredient[];
}

async function loadSeasonalData(): Promise<SeasonalIngredient[]> {
  const filePath = path.join(__dirname, 'seasonal-data.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as SeasonalData;
  return [...data.fruits, ...data.vegetables];
}

async function updateDatabase(ingredients: SeasonalIngredient[]) {
  // Get existing ingredients for comparison
  const existingIngredients = await prisma.ingredient.findMany({
    select: {
      id: true,
      name: true,
      englishName: true,
      frenchName: true,
    }
  });

  for (const ingredient of ingredients) {
    try {
      // Try to find existing ingredient by any unique field
      const existingIngredient = existingIngredients.find(
        e => e.name === ingredient.englishName ||
             e.englishName === ingredient.englishName ||
             e.frenchName === ingredient.frenchName
      );

      let dbIngredient;
      if (existingIngredient) {
        // Update existing ingredient
        dbIngredient = await prisma.ingredient.update({
          where: { id: existingIngredient.id },
          data: {
            englishName: ingredient.englishName,
            frenchName: ingredient.frenchName,
          },
        });
      } else {
        // Create new ingredient
        dbIngredient = await prisma.ingredient.create({
          data: {
            name: ingredient.englishName,
            englishName: ingredient.englishName,
            frenchName: ingredient.frenchName,
          },
        });

        // Add to our local cache to maintain uniqueness
        existingIngredients.push({
          id: dbIngredient.id,
          name: ingredient.englishName,
          englishName: ingredient.englishName,
          frenchName: ingredient.frenchName,
        });
      }

      // Delete existing seasonal data
      await prisma.ingredientSeason.deleteMany({
        where: { ingredientId: dbIngredient.id }
      });

      // Create seasonal data only for months when the ingredient is in season
      for (const month of ingredient.months) {
        await prisma.ingredientSeason.create({
          data: {
            ingredientId: dbIngredient.id,
            month: month,
          },
        });
      }

      console.log(`Processed ingredient: ${ingredient.frenchName} -> ${dbIngredient.name}`);
    } catch (error) {
      console.error(`Error processing ingredient ${ingredient.frenchName}:`, error);
    }
  }
}

async function main() {
  try {
    console.log('Loading seasonal data...');
    const ingredients = await loadSeasonalData();
    
    console.log('Updating database...');
    await updateDatabase(ingredients);
    
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 