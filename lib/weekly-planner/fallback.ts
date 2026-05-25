import { RecipeData } from "@/types";

export function selectFallbackRecipes(topRecipes: RecipeData[]): number[] {
  return topRecipes.slice(0, 5).map(r => r.id);
}

export function parseRecipeIdsFromAIResponse(content: string): number[] | null {
  const match = content.match(/\[(\d+(?:,\s*\d+)*)\]/);
  if (!match) return null;
  return match[1]
    .split(",")
    .map((id) => parseInt(id.trim()))
    .filter(id => !isNaN(id))
    .slice(0, 5);
}
