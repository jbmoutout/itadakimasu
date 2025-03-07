// Common ingredients to exclude
export const EXCLUDED_INGREDIENTS = new Set([
  "water",
  "ice",
  "salt",
  "pepper",
  "table salt",
  "black pepper",
  "tap water",
  "ice cubes",
  "oil",
  "vinegar",
  "sugar",
  "flour",
]);

// Standard units for normalization
export const UNIT_MAPPINGS: Record<string, string> = {
  // Weight
  "g": "g",
  "gram": "g",
  "grams": "g",
  "kg": "kg",
  "kilogram": "kg",
  "kilograms": "kg",
  // Volume
  "ml": "ml",
  "milliliter": "ml",
  "milliliters": "ml",
  "l": "l",
  "liter": "l",
  "liters": "l",
  // US/Imperial
  "oz": "oz",
  "ounce": "oz",
  "ounces": "oz",
  "lb": "lb",
  "pound": "lb",
  "pounds": "lb",
  "cup": "cup",
  "cups": "cup",
  "tbsp": "tbsp",
  "tablespoon": "tbsp",
  "tablespoons": "tbsp",
  "tsp": "tsp",
  "teaspoon": "tsp",
  "teaspoons": "tsp",
  // Count
  "piece": "pc",
  "pieces": "pc",
  "pc": "pc",
  // Other
  "pinch": "pinch",
  "pinches": "pinch",
};

export function normalizeUnit(unit: string): string {
  const normalized = UNIT_MAPPINGS[unit.toLowerCase().trim()];
  return normalized || unit;
}

export function normalizeQuantity(quantity: number | string): number {
  const num = typeof quantity === "string" ? parseFloat(quantity) : quantity;
  return isNaN(num) ? 0 : Math.max(0, num);
}

export function shouldIncludeIngredient(name: string): boolean {
  const normalized = name.toLowerCase().trim();
  return !EXCLUDED_INGREDIENTS.has(normalized);
}

export async function getExistingIngredients(): Promise<string[]> {
  const response = await fetch("/api/ingredients");
  const data = await response.json();
  return data.map((ing: { name: string }) => ing.name.toLowerCase().trim());
} 