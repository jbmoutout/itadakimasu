export type ShoppingListData = {
  selectedRecipes: string[];
  shoppingList: {
    [category: string]: {
      ingredient: string;
      quantity: number;
      unit: string;
      recipes: string[];
      checked: boolean;
    }[];
  };
};

export type RecipeType = {
  id: number;
  url: string;
  createdAt: string;
  title?: string;
  image?: string;
  ingredients: Array<{
    ingredient: {
      name: string;
    };
    quantity?: number;
    unit?: string;
  }>;
};
