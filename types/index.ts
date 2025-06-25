export interface Recipe {
  id: number;
  url: string;
  title: string;
  description?: string;
  image?: string;
  createdAt: string;
  ingredients: RecipeIngredient[];
  starred: boolean;
}

export interface RecipeIngredient {
  id: number;
  recipeId: number;
  ingredientId: number;
  quantity: number;
  unit: string;
  ingredient: Ingredient;
}

export interface Ingredient {
  id: number;
  name: string;
  seasons?: Array<{
    isInSeason: boolean;
    month: number;
  }>;
}

export interface SavedIngredient {
  id: number;
  ingredient: {
    id: number;
    name: string;
  };
  quantity: number;
  unit: string;
  category: "pantry" | "groceries";
  checked: boolean;
}

export interface SavedList {
  id: number;
  name: string;
  createdAt: string;
  recipes: Recipe[];
  ingredients: SavedIngredient[];
}

export interface ShoppingListItem {
  ingredient: string;
  quantity: number;
  unit: string;
  recipes: string[];
  checked: boolean;
}

export interface ShoppingList {
  selectedRecipes: Recipe[];
  items: ShoppingListItem[];
}

export interface PreviewMetadata {
  title?: string;
  description?: string;
  image?: string;
}

export interface AuthState {
  isLoggedIn: boolean;
  isAuthChecking: boolean;
}

// Additional types for weekly planner
export interface RecipeWithIngredients {
  id: number;
  url: string;
  title: string;
  description?: string;
  image?: string;
  createdAt: string;
  starred: boolean;
  ingredients: RecipeIngredientWithSeason[];
}

export interface RecipeIngredientWithSeason {
  id: number;
  recipeId: number;
  ingredientId: number;
  quantity: number;
  unit: string;
  ingredient: IngredientWithSeasons;
}

export interface IngredientWithSeasons {
  id: number;
  name: string;
  englishName?: string;
  seasons: Array<{
    month: number;
  }>;
}

export interface RecipeData {
  id: number;
  title: string;
  description: string;
  ingredients: Array<{
    name: string;
    englishName?: string;
    isSeasonal: boolean;
  }>;
  seasonalScore: number;
  weight: number;
  weightReason: string;
  starred: boolean;
}

export interface RecipeWeight {
  recipeId: number;
  weight: number;
  reason: string;
}

export interface SeasonalIngredient {
  ingredient: IngredientWithSeasons;
  isSeasonal: boolean;
}
