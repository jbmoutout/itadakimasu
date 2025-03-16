"use client";

import { useEffect, useState, useCallback } from "react";
import { SavedLists } from "./components/shopping/SavedLists";
import { Header } from "./components/layout/Header";
import { LoadingOverlay } from "./components/common/LoadingOverlay";
import { AuthScreen } from "./components/auth/AuthScreen";
import { useRouter } from "next/navigation";
import type { SavedList, SavedIngredient, Recipe } from "@/types";

export default function CookingPage() {
  const router = useRouter();
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [savedLists, setSavedLists] = useState<SavedList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSavedLists = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch("/api/saved-lists", {
        headers: { Authorization: `Bearer ${token}` },
        // cache: "force-cache",
        // next: {
        //   revalidate: 30,
        // },
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error === "Token has expired") {
          handleLogout();
          return;
        }
      }

      if (!res.ok) throw new Error("Failed to fetch saved lists");

      const data = await res.json();
      setSavedLists(data);

      // If there are no lists with recipes, redirect to /recipes
      if (
        data.length === 0 ||
        data.every((list: SavedList) => list.recipes.length === 0)
      ) {
        router.push("/recipes");
      }
    } catch (error) {
      console.error("Error fetching saved lists:", error);
      if (error instanceof Error && error.message.includes("Failed to fetch")) {
        handleLogout();
      }
    } finally {
      setIsLoading(false);
    }
  }, [router]);

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
      fetchSavedLists();
    }
  }, [isLoggedIn, fetchSavedLists]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
    setSavedLists([]);
  };

  const handleLogin = () => {
    setIsLoggedIn(true);
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
        (ingredient: SavedIngredient) => ingredient.id === ingredientId
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
                ingredients: list.ingredients.map(
                  (ingredient: SavedIngredient) =>
                    ingredient.id === ingredientId
                      ? updatedIngredient
                      : ingredient
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
      setSavedLists((prev) =>
        prev.map((list) => ({
          ...list,
          recipes: list.recipes.map((recipe: Recipe) =>
            recipe.id === recipeId ? updatedRecipe : recipe
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

  if (isAuthChecking) {
    return <LoadingOverlay />;
  }

  if (!isLoggedIn) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  if (isLoading) {
    return <LoadingOverlay />;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Header onLogout={handleLogout} />
      <div className="flex flex-col">
        <div className="w-full bg-white">
          <SavedLists
            savedLists={savedLists}
            onToggleIngredient={handleToggleIngredient}
            onToggleRecipeStar={handleToggleRecipeStar}
            onRemoveRecipe={handleRemoveRecipe}
          />
        </div>
      </div>
    </main>
  );
}
