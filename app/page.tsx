"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Recipe, ShoppingList } from "@/types";
import { Header } from "./components/layout/Header";
import { AuthScreen } from "./components/auth/AuthScreen";
import { LoadingOverlay } from "./components/common/LoadingOverlay";
import { ShoppingList as ShoppingListComponent } from "./components/shopping/ShoppingList";
import { RecipeCard } from "./components/recipes/RecipeCard";
import { AddRecipeForm } from "./components/recipes/AddRecipeForm";
import { Button } from "@/components/ui/button";
import { SidePanel } from "./components/layout/SidePanel";

export default function Home() {
  const router = useRouter();
  const [shoppingList, setShoppingList] = useState<ShoppingList | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipes, setSelectedRecipes] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [gatheredIngredients, setGatheredIngredients] = useState<
    Array<{ ingredient: string; quantity: number; unit: string }>
  >([]);

  const fetchRecipes = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch("/api/recipes", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch recipes");

      const data = await res.json();
      setRecipes(data);
    } catch (error) {
      console.error("Error fetching recipes:", error);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsLoggedIn(true);
      fetchLastShoppingList();
      router.refresh();
    }
    setIsAuthChecking(false);
  }, [router]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchLastShoppingList();
      fetchRecipes();
    }
  }, [isLoggedIn, fetchRecipes]);

  const fetchLastShoppingList = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch("/api/last-shopping-list", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch last shopping list");

      const data = await res.json();
      setShoppingList(data.shoppingList);
      setSavedRecipes(data.shoppingList?.selectedRecipes || []);
    } catch (error) {
      console.error("Error fetching last shopping list:", error);
      setSavedRecipes([]);
    }
  };

  const saveShoppingList = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setIsLoading(true);

    try {
      const selectedRecipesData = recipes.filter((recipe) =>
        selectedRecipes.includes(recipe.id)
      );

      // Generate shopping list
      const response = await fetch("/api/generate-shopping-list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipeIds: selectedRecipes }),
      });

      if (!response.ok) throw new Error("Failed to generate shopping list");

      const data = await response.json();

      // Ensure recipes are arrays in the shopping list items
      const shoppingListWithArrays = {
        ...data.shoppingList,
        selectedRecipes: selectedRecipesData,
        items: data.shoppingList.items.map((item: any) => ({
          ...item,
          recipes: Array.isArray(item.recipes) ? item.recipes : [item.recipes],
        })),
      };

      // Update both the shopping list and saved recipes
      setShoppingList(shoppingListWithArrays);
      setSavedRecipes(selectedRecipesData);
      setGatheredIngredients([]); // Reset gathered ingredients when saving new list
    } catch (error) {
      console.error("Error saving shopping list:", error);
    } finally {
      setIsLoading(false);
      setSelectedRecipes([]);
    }
  };

  const handleToggleIngredient = async (index: number) => {
    if (!shoppingList) return;

    const ingredient = shoppingList.items[index];
    setGatheredIngredients((prev) => [
      ...prev,
      {
        ingredient: ingredient.ingredient,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      },
    ]);

    const updatedList = {
      ...shoppingList,
      items: shoppingList.items.filter((_, i) => i !== index),
    };
    setShoppingList(updatedList);

    const token = localStorage.getItem("token");
    if (token) {
      try {
        await fetch("/api/update-shopping-list", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updatedList),
        });
      } catch (error) {
        console.error("Error updating shopping list:", error);
      }
    }
  };

  const handleToggleRecipeStar = async (recipeId: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch(`/api/recipes/${recipeId}/star`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to toggle recipe star");

      const updatedRecipe = await response.json();
      setRecipes((prev) =>
        prev.map((recipe) => (recipe.id === recipeId ? updatedRecipe : recipe))
      );
      setSavedRecipes((prev) =>
        prev.map((recipe) => (recipe.id === recipeId ? updatedRecipe : recipe))
      );
    } catch (error) {
      console.error("Error toggling recipe star:", error);
    }
  };

  const handleRemoveRecipe = async (recipeId: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch(`/api/recipes/${recipeId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to remove recipe");

      setRecipes((prev) => prev.filter((recipe) => recipe.id !== recipeId));
      setSavedRecipes((prev) =>
        prev.filter((recipe) => recipe.id !== recipeId)
      );

      // Update shopping list to remove ingredients from removed recipe
      if (shoppingList) {
        const updatedList = {
          ...shoppingList,
          items: shoppingList.items.filter(
            (item) =>
              !item.recipes.includes(
                recipes.find((r) => r.id === recipeId)?.title || ""
              )
          ),
        };
        setShoppingList(updatedList);

        await fetch("/api/update-shopping-list", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updatedList),
        });
      }
    } catch (error) {
      console.error("Error removing recipe:", error);
    }
  };

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
    setShoppingList(null);
  };

  if (isAuthChecking) {
    return <LoadingOverlay />;
  }

  if (!isLoggedIn) {
    return <AuthScreen />;
  }

  return (
    <div className="pt-4">
      <Header
        onSave={saveShoppingList}
        onLogout={handleLogout}
        isSaving={isLoading}
        hasSelectedRecipes={selectedRecipes.length > 0}
      />

      <div className="p-10 pt-20">
        {isLoading && <LoadingOverlay />}

        {/* {shoppingList && !isLoading && (
          <ShoppingListComponent
            data={shoppingList}
            selectedRecipes={selectedRecipes}
            onSelectRecipe={(id) =>
              setSelectedRecipes((prev) =>
                prev.includes(id)
                  ? prev.filter((rid) => rid !== id)
                  : [...prev, id]
              )
            }
            onToggleItem={handleToggleIngredient}
            onGenerateNew={saveShoppingList}
            isLoading={isLoading}
          />
        )} */}

        <Button onClick={() => setSelectedRecipes([])} variant="outline">
          Clear Selection
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              isSelected={selectedRecipes.includes(recipe.id)}
              onSelect={(id) =>
                setSelectedRecipes((prev) =>
                  prev.includes(id)
                    ? prev.filter((rid) => rid !== id)
                    : [...prev, id]
                )
              }
            />
          ))}
        </div>

        <div className="mt-4">
          <AddRecipeForm onSubmit={handleAddRecipe} isLoading={isLoading} />
        </div>
      </div>

      <SidePanel
        savedRecipes={savedRecipes}
        gatheredIngredients={gatheredIngredients}
        shoppingList={shoppingList}
        onToggleRecipeStar={handleToggleRecipeStar}
        onRemoveRecipe={handleRemoveRecipe}
        onToggleItem={handleToggleIngredient}
      />
    </div>
  );
}
