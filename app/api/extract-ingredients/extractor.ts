import * as cheerio from "cheerio";
import anthropic from "../../lib/anthropic";

export interface ExtractedIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
}

export async function extractIngredientsFromUrl(
  url: string
): Promise<ExtractedIngredient[]> {
  try {
    // Fetch recipe content
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RecipeBot/1.0)",
      },
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    // Process recipe content
    $("script, style").remove();
    const text = $("body").text();

    // Analyze ingredients with Claude
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
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: extractIngredientsPrompt,
        },
      ],
    });

    let ingredients: ExtractedIngredient[];
    try {
      // @ts-expect-error response format
      const responseText = extractionResponse.content[0].text.trim();
      // Try to find JSON array within the response if it's not pure JSON
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        ingredients = JSON.parse(jsonMatch[0]);
      } else {
        console.error("No JSON array found in response:", responseText);
        ingredients = [];
      }
    } catch (error) {
      console.error("Error parsing ingredients JSON:", error);
      ingredients = [];
    }

    return ingredients;
  } catch (error) {
    console.error("Error extracting ingredients:", error);
    return [];
  }
}
