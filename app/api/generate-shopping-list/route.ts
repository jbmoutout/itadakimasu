import anthropic from '../../lib/anthropic';
import prisma from '../../lib/prisma';
import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function GET() {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendLog = async (log: string) => {
    await writer.write(encoder.encode(JSON.stringify({ log }) + '\n'));
  };

  const generateShoppingList = async () => {
    try {
        await sendLog("Fetching recipes from database...");
        const recipes = await prisma.recipe.findMany();
        await sendLog(`Found ${recipes.length} recipes.`);

        await sendLog("Selecting 4 recipes...");
        const selectRecipesPrompt = `
        You are tasked with selecting 4 healthy and diverse recipes from the following list of URLs:
        ${recipes.map((recipe, index) => `${index + 1}. ${recipe.url}`).join('\n')}

        Please select 4 recipes based on the following criteria:
        a. Choose healthy recipes that likely include a variety of nutrients
        b. Ensure diversity in the types of dishes (e.g., different cuisines, meal types, seasons, location: France)
        c. Consider recipes that likely have a mix of ingredients (proteins, vegetables, grains, etc.)

        Respond with only the numbers of the 4 selected recipes, separated by commas. For example: 1,3,5,7
        `;

        const selectRecipesMessage = await anthropic.messages.create({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 100,
            messages: [
                {
                    role: 'user',
                    content: selectRecipesPrompt
                }
            ]
        });

        // @ts-expect-error ehh this is fine
        const selectedRecipeIndices = selectRecipesMessage.content[0]?.text?.trim().split(',').map(Number);
        const selectedRecipes = selectedRecipeIndices.map((index:number) => recipes[index - 1]);
        await sendLog(`Selected recipes: ${selectedRecipeIndices.join(', ')}`);

        await sendLog("Fetching content for selected recipes...");
        const recipeContents = await Promise.all(
            selectedRecipes.map(async (recipe: { url: string }) => {
                try {
                    const response = await axios.get(recipe.url);
                    const $ = cheerio.load(response.data);

                    // Remove script, style, and SVG elements
                    $('script, style, svg').remove();

                    // Extract text content
                    let text = $('body').text();

                    // Clean up the text
                    text = text.replace(/\s+/g, ' ').trim();

                    await sendLog(`Fetched and extracted text content for ${recipe.url}`);
                    return {
                        url: recipe.url,
                        content: text.substring(0, 10000) // Limit content to 10000 characters
                    };
                } catch (error) {
                    await sendLog(`Failed to fetch or extract content for ${recipe.url}: ${error}`);
                    return {
                        url: recipe.url,
                        content: 'Failed to fetch or extract recipe content'
                    };
                }
            })
        );

        console.log(recipeContents);

        await sendLog("Generating shopping list...");
        const generateShoppingListPrompt = `
            You are tasked with generating a comprehensive shopping list based on 4 healthy and diverse recipes. Follow these steps meticulously:

            1. Analyze the following recipes:
            ${recipeContents.map((recipe:{url: string, content:string}, index:number) => `
            Recipe ${index + 1}: ${recipe.url}
            ${recipe.content}
            `).join('\n')}

            2. For each recipe:
              a. Carefully extract ALL ingredients directly from the recipe's ingredient list
              b. Include every single ingredient mentioned, regardless of quantity or perceived importance
              c. Do not modify, substitute, or add any ingredients not listed in the original recipe
              d. Pay special attention to ingredients that might be easily overlooked, such as seasonings, oils, or garnishes

            3. Compile a thorough shopping list with all the ingredients from the 4 recipes:
              a. You must carefully combine similar ingredients and their quantities - do not duplicate items

            4. Present your final output as a JSON object with the following structure:
            <output>
            {
              "selectedRecipes": [
                "Recipe Name 1 <recipe_url>",
                "Recipe Name 2 <recipe_url>",
                "Recipe Name 3 <recipe_url>",
                "Recipe Name 4 <recipe_url>"
              ],
              "shoppingList": {
                "Category1": [
                  {
                    "ingredient": "Ingredient 1",
                    "quantity": 0,
                    "unit": "unit",
                    "recipes": "Recipe Name 1, Recipe Name 3"
                  },
                  {
                    "ingredient": "Ingredient 2",
                    "quantity": 0,
                    "unit": "unit",
                    "recipes": "Recipe Name 1, Recipe Name 3"
                  }
                ],
                "Category2": [
                  {
                    "ingredient": "Ingredient 3",
                    "quantity": 0,
                    "unit": "unit",
                    "recipes": "Recipe Name 1, Recipe Name 3"
                  },
                  {
                    "ingredient": "Ingredient 4",
                    "quantity": 0,
                    "unit": "unit",
                    "recipes": "Recipe Name 1, Recipe Name 3"
                  }
                ]
              }
            }
            </output>

            Critical: Ensure absolute completeness in your ingredient list. Double-check that you have not missed any ingredients, no matter how small or seemingly insignificant. Only use the recipe content provided above. 
            Do not add, remove, or substitute any ingredients from the original recipes. Your shopping list must accurately reflect ALL ingredients needed for the 4 selected recipes, without exception. 
            Replace the placeholder values in the JSON structure with the actual data from your thorough analysis.

            Only answer with the JSON object containing the selected recipes and the comprehensive shopping list. Do not include any additional information or explanations.        `;

        const generateShoppingListMessage = await anthropic.messages.create({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 3000,
            messages: [
                {
                    role: 'user',
                    content: generateShoppingListPrompt
                }
            ]
        });

        // @ts-expect-error ehh this is fine
        const shoppingList = JSON.parse(generateShoppingListMessage.content[0]?.text?.trim() || '{}');
        await sendLog("Shopping list generated successfully.");

        await sendLog("Saving shopping list to database...");
        await prisma.shoppingList.create({
            data: {
                data: shoppingList
            }
        });
        await sendLog("Shopping list saved to database.");

        await writer.write(encoder.encode(JSON.stringify({ shoppingList }) + '\n'));
      } catch (error) {
        await sendLog(`Error: ${error}`);
      } finally {
        await writer.close();
      }
  }
  generateShoppingList();

  return new NextResponse(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}