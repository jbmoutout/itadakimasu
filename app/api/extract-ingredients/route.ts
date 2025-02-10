import { NextResponse } from 'next/server';
import {prisma} from '../../lib/prisma';

import anthropic from '../../lib/anthropic';
import * as cheerio from 'cheerio';
// import { jwtVerify } from 'jose';



export async function POST(request: Request) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendLog = async (log: string) => {
    await writer.write(encoder.encode(JSON.stringify({ log }) + '\n'));
  };

  const extractIngredients = async () => {
    try {
      const token = request.headers.get('Authorization')?.split(' ')[1];
      if (!token) {
        await sendLog("Error: Unauthorized");
        throw new Error('Unauthorized');
      }

      // const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
      // const userId = payload.userId as number;

      const { recipeId } = await request.json();
      
      await sendLog("Fetching recipe from database...");
      const recipe = await prisma.recipe.findUnique({
        where: { id: recipeId }
      });

      if (!recipe) {
        await sendLog("Error: Recipe not found");
        throw new Error('Recipe not found');
      }

      await sendLog("Fetching recipe content...");
      const response = await fetch(recipe.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)',
        }
      });
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      await sendLog("Processing recipe content...");
      $('script, style').remove();
      const text = $('body').text();

      await sendLog("Analyzing ingredients with Claude...");
      const extractIngredientsPrompt = `
      Analyze this recipe content and extract ALL ingredients with their quantities and units.
      Format the response as a JSON array of objects with these properties:
      - name: The standardized ingredient name (e.g., "tomato" instead of "tomatoes")
      - quantity: The numeric quantity (convert fractions to decimals)
      - unit: The standardized unit (e.g., "g", "ml", "piece")

      Recipe content:
      ${text}

      Rules:
      1. Standardize ingredient names (singular form, lowercase)
      2. Convert all fractions to decimals
      3. Standardize units to metric where possible
      4. Include ALL ingredients mentioned in the recipe
      5. If quantity/unit is unclear, set them to null

      Return only the JSON array.
      `;

      const extractionResponse = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: extractIngredientsPrompt
          }
        ]
      });

      let ingredients;
      try {
        // @ts-expect-error response format
        const responseText = extractionResponse.content[0].text.trim();
        // Try to find JSON array within the response if it's not pure JSON
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        
        if (jsonMatch) {
          ingredients = JSON.parse(jsonMatch[0]);
        } else {
          console.error('No JSON array found in response:', responseText);
          ingredients = [{ name: "empty", quantity: null, unit: null }];
        }
      } catch (error) {
        console.error('Error parsing ingredients JSON:', error);
        ingredients = [{ name: "empty", quantity: null, unit: null }];
      }
      
      await sendLog(`Found ${ingredients.length} ingredients`);
      await sendLog("Storing ingredients in database...");
      for (const ing of ingredients) {
        try {
          // Find or create ingredient
          const ingredient = await prisma.ingredient.upsert({
            where: { name: ing.name },
            create: { name: ing.name },
            update: {}
          });

            // Create or update recipe-ingredient relationship
          await prisma.recipeIngredient.upsert({
            where: {
              recipeId_ingredientId: {
                recipeId: recipe.id,
                ingredientId: ingredient.id
              }
            },
            create: {
              recipeId: recipe.id,
              ingredientId: ingredient.id,
              quantity: ing.quantity,
              unit: ing.unit
            },
            update: {
              quantity: ing.quantity,
              unit: ing.unit
            }
          });
        } catch (error) {
          console.error('Error processing ingredient:', ing, error);
          await sendLog(`Error processing ingredient ${ing.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      await sendLog("Ingredients extraction completed!");
      await writer.write(encoder.encode(JSON.stringify({ ingredients }) + '\n'));
    } catch (error) {
      console.error('Error extracting ingredients:', error);
      await sendLog(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      await writer.close();
      await prisma.$disconnect();
    }
  };

  extractIngredients();

  return new NextResponse(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}