import { useEffect, useState } from "react";
import { Recipe } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Star, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface SavedIngredient {
  id: number;
  ingredient: {
    id: number;
    name: string;
    seasons?: Array<{
      month: number;
    }>;
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
  onUpdateLists?: (lists: SavedList[]) => void;
}

interface SuggestedRecipesProps {
  checkedIngredients: string[];
  recipes: Recipe[];
  savedRecipeIds: number[];
  onAddRecipe: (recipeId: number) => Promise<void>;
}

interface ScoredRecipe extends Recipe {
  matchScore: number;
  matchedIngredients: string[];
  missingIngredients: string[];
  percentageMatch: number;
  seasonalIngredients: string[];
}

const SuggestedRecipes = ({
  checkedIngredients,
  recipes,
  savedRecipeIds,
  onAddRecipe,
}: SuggestedRecipesProps) => {
  const [addingRecipeId, setAddingRecipeId] = useState<number | null>(null);

  // Enhanced recipe scoring and filtering
  const suggestedRecipes = recipes
    .filter((recipe) => {
      // Filter out recipes that are already in the list
      if (savedRecipeIds.includes(recipe.id)) return false;
      return true;
    })
    // Remove duplicates by ID
    .filter(
      (recipe, index, self) =>
        index === self.findIndex((r) => r.id === recipe.id)
    )
    // Score and enhance recipes
    .map((recipe): ScoredRecipe => {
      const checkedIngredientsLower = checkedIngredients.map((i) =>
        i.toLowerCase()
      );

      // Find matching ingredients
      const matchedIngredients = recipe.ingredients
        .filter((ing) =>
          checkedIngredientsLower.includes(ing.ingredient.name.toLowerCase())
        )
        .map((ing) => ing.ingredient.name);

      // Find missing ingredients
      const missingIngredients = recipe.ingredients
        .filter(
          (ing) =>
            !checkedIngredientsLower.includes(ing.ingredient.name.toLowerCase())
        )
        .map((ing) => ing.ingredient.name);

      // Calculate percentage match
      const percentageMatch =
        (matchedIngredients.length / recipe.ingredients.length) * 100;

      // Calculate match score based on multiple factors
      const matchScore =
        // Base score from percentage match (0-50 points)
        percentageMatch / 2 +
        // Bonus for having more matching ingredients (0-30 points)
        Math.min(matchedIngredients.length, 6) * 5 +
        // Penalty for too many missing ingredients (-20 to 0 points)
        Math.max(0, 8 - missingIngredients.length) * 2.5 +
        // Bonus for starred recipes (25 points)
        (recipe.starred ? 25 : 0);

      return {
        ...recipe,
        matchScore,
        matchedIngredients,
        missingIngredients,
        percentageMatch,
        seasonalIngredients: [], // Simplified: no seasonal data for now
      };
    })
    // First get recipes with at least 1 matching ingredient
    .filter((recipe) => recipe.matchedIngredients.length >= 1)
    // Sort by match score
    .sort((a, b) => b.matchScore - a.matchScore)
    // Take top suggestions (at least 4, max 6)
    .slice(0, Math.max(4, Math.min(6, recipes.length)));

  if (suggestedRecipes.length === 0) return null;

  const handleAddRecipe = async (recipeId: number) => {
    setAddingRecipeId(recipeId);
    try {
      await onAddRecipe(recipeId);
    } finally {
      setAddingRecipeId(null);
    }
  };

  return (
    <div className="mt-8 border-t border-gray-100 pt-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 px-6">
        Suggested recipes
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-6">
        {suggestedRecipes.map((recipe) => (
          <div
            key={recipe.id}
            className="flex gap-4 p-4 border border-yellow-200 rounded-xl bg-yellow-50"
          >
            {recipe.image && (
              <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
                <Image
                  src={recipe.image}
                  alt={recipe.title || "Recipe preview"}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <Link
                href={recipe.url}
                target="_blank"
                className="group/link block"
              >
                <h4 className="font-medium text-base text-gray-900 line-clamp-1 group-hover/link:text-yellow-600 transition-colors">
                  {recipe.title}
                </h4>
                <div className="mt-1 text-sm">
                  <div className="text-green-600">
                    {recipe.matchedIngredients.map((ingredient, index) => (
                      <span key={ingredient}>
                        {ingredient}
                        {index < recipe.matchedIngredients.length - 1 && (
                          <span className="mx-1.5">·</span>
                        )}
                      </span>
                    ))}
                  </div>
                  {recipe.missingIngredients.length > 0 && (
                    <div className="text-gray-400 mt-0.5">
                      Need:{" "}
                      {recipe.missingIngredients.map((ingredient, index) => (
                        <span key={ingredient}>
                          {ingredient}
                          {index < recipe.missingIngredients.length - 1 && (
                            <span className="mx-1.5">·</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1">
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${recipe.percentageMatch}%` }}
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-yellow-300 bg-yellow-100 hover:bg-yellow-200 text-yellow-800"
                  onClick={() => handleAddRecipe(recipe.id)}
                  disabled={addingRecipeId === recipe.id}
                >
                  {addingRecipeId === recipe.id ? "Adding..." : "Add to list"}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper function to check if an ingredient is in season
const isIngredientInSeason = (
  seasons: Array<{ month: number }> | undefined
): boolean => {
  if (!seasons?.length) return false;

  const currentMonth = new Date().getMonth() + 1; // 1-12
  const monthsToCheck = [
    (currentMonth - 2 + 12) % 12 || 12,
    (currentMonth - 1 + 12) % 12 || 12,
    currentMonth,
    (currentMonth + 1) % 12 || 12,
    (currentMonth + 2) % 12 || 12,
  ];

  return seasons.some((s) => monthsToCheck.includes(s.month));
};

export const SavedLists = ({
  savedLists,
  onToggleIngredient,
  onToggleRecipeStar,
  onRemoveRecipe,
  onUpdateLists,
}: SavedListsProps) => {
  const router = useRouter();
  const [activeList, setActiveList] = useState<SavedList | null>(
    savedLists[0] || null
  );
  const [activeTab, setActiveTab] = useState("groceries");
  const [loadingIngredientId, setLoadingIngredientId] = useState<number | null>(
    null
  );
  const [removingRecipeId, setRemovingRecipeId] = useState<number | null>(null);
  const [completedRecipes, setCompletedRecipes] = useState<number[]>([]);
  const [recipeTimeouts, setRecipeTimeouts] = useState<{
    [key: number]: NodeJS.Timeout;
  }>({});

  useEffect(() => {
    if (savedLists.length > 0) {
      setActiveList(savedLists[0]);
    }
  }, [savedLists]);

  // Check if all ingredients are checked
  useEffect(() => {
    if (activeList) {
      const allChecked = activeList.ingredients.every((i) => i.checked);
      if (allChecked) {
        setActiveTab("recipes");
      }
    }
  }, [activeList]);

  // Check if there are no recipes and redirect
  useEffect(() => {
    if (activeList && activeList.recipes.length === 0) {
      router.push("/recipes");
    }
  }, [activeList, router]);

  if (!activeList) return null;

  // Merge ingredients with the same name and add quantities
  const mergeIngredients = (
    ingredients: SavedIngredient[]
  ): SavedIngredient[] => {
    const mergedMap = new Map<string, SavedIngredient>();

    ingredients.forEach((item) => {
      const key = item.ingredient.name;
      const existing = mergedMap.get(key);

      if (existing) {
        if (existing.unit === item.unit) {
          existing.quantity += item.quantity;
        } else {
          existing.quantity = -1;
          existing.unit = `${existing.quantity} ${existing.unit} + ${item.quantity} ${item.unit}`;
        }
        existing.checked = existing.checked || item.checked;
      } else {
        mergedMap.set(key, { ...item });
      }
    });

    return Array.from(mergedMap.values());
  };

  // Sort ingredients by checked status (unchecked first) and then by name
  const sortIngredients = (
    ingredients: SavedIngredient[]
  ): SavedIngredient[] => {
    return ingredients.sort((a, b) => {
      if (a.checked !== b.checked) {
        return a.checked ? 1 : -1;
      }
      return a.ingredient.name.localeCompare(b.ingredient.name);
    });
  };

  const groceries = sortIngredients(mergeIngredients(activeList.ingredients));

  // Get list of all ingredients for suggestions
  const checkedIngredients = activeList.ingredients.map(
    (i) => i.ingredient.name
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
    try {
      await onToggleRecipeStar(recipeId);
    } finally {
      // No need for loading state cleanup
    }
  };

  const handleRemoveRecipe = async (listId: number, recipeId: number) => {
    const recipe = activeList.recipes.find((r) => r.id === recipeId);

    // If recipe is already starred, remove it immediately
    if (recipe?.starred) {
      await onRemoveRecipe(listId, recipeId);
      return;
    }

    // Otherwise show the rating prompt
    setCompletedRecipes((prev) => [...prev, recipeId]);

    // Store the timeout reference
    const timeout = setTimeout(async () => {
      try {
        await onRemoveRecipe(listId, recipeId);
      } finally {
        setRemovingRecipeId(null);
        setCompletedRecipes((prev) => prev.filter((id) => id !== recipeId));
        setRecipeTimeouts((prev) => {
          const newTimeouts = { ...prev };
          delete newTimeouts[recipeId];
          return newTimeouts;
        });
      }
    }, 5000);

    setRecipeTimeouts((prev) => ({
      ...prev,
      [recipeId]: timeout,
    }));
  };

  const handleRateAndRemove = async (listId: number, recipeId: number) => {
    // Clear the timeout for this recipe
    if (recipeTimeouts[recipeId]) {
      clearTimeout(recipeTimeouts[recipeId]);
      setRecipeTimeouts((prev) => {
        const newTimeouts = { ...prev };
        delete newTimeouts[recipeId];
        return newTimeouts;
      });
    }

    try {
      await handleToggleRecipeStar(recipeId);
      await onRemoveRecipe(listId, recipeId);
    } finally {
      setCompletedRecipes((prev) => prev.filter((id) => id !== recipeId));
      setRemovingRecipeId(null);
    }
  };

  const handleAddSuggestedRecipe = async (recipeId: number) => {
    if (!activeList) return;

    try {
      const response = await fetch("/api/saved-lists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          recipeIds: [recipeId],
          listId: activeList.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add recipe to list");
      }

      const updatedList = await response.json();
      // Update the active list with the new data
      setActiveList(updatedList);
      // Update the saved lists array
      const updatedLists = savedLists.map((list) =>
        list.id === activeList.id ? updatedList : list
      );
      // Call the parent component's update function if it exists
      if (onUpdateLists) {
        onUpdateLists(updatedLists);
      }
    } catch (error) {
      console.error("Error adding recipe to list:", error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex-1 flex flex-col min-h-0">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
            <TabsList className="flex w-full max-w-2xl mx-auto">
              <TabsTrigger
                value="groceries"
                className="flex-1 data-[state=active]:bg-transparent relative px-6 py-4"
              >
                <div className="flex items-center justify-center gap-2.5">
                  <span className="text-base font-medium text-gray-600 data-[state=active]:text-gray-900">
                    Ingredients
                  </span>
                  {groceries.length > 0 && (
                    <span className="px-2 py-0.5 bg-gray-50 rounded-full text-sm font-medium text-gray-600">
                      {groceries.filter((i) => !i.checked).length}
                    </span>
                  )}
                </div>
                <div className="absolute bottom-0 left-6 right-6 h-0.5 bg-black scale-x-0 transition-transform duration-200 data-[state=active]:scale-x-100" />
              </TabsTrigger>
              <TabsTrigger
                value="recipes"
                className="flex-1 data-[state=active]:bg-transparent relative px-6 py-4"
              >
                <div className="flex items-center justify-center gap-2.5">
                  <span className="text-base font-medium text-gray-600 data-[state=active]:text-gray-900">
                    Recipes
                  </span>
                  {activeList.recipes.length > 0 && (
                    <span className="px-2 py-0.5 bg-gray-50 rounded-full text-sm font-medium text-gray-600">
                      {activeList.recipes.length}
                    </span>
                  )}
                </div>
                <div className="absolute bottom-0 left-6 right-6 h-0.5 bg-black scale-x-0 transition-transform duration-200 data-[state=active]:scale-x-100" />
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <TabsContent value="groceries" className="h-full m-0">
              <div className="max-w-2xl mx-auto px-6">
                <div className="py-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {groceries.map((item) => (
                    <div
                      key={item.id}
                      className={`group flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer transition-all hover:border-gray-300 hover:shadow-sm ${
                        loadingIngredientId === item.id ? "opacity-50" : ""
                      } ${item.checked ? "bg-gray-50" : "bg-white"}`}
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
                        className="h-5 w-5 border-2 rounded-md data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <label
                            htmlFor={`ingredient-${item.id}`}
                            className={`flex-grow cursor-pointer ${
                              item.checked ? "line-through text-gray-400" : ""
                            }`}
                          >
                            {item.ingredient.name}
                          </label>
                          <span
                            className={`text-sm ${
                              item.checked ? "text-gray-400" : "text-gray-600"
                            }`}
                          >
                            {item.quantity === -1
                              ? item.unit
                              : `${item.quantity} ${item.unit}`}
                            {item.ingredient.seasons &&
                              item.ingredient.seasons.length > 0 && (
                                <span className="ml-2">
                                  {isIngredientInSeason(
                                    item.ingredient.seasons
                                  ) && "🌱"}
                                </span>
                              )}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="recipes" className="h-full m-0">
              <div className="max-w-2xl mx-auto">
                <div className="divide-y divide-gray-100">
                  {activeList.recipes.map((recipe) => (
                    <div
                      key={recipe.id}
                      className={`group flex items-center gap-4 p-4 hover:bg-gray-50/50 transition-colors ${
                        removingRecipeId === recipe.id &&
                        !completedRecipes.includes(recipe.id)
                          ? "opacity-50"
                          : ""
                      }`}
                    >
                      {recipe.image && (
                        <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
                          <Image
                            src={recipe.image}
                            alt={recipe.title || "Recipe preview"}
                            fill
                            className="object-cover transition-transform group-hover:scale-105"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <Link
                          href={recipe.url}
                          target="_blank"
                          className="group/link block"
                        >
                          <h3 className="font-medium text-lg text-gray-900 line-clamp-1 group-hover/link:text-yellow-600 transition-colors">
                            {recipe.title}
                          </h3>
                          <div className="mt-1 text-sm text-gray-500 line-clamp-4">
                            {recipe.ingredients?.map((ingredient, index) => (
                              <span
                                key={`${recipe.id}-${ingredient.ingredient.id}`}
                                className={`inline-flex items-center ${
                                  ingredient.ingredient.seasons?.length &&
                                  isIngredientInSeason(
                                    ingredient.ingredient.seasons
                                  )
                                    ? "after:content-['🌱'] after:ml-0.5"
                                    : ""
                                }`}
                              >
                                {ingredient.ingredient.name}
                                {index < recipe.ingredients.length - 1 && (
                                  <span className="mx-1.5">·</span>
                                )}
                              </span>
                            ))}
                            {(recipe.ingredients?.length || 0) > 3 && (
                              <span className="text-gray-400">
                                {" "}
                                + {(recipe.ingredients?.length || 0) - 3} more
                              </span>
                            )}
                          </div>
                        </Link>
                      </div>
                      <div className="flex items-center gap-2">
                        {(completedRecipes.includes(recipe.id) ||
                          removingRecipeId === recipe.id) &&
                        !recipe.starred ? (
                          <div
                            onClick={() =>
                              handleRateAndRemove(activeList.id, recipe.id)
                            }
                            className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-yellow-200 bg-yellow-50 hover:bg-yellow-100 hover:border-yellow-300 animate-in slide-in-from-right duration-500 cursor-pointer transition-colors group/rate"
                          >
                            <Star className="h-5 w-5 text-yellow-600" />
                            <span className="text-base font-medium text-yellow-700">
                              Miam miam ?
                            </span>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="default"
                            className={`h-11 px-4 rounded-xl border-2 transition-colors ${
                              recipe.starred
                                ? "border-gray-200 bg-gray-50 text-gray-400"
                                : "border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 text-green-700"
                            } gap-2`}
                            onClick={() =>
                              handleRemoveRecipe(activeList.id, recipe.id)
                            }
                          >
                            <Check
                              className={`h-5 w-5 ${
                                recipe.starred ? "text-gray-400" : ""
                              }`}
                            />
                            <span className="font-medium">Done</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <SuggestedRecipes
                  checkedIngredients={checkedIngredients}
                  recipes={savedLists.flatMap((list) => list.recipes)}
                  savedRecipeIds={activeList.recipes.map((r) => r.id)}
                  onAddRecipe={handleAddSuggestedRecipe}
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};
