"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Recipe } from "@/types";
import { Header } from "./components/layout/Header";
import { BottomOverlay } from "./components/layout/BottomOverlay";
import { SavedLists } from "./components/shopping/SavedLists";
import { AuthScreen } from "./components/auth/AuthScreen";
import { LoadingOverlay } from "./components/common/LoadingOverlay";
import { RecipeCard } from "./components/recipes/RecipeCard";
import { AddRecipeForm } from "./components/recipes/AddRecipeForm";
import { Button } from "@/components/ui/button";
import * as fuzzball from "fuzzball";

// Cache for search results
const searchCache = new Map<string, boolean>();

interface SavedList {
  id: number;
  name: string;
  createdAt: string;
  recipes: Recipe[];
  ingredients: Array<{
    id: number;
    ingredient: {
      id: number;
      name: string;
    };
    quantity: number;
    unit: string;
    category: "pantry" | "groceries";
    checked: boolean;
  }>;
}

export default function Home() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipes, setSelectedRecipes] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [savedLists, setSavedLists] = useState<SavedList[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [isFetchingRecipes, setIsFetchingRecipes] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const fetchRecipes = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setIsFetchingRecipes(true);
    try {
      const res = await fetch("/api/recipes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch recipes");

      const data = await res.json();
      setRecipes(data);
    } catch (error) {
      console.error("Error fetching recipes:", error);
    } finally {
      setIsFetchingRecipes(false);
    }
  }, []);

  const fetchSavedLists = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch("/api/saved-lists", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch saved lists");

      const data = await res.json();
      setSavedLists(data);
    } catch (error) {
      console.error("Error fetching saved lists:", error);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsLoggedIn(true);
      router.refresh();
    }
    setIsAuthChecking(false);
  }, [router]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchRecipes();
      fetchSavedLists();
    }
  }, [isLoggedIn, fetchRecipes, fetchSavedLists]);

  // Add escape key handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectedRecipes.length > 0) {
        handleClearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedRecipes.length]);

  // Debounced search query update
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleAddRecipe = async (url: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setIsLoading(true);

    try {
      const res = await fetch("/api/add-recipe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (data.success) {
        fetchRecipes();
        alert("Recipe added successfully!");
      } else if (
        res.status === 400 &&
        data.error === "Recipe with this URL already exists"
      ) {
        alert("This recipe URL already exists in your collection.");
      } else {
        alert("Failed to add recipe. Please try again.");
      }
    } catch (error) {
      console.error("Error adding recipe:", error);
      alert("An error occurred while adding the recipe.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
  };

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleSelectRecipe = (id: number) => {
    setSelectedRecipes((prev) =>
      prev.includes(id) ? prev.filter((rid) => rid !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    const token = localStorage.getItem("token");
    if (!token || selectedRecipes.length === 0) return;

    setIsLoading(true);

    try {
      const res = await fetch("/api/saved-lists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipeIds: selectedRecipes }),
      });

      if (!res.ok) throw new Error("Failed to save list");

      const data = await res.json();
      setSavedLists((prev) => [data, ...prev]);
      setSelectedRecipes([]);
    } catch (error) {
      console.error("Error saving list:", error);
      alert("Failed to save list. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSelection = () => {
    setSelectedRecipes([]);
  };

  const handleToggleIngredient = async (
    listId: number,
    ingredientId: number
  ) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const currentList = savedLists.find((list) => list.id === listId);
      const currentIngredient = currentList?.ingredients.find(
        (i) => i.id === ingredientId
      );
      if (!currentIngredient) return;

      const res = await fetch("/api/saved-lists", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ingredientId,
          checked: !currentIngredient.checked,
        }),
      });

      if (!res.ok) throw new Error("Failed to update ingredient");

      const updatedIngredient = await res.json();
      setSavedLists((prev) =>
        prev.map((list) =>
          list.id === listId
            ? {
                ...list,
                ingredients: list.ingredients.map((i) =>
                  i.id === ingredientId ? updatedIngredient : i
                ),
              }
            : list
        )
      );
    } catch (error) {
      console.error("Error updating ingredient:", error);
      alert("Failed to update ingredient. Please try again.");
    }
  };

  const handleToggleRecipeStar = async (recipeId: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(`/api/recipes/${recipeId}/star`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Failed to update recipe star");

      const updatedRecipe = await res.json();
      setRecipes((prev) =>
        prev.map((r) => (r.id === recipeId ? updatedRecipe : r))
      );
      setSavedLists((prev) =>
        prev.map((list) => ({
          ...list,
          recipes: list.recipes.map((r) =>
            r.id === recipeId ? updatedRecipe : r
          ),
        }))
      );
    } catch (error) {
      console.error("Error updating recipe star:", error);
      alert("Failed to update recipe star. Please try again.");
    }
  };

  const handleRemoveRecipe = async (listId: number, recipeId: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(
        `/api/saved-lists/${listId}/recipes/${recipeId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) throw new Error("Failed to remove recipe");

      await fetchSavedLists();
    } catch (error) {
      console.error("Error removing recipe:", error);
      alert("Failed to remove recipe. Please try again.");
    }
  };

  const handleToggleStar = async () => {
    const token = localStorage.getItem("token");
    if (!token || selectedRecipes.length === 0) return;

    try {
      // Toggle star status for all selected recipes
      await Promise.all(
        selectedRecipes.map((recipeId) =>
          fetch(`/api/recipes/${recipeId}/star`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
        )
      );

      // Update local state
      setRecipes((prev) =>
        prev.map((r) =>
          selectedRecipes.includes(r.id) ? { ...r, starred: !r.starred } : r
        )
      );
      setSavedLists((prev) =>
        prev.map((list) => ({
          ...list,
          recipes: list.recipes.map((r) =>
            selectedRecipes.includes(r.id) ? { ...r, starred: !r.starred } : r
          ),
        }))
      );
    } catch (error) {
      console.error("Error updating recipe stars:", error);
      alert("Failed to update recipe stars. Please try again.");
    }
  };

  const handleRemoveDuplicates = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch("/api/recipes/remove-duplicates", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Failed to remove duplicates");

      const data = await res.json();
      if (data.success) {
        alert(`Successfully removed ${data.totalDuplicates} duplicate recipes`);
        fetchRecipes(); // Refresh the recipes list
      }
    } catch (error) {
      console.error("Error removing duplicates:", error);
      alert("Failed to remove duplicate recipes. Please try again.");
    }
  };

  const handleDelete = async () => {
    const token = localStorage.getItem("token");
    if (!token || selectedRecipes.length === 0) return;

    try {
      // Delete all selected recipes
      await Promise.all(
        selectedRecipes.map((recipeId) =>
          fetch(`/api/recipes/${recipeId}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
        )
      );

      // Update local state
      setRecipes((prev) => prev.filter((r) => !selectedRecipes.includes(r.id)));
      setSavedLists((prev) =>
        prev.map((list) => ({
          ...list,
          recipes: list.recipes.filter((r) => !selectedRecipes.includes(r.id)),
        }))
      );
      setSelectedRecipes([]);
    } catch (error) {
      console.error("Error deleting recipes:", error);
      alert("Failed to delete recipes. Please try again.");
    }
  };

  const handleAddToList = async () => {
    const token = localStorage.getItem("token");
    if (!token || selectedRecipes.length === 0) return;

    try {
      // Get the most recent saved list
      const mostRecentList = savedLists[0];
      if (!mostRecentList) {
        alert("Please create a list first before adding recipes.");
        return;
      }

      // Add selected recipes to the list
      const res = await fetch(`/api/saved-lists/${mostRecentList.id}/recipes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipeIds: selectedRecipes }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add recipes to list");
      }

      // Fetch the updated list with ingredients
      const updatedListRes = await fetch(
        `/api/saved-lists/${mostRecentList.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!updatedListRes.ok) {
        throw new Error("Failed to fetch updated list");
      }

      const updatedList = await updatedListRes.json();

      // Update the saved lists state with the updated list
      setSavedLists((prev) =>
        prev.map((list) => (list.id === mostRecentList.id ? updatedList : list))
      );

      setSelectedRecipes([]); // Clear selection after adding
    } catch (error) {
      console.error("Error adding recipes to list:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to add recipes to list. Please try again."
      );
    }
  };

  // Check if all selected recipes are starred
  const areAllSelectedStarred =
    selectedRecipes.length > 0 &&
    selectedRecipes.every((id) => recipes.find((r) => r.id === id)?.starred);

  // Sort recipes by starred status and filter by search query
  const filteredAndSortedRecipes = useMemo(() => {
    const filtered = recipes.filter((recipe) => {
      if (!debouncedSearchQuery) return true;
      const searchLower = debouncedSearchQuery.toLowerCase();

      // Check cache first
      const cacheKey = `${recipe.id}-${searchLower}`;
      if (searchCache.has(cacheKey)) {
        return searchCache.get(cacheKey);
      }

      // Quick check for exact matches first
      const exactTitleMatch = recipe.title?.toLowerCase().includes(searchLower);
      const exactIngredientMatch = recipe.ingredients?.some((ing) =>
        ing.ingredient.name.toLowerCase().includes(searchLower)
      );

      if (exactTitleMatch || exactIngredientMatch) {
        searchCache.set(cacheKey, true);
        return true;
      }

      // Only perform fuzzy search if no exact match is found
      const titleMatch =
        recipe.title &&
        fuzzball.ratio(searchLower, recipe.title.toLowerCase()) > 80;

      const ingredientsMatch = recipe.ingredients?.some((ing) => {
        const ingredientName = ing.ingredient.name.toLowerCase();
        return fuzzball.ratio(searchLower, ingredientName) > 80;
      });

      const result = titleMatch || ingredientsMatch;
      searchCache.set(cacheKey, result);
      return result;
    });

    // Create a stable random order for non-starred recipes
    const nonStarredRecipes = filtered.filter((recipe) => !recipe.starred);
    const starredRecipes = filtered.filter((recipe) => recipe.starred);

    // Sort non-starred recipes by their ID to maintain a stable order
    const sortedNonStarred = [...nonStarredRecipes].sort((a, b) => a.id - b.id);

    // Combine starred and non-starred recipes
    return [...starredRecipes, ...sortedNonStarred];
  }, [recipes, debouncedSearchQuery]);

  // Clear search cache when recipes change
  useEffect(() => {
    searchCache.clear();
  }, [recipes]);

  if (isAuthChecking) {
    return <LoadingOverlay />;
  }

  if (!isLoggedIn) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Header onLogout={handleLogout} />
      <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)]">
        {/* Mobile SavedLists - Only visible on mobile */}
        <div className="lg:hidden w-full bg-white border-b h-[300px]">
          <SavedLists
            savedLists={savedLists}
            onToggleIngredient={handleToggleIngredient}
            onToggleRecipeStar={handleToggleRecipeStar}
            onRemoveRecipe={handleRemoveRecipe}
          />
        </div>

        {/* Main content area */}
        <div className="flex-1 container px-4 lg:px-10 mx-auto pt-4 lg:pt-24 pb-20 overflow-y-auto">
          <div className="mb-8 flex gap-4">
            <input
              type="text"
              placeholder="Search recipes by title or ingredients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 p-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 text-md"
            />
          </div>
          {isFetchingRecipes ? (
            <LoadingOverlay />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-8">
              {filteredAndSortedRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  isSelected={selectedRecipes.includes(recipe.id)}
                  onSelect={() => handleSelectRecipe(recipe.id)}
                />
              ))}
            </div>
          )}
          <div className="mt-12 mb-8 px-4">
            <div className="bg-white rounded-lg shadow-sm p-4 lg:p-6 border">
              <h2 className="text-lg font-semibold mb-4">
                Recipe Management Tools
              </h2>
              <div className="flex flex-col gap-4">
                <AddRecipeForm
                  onSubmit={handleAddRecipe}
                  isLoading={isLoading}
                />
                <div className="flex items-center gap-4 pt-4 border-t">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">
                      Found duplicate recipes? Clean up your collection.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleRemoveDuplicates}
                    className="whitespace-nowrap"
                  >
                    Remove Duplicates
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop SavedLists - Only visible on desktop */}
        <div className="hidden lg:block w-96 pt-20 bg-white p-6">
          <SavedLists
            savedLists={savedLists}
            onToggleIngredient={handleToggleIngredient}
            onToggleRecipeStar={handleToggleRecipeStar}
            onRemoveRecipe={handleRemoveRecipe}
          />
        </div>
      </div>
      <BottomOverlay
        onSave={handleSave}
        onClearSelection={handleClearSelection}
        onToggleStar={handleToggleStar}
        onDelete={handleDelete}
        onAddToList={handleAddToList}
        isSaving={isLoading}
        hasSelectedRecipes={selectedRecipes.length > 0}
        selectedCount={selectedRecipes.length}
        isStarred={areAllSelectedStarred}
      />
    </main>
  );
}
