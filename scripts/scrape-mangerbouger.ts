import { chromium, Page } from 'playwright';
import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface SeasonalIngredient {
  frenchName: string;
  englishName: string;
  months: number[];
}

interface SeasonalData {
  fruits: SeasonalIngredient[];
  vegetables: SeasonalIngredient[];
}

const MONTHS = [
  { name: 'janvier', url: 'janvier' },
  { name: 'fevrier', url: 'fevrier' },
  { name: 'mars', url: 'mars' },
  { name: 'avril', url: 'avril' },
  { name: 'mai', url: 'mai' },
  { name: 'juin', url: 'juin' },
  { name: 'juillet', url: 'juillet' },
  { name: 'aout', url: 'aout' },
  { name: 'septembre', url: 'septembre' },
  { name: 'octobre', url: 'octobre' },
  { name: 'novembre', url: 'novembre' },
  { name: 'decembre', url: 'decembre' }
];

async function translateIngredients(frenchNames: string[]): Promise<Map<string, string>> {
  console.log('Translating ingredients...');
  const translations = new Map<string, string>();
  
  // First, check for existing translations in the database
  const existingIngredients = await prisma.ingredient.findMany({
    where: {
      OR: frenchNames.map(name => ({ name: name.toLowerCase() }))
    }
  });

  // Add existing translations to our map
  existingIngredients.forEach(ingredient => {
    translations.set(ingredient.name.toLowerCase(), ingredient.name);
  });

  // Get names that need translation
  const namesToTranslate = frenchNames.filter(name => 
    !translations.has(name.toLowerCase())
  );

  if (namesToTranslate.length > 0) {
    try {
      const prompt = `Translate these French ingredient names to English. Only respond with the English translations, one per line, in the same order:
${namesToTranslate.join('\n')}`;

      const response = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }]
      });

      // Cast the response content to access the text
      const englishNames = (response.content[0] as { text: string }).text
        .trim()
        .split('\n')
        .map((name: string) => name.trim())
        .filter((name: string) => name.length > 0);

      // Add new translations to our map
      namesToTranslate.forEach((frenchName: string, index: number) => {
        if (englishNames[index]) {
          translations.set(frenchName.toLowerCase(), englishNames[index].toLowerCase());
        }
      });
    } catch (error) {
      console.error('Error translating ingredients:', error);
      // If translation fails, use French names as fallback
      namesToTranslate.forEach((name: string) => {
        translations.set(name.toLowerCase(), name.toLowerCase());
      });
    }
  }

  return translations;
}

async function cleanupSeasonalData() {
  console.log('Cleaning up existing seasonal data...');
  
  try {
    // Delete all existing IngredientSeason records
    await prisma.ingredientSeason.deleteMany({});
    console.log('Successfully cleaned up seasonal data');
  } catch (error) {
    console.error('Error cleaning up seasonal data:', error);
    throw error;
  }
}

async function tryUrl(page: Page, monthUrl: string, urlFormat: 'de' | 'd'): Promise<string[]> {
  await page.goto(`https://www.mangerbouger.fr/manger-mieux/bien-manger-sans-se-ruiner/calendrier-de-saison/les-fruits-et-legumes-${urlFormat}-${monthUrl}`, {
    timeout: 60000
  });
  
  await page.waitForSelector('.Category-items', { timeout: 60000 });
  
  return page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.Category-items > li'));
    return items
      .map(item => item.textContent?.trim())
      .filter(text => text && text.length > 0) as string[];
  });
}

async function scrapeMonth(monthUrl: string, retryCount = 0): Promise<string[]> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    try {
      // First try with 'de-'
      return await tryUrl(page, monthUrl, 'de');
    } catch {
      console.log(`Failed with 'de-' format, trying 'd-' format...`);
      // If that fails, try with 'd-'
      return await tryUrl(page, monthUrl, 'd');
    }
  } catch (error) {
    if (retryCount < 3) {
      console.log(`Retrying ${monthUrl} (attempt ${retryCount + 1})...`);
      await browser.close();
      return scrapeMonth(monthUrl, retryCount + 1);
    }
    throw error;
  } finally {
    await browser.close();
  }
}

async function scrapeAllMonths(): Promise<Map<string, number[]>> {
  const ingredientMonths = new Map<string, number[]>();
  
  for (let i = 0; i < MONTHS.length; i++) {
    const month = MONTHS[i];
    console.log(`Scraping ${month.name}...`);
    
    try {
      const ingredients = await scrapeMonth(month.url);
      console.log(`Found ${ingredients.length} ingredients for ${month.name}`);
      
      // For each ingredient found this month, update its months array
      ingredients.forEach(ingredient => {
        const months = ingredientMonths.get(ingredient) || [];
        if (!months.includes(i + 1)) {
          months.push(i + 1);
        }
        ingredientMonths.set(ingredient, months);
      });
    } catch (error) {
      console.error(`Error scraping ${month.name}:`, error);
    }
  }
  
  return ingredientMonths;
}

async function saveSeasonalData(ingredientMonths: Map<string, number[]>, translations: Map<string, string>) {
  console.log('Saving seasonal data to database...');
  
  try {
    for (const [frenchName, months] of Array.from(ingredientMonths)) {
      const englishName = translations.get(frenchName.toLowerCase());
      if (!englishName) {
        console.warn(`No translation found for ${frenchName}, skipping...`);
        continue;
      }

      // Find or create the ingredient
      const ingredient = await prisma.ingredient.upsert({
        where: { name: englishName },
        create: { name: englishName },
        update: {}
      });

      // Create or update seasonal records for each month
      for (const month of months) {
        await prisma.ingredientSeason.upsert({
          where: {
            ingredientId_month: {
              ingredientId: ingredient.id,
              month
            }
          },
          create: {
            ingredientId: ingredient.id,
            month
          },
          update: {}
        });
      }
    }
    
    console.log('Successfully saved seasonal data to database');
  } catch (error) {
    console.error('Error saving seasonal data:', error);
    throw error;
  }
}

async function main() {
  try {
    // Clean up existing data first
    await cleanupSeasonalData();

    console.log('Starting to scrape seasonal data...');
    const ingredientMonths = await scrapeAllMonths();
    
    // Get translations for all ingredients
    const translations = await translateIngredients(Array.from(ingredientMonths.keys()));
    
    // Save to database
    await saveSeasonalData(ingredientMonths, translations);
    
    // Also save to JSON file for reference
    const seasonalData: SeasonalData = {
      fruits: [],
      vegetables: []
    };

    for (const [frenchName, months] of Array.from(ingredientMonths)) {
      const englishName = translations.get(frenchName.toLowerCase());
      if (englishName) {
        seasonalData.vegetables.push({
          frenchName,
          englishName,
          months: months.sort((a, b) => a - b)
        });
      }
    }
    
    const outputPath = path.join(__dirname, 'scraped-seasonal-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(seasonalData, null, 2));
    
    console.log(`Done! Processed ${ingredientMonths.size} ingredients`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 