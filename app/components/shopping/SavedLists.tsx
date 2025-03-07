import { useEffect, useState } from "react";
import { Recipe } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

interface SavedIngredient {
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

interface SavedList {
  id: number;
  name: string;
  createdAt: string;
  recipes: Recipe[];
  ingredients: SavedIngredient[];
}

interface SavedListsProps {
  savedLists: SavedList[];
  onToggleIngredient: (listId: number, ingredientId: number) => Promise<void>;
  onToggleRecipeStar: (recipeId: number) => Promise<void>;
  onRemoveRecipe: (listId: number, recipeId: number) => Promise<void>;
}

export const SavedLists = ({
  savedLists,
  onToggleIngredient,
  onToggleRecipeStar,
  onRemoveRecipe,
}: SavedListsProps) => {
  const [activeList, setActiveList] = useState<SavedList | null>(
    savedLists[0] || null
  );
  const [loadingIngredientId, setLoadingIngredientId] = useState<number | null>(
    null
  );
  const [loadingRecipeId, setLoadingRecipeId] = useState<number | null>(null);
  const [removingRecipeId, setRemovingRecipeId] = useState<number | null>(null);

  useEffect(() => {
    if (savedLists.length > 0) {
      setActiveList(savedLists[0]);
    }
  }, [savedLists]);

  if (!activeList) return null;

  // Merge ingredients with the same name and add quantities
  const mergeIngredients = (ingredients: SavedIngredient[]) => {
    const mergedMap = new Map<string, SavedIngredient>();

    ingredients.forEach((item) => {
      const key = item.ingredient.name;
      const existing = mergedMap.get(key);

      if (existing) {
        // If ingredient exists, handle different quantities
        if (existing.unit === item.unit) {
          // Same unit, add quantities
          existing.quantity += item.quantity;
        } else {
          // Different units, store as a string with both quantities
          existing.quantity = -1; // Special flag to indicate multiple quantities
          existing.unit = `${existing.quantity} ${existing.unit} + ${item.quantity} ${item.unit}`;
        }
        existing.checked = existing.checked || item.checked;
      } else {
        // If ingredient doesn't exist, add it to the map
        mergedMap.set(key, { ...item });
      }
    });

    return Array.from(mergedMap.values());
  };

  // Sort ingredients by checked status (unchecked first) and then by name
  const sortIngredients = (ingredients: SavedIngredient[]) => {
    return [...ingredients].sort((a, b) => {
      if (a.checked !== b.checked) {
        return a.checked ? 1 : -1;
      }
      return a.ingredient.name.localeCompare(b.ingredient.name);
    });
  };

  const groceries = sortIngredients(
    mergeIngredients(
      activeList.ingredients.filter((i) => i.category === "groceries")
    )
  );

  const handleToggleIngredient = async (
    listId: number,
    ingredientId: number
  ) => {
    setLoadingIngredientId(ingredientId);
    try {
      await onToggleIngredient(listId, ingredientId);
    } finally {
      setLoadingIngredientId(null);
    }
  };

  const handleToggleRecipeStar = async (recipeId: number) => {
    setLoadingRecipeId(recipeId);
    try {
      await onToggleRecipeStar(recipeId);
    } finally {
      setLoadingRecipeId(null);
    }
  };

  const handleRemoveRecipe = async (listId: number, recipeId: number) => {
    setRemovingRecipeId(recipeId);
    try {
      await onRemoveRecipe(listId, recipeId);
    } finally {
      setRemovingRecipeId(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b bg-white">
        <h2 className="text-lg font-semibold">Shopping List</h2>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0">
        <Tabs defaultValue="groceries" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2 sticky top-0 bg-white z-10">
            <TabsTrigger value="groceries">Groceries</TabsTrigger>
            <TabsTrigger value="recipes">Recipes</TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <TabsContent value="groceries" className="h-full">
              <div className="space-y-2 p-4">
                {groceries.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center space-x-2 p-2 border rounded cursor-pointer transition-colors ${
                      loadingIngredientId === item.id ? "opacity-50" : ""
                    }`}
                    onClick={() =>
                      handleToggleIngredient(activeList.id, item.id)
                    }
                  >
                    <Checkbox
                      id={`checkbox-${item.id}`}
                      checked={item.checked}
                      onCheckedChange={() =>
                        handleToggleIngredient(activeList.id, item.id)
                      }
                      onClick={(e) => e.stopPropagation()}
                      disabled={loadingIngredientId === item.id}
                    />
                    <label
                      htmlFor={`checkbox-${item.id}`}
                      className={`flex-1 cursor-pointer text-sm lg:text-base ${
                        item.checked ? "line-through text-gray-500" : ""
                      }`}
                    >
                      {item.ingredient.name} -{" "}
                      {item.quantity === -1
                        ? item.unit
                        : `${item.quantity} ${item.unit}`}
                    </label>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="recipes" className="h-full">
              <div className="space-y-2 p-4">
                {activeList.recipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    className={`flex items-center gap-2 lg:gap-4 p-2 border rounded ${
                      removingRecipeId === recipe.id ? "opacity-50" : ""
                    }`}
                  >
                    <Link
                      href={recipe.url}
                      target="_blank"
                      className="flex-1 flex items-center gap-2 lg:gap-4 min-w-0"
                    >
                      <div className="relative w-12 h-12 lg:w-16 lg:h-16 flex-shrink-0">
                        {recipe.image ? (
                          <Image
                            src={recipe.image}
                            alt={recipe.title || "Recipe preview"}
                            fill
                            className="object-cover rounded"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 rounded flex items-center justify-center">
                            <span className="text-gray-400 text-xs lg:text-sm">
                              No image
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm lg:text-base hover:text-yellow-600 transition-colors">
                          {recipe.title}
                        </h3>
                        <p className="text-xs lg:text-sm text-gray-500 truncate">
                          {recipe.ingredients?.length || 0} ingredients
                        </p>
                        <div className="mt-1 text-[10px] lg:text-xs text-gray-400">
                          {recipe.ingredients
                            ?.slice(0, 3)
                            .map((ingredient, index) => (
                              <span key={index}>
                                {ingredient.ingredient.name}
                                {ingredient.quantity &&
                                  ingredient.unit &&
                                  ` (${ingredient.quantity} ${ingredient.unit})`}
                                {index <
                                Math.min(
                                  2,
                                  (recipe.ingredients?.length || 0) - 1
                                )
                                  ? ", "
                                  : ""}
                              </span>
                            ))}
                          {(recipe.ingredients?.length || 0) > 3 && (
                            <span>
                              ... and {(recipe.ingredients?.length || 0) - 3}{" "}
                              more
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center gap-1 lg:gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 lg:h-10 lg:w-10"
                        onClick={() => handleToggleRecipeStar(recipe.id)}
                        disabled={loadingRecipeId === recipe.id}
                      >
                        {loadingRecipeId === recipe.id ? (
                          <Star className="h-3 w-3 lg:h-4 lg:w-4 animate-pulse" />
                        ) : recipe.starred ? (
                          <Star className="h-3 w-3 lg:h-4 lg:w-4 fill-yellow-400 text-yellow-400" />
                        ) : (
                          <Star className="h-3 w-3 lg:h-4 lg:w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 lg:h-10 lg:w-10"
                        onClick={() =>
                          handleRemoveRecipe(activeList.id, recipe.id)
                        }
                        disabled={removingRecipeId === recipe.id}
                      >
                        <Trash2 className="h-3 w-3 lg:h-4 lg:w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </div>
        </Tabs>
        <div className="p-4 border-t">
          <select
            value={activeList.id}
            onChange={(e) => {
              const list = savedLists.find(
                (l) => l.id === parseInt(e.target.value)
              );
              if (list) setActiveList(list);
            }}
            className="w-full border rounded p-2 text-sm lg:text-base"
          >
            {savedLists.map((list) => (
              <option key={list.id} value={list.id}>
                {new Date(list.createdAt).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
