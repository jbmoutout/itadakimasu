"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Recipe } from "@/types";
import { Header } from "../components/layout/Header";
import { BottomOverlay } from "../components/layout/BottomOverlay";
import { AuthScreen } from "../components/auth/AuthScreen";
import { LoadingOverlay } from "../components/common/LoadingOverlay";
import { RecipeCard } from "../components/recipes/RecipeCard";
import { AddRecipeForm } from "../components/recipes/AddRecipeForm";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { DeleteConfirmationModal } from "../components/common/DeleteConfirmationModal";
import { useInView } from "react-intersection-observer";

// Cache for search results
const searchCache = new Map<string, boolean>();

interface PaginationData {
  total: number;
  pages: number;
  currentPage: number;
  hasMore: boolean;
}

export default function Home() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipes, setSelectedRecipes] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [isFetchingRecipes, setIsFetchingRecipes] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    pages: 0,
    currentPage: 1,
    hasMore: true,
  });

  // Intersection observer for infinite scroll
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
    rootMargin: "200px 0px", // Start loading 200px before reaching the bottom
  });

  const fetchRecipes = useCallback(
    async (page: number = 1, search: string = "") => {
      const token = localStorage.getItem("token");
      if (!token) {
        handleLogout();
        return;
      }

      setIsFetchingRecipes(true);
      const startTime = Date.now();

      try {
        const queryParams = new URLSearchParams({
          page: page.toString(),
          ...(search && { search }),
        });

        const res = await fetch(`/api/recipes?${queryParams.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "force-cache",
          next: {
            revalidate: 60,
          },
        });

        if (!res.ok) {
          if (res.status === 401) {
            handleLogout();
            return;
          }
          throw new Error(await res.text());
        }

        const data = await res.json();

        if (page === 1) {
          setRecipes(data.recipes);
        } else {
          setRecipes((prev) => [...prev, ...data.recipes]);
        }

        setPagination(data.pagination);

        // Update search cache
        searchCache.clear();
        data.recipes.forEach((recipe: Recipe) => {
          const cacheKey = `${recipe.id}-${search.toLowerCase()}`;
          searchCache.set(cacheKey, true);
        });

        // Ensure minimum loading time of 500ms for initial load
        if (isInitialLoad) {
          const elapsed = Date.now() - startTime;
          if (elapsed < 500) {
            await new Promise((resolve) => setTimeout(resolve, 500 - elapsed));
          }
          setIsInitialLoad(false);
        }
      } catch (error) {
        console.error("Error fetching recipes:", error);
        handleLogout();
      } finally {
        setIsFetchingRecipes(false);
      }
    },
    [isInitialLoad]
  );

  // Initial load
  useEffect(() => {
    if (isLoggedIn) {
      fetchRecipes(1, debouncedSearchQuery);
    }
  }, [isLoggedIn, debouncedSearchQuery]);

  // Infinite scroll
  useEffect(() => {
    if (inView && !isFetchingRecipes && pagination.hasMore) {
      fetchRecipes(pagination.currentPage + 1, debouncedSearchQuery);
    }
  }, [
    inView,
    isFetchingRecipes,
    pagination.hasMore,
    pagination.currentPage,
    debouncedSearchQuery,
  ]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setPagination((prev) => ({ ...prev, currentPage: 1 })); // Reset pagination on new search
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsLoggedIn(true);
      router.refresh();
    }
    setIsAuthChecking(false);
  }, [router]);

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
    setRecipes([]);
    setSelectedRecipes([]);
  };

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleSelectRecipe = (id: number) => {
    setSelectedRecipes((prev) =>
      prev.includes(id) ? prev.filter((rid) => rid !== id) : [...prev, id]
    );
  };

  const handleClearSelection = () => {
    setSelectedRecipes([]);
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
      // First get the most recent list
      const listsRes = await fetch("/api/saved-lists", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!listsRes.ok) {
        throw new Error("Failed to fetch saved lists");
      }

      const lists = await listsRes.json();
      const mostRecentList = lists[0]; // Lists are ordered by createdAt desc

      // Add recipes to the most recent list
      const res = await fetch("/api/saved-lists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipeIds: selectedRecipes,
          listId: mostRecentList?.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add recipes to list");
      }

      router.push("/");
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

  if (isAuthChecking) {
    return <LoadingOverlay />;
  }

  if (!isLoggedIn) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Header onLogout={handleLogout} />
      <div className="flex flex-col lg:flex-row">
        {/* Main content area */}
        <div className="flex-1 px-4 lg:px-10 pb-20 overflow-y-auto">
          <div className="fixed top-[48px] left-0 right-0 z-30 bg-gray-50 px-4 lg:px-10 py-4">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-2  focus:outline-none focus:ring-2 focus:ring-yellow-300 text-md bg-white"
            />
          </div>
          <div className="mt-[72px]">
            {(isFetchingRecipes && recipes.length === 0) || isInitialLoad ? (
              <div className="flex justify-center">
                <LoadingOverlay />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-8">
                  {recipes.map((recipe) => (
                    <RecipeCard
                      key={recipe.id}
                      recipe={recipe}
                      isSelected={selectedRecipes.includes(recipe.id)}
                      onSelect={() => handleSelectRecipe(recipe.id)}
                    />
                  ))}
                </div>
                {/* Infinite scroll trigger */}
                {pagination.hasMore && (
                  <div
                    ref={loadMoreRef}
                    className="h-10 flex items-center justify-center my-4"
                  >
                    {isFetchingRecipes && (
                      <div className="scale-50">
                        <LoadingOverlay />
                      </div>
                    )}
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
                      <div className="flex items-center gap-4 pt-4 border-t">
                        <div className="flex-1">
                          <p className="text-sm text-gray-600">
                            Want to delete selected recipes? Be careful, this
                            action cannot be undone.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="default"
                          className="h-11 px-4 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-300 text-red-700 gap-2"
                          onClick={() => setShowDeleteModal(true)}
                          disabled={selectedRecipes.length === 0}
                        >
                          <Trash2 className="h-5 w-5" />
                          <span className="font-medium">Delete Selected</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <BottomOverlay
        onSave={handleAddToList}
        onClearSelection={handleClearSelection}
        onToggleStar={handleToggleStar}
        onDelete={handleDelete}
        isSaving={isLoading}
        hasSelectedRecipes={selectedRecipes.length > 0}
        selectedCount={selectedRecipes.length}
        isStarred={areAllSelectedStarred}
      />
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => {
          handleDelete();
          setShowDeleteModal(false);
        }}
        count={selectedRecipes.length}
      />
    </main>
  );
}
