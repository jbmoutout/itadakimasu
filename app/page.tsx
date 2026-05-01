"use client";

import { useEffect, useState, useCallback } from "react";
import { SavedLists } from "./components/shopping/SavedLists";
import { Header } from "./components/layout/Header";
import { LoadingOverlay } from "./components/common/LoadingOverlay";
import { AuthScreen } from "./components/auth/AuthScreen";
import { useRouter } from "next/navigation";
import type { SavedList, SavedIngredient, Recipe } from "@/types";
import { apiFetch } from "./lib/api-fetch";

export default function CookingPage() {
  const router = useRouter();
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [savedLists, setSavedLists] = useState<SavedList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleLogout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    }
    setIsLoggedIn(false);
    setSavedLists([]);
  }, []);

  const fetchSavedLists = useCallback(async () => {
    try {
      const res = await apiFetch("/api/saved-lists");

      if (res.status === 401) {
        handleLogout();
        return;
      }

      if (!res.ok) throw new Error("Failed to fetch saved lists");

      const data = await res.json();
      setSavedLists(data);

      if (
        data.length === 0 ||
        data.every((list: SavedList) => list.recipes.length === 0)
      ) {
        router.push("/recipes");
      }
    } catch (error) {
      console.error("Error fetching saved lists:", error);
    } finally {
      setIsLoading(false);
    }
  }, [router, handleLogout]);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/auth/me")
      .then((res) => {
        if (cancelled) return;
        setIsLoggedIn(res.ok);
        setIsAuthChecking(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIsLoggedIn(false);
        setIsAuthChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchSavedLists();
    }
  }, [isLoggedIn, fetchSavedLists]);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleToggleIngredient = async (
    listId: number,
    ingredientId: number
  ) => {
    try {
      const currentList = savedLists.find((list) => list.id === listId);
      const currentIngredient = currentList?.ingredients.find(
        (ingredient: SavedIngredient) => ingredient.id === ingredientId
      );
      if (!currentIngredient) return;

      const res = await apiFetch("/api/saved-lists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
    try {
      const res = await apiFetch(`/api/recipes/${recipeId}/star`, {
        method: "PATCH",
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
    try {
      const res = await apiFetch(
        `/api/saved-lists/${listId}/recipes/${recipeId}`,
        { method: "DELETE" }
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
