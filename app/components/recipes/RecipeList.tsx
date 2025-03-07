"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Recipe } from "@prisma/client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Star } from "lucide-react";

export function RecipeList() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    try {
      const response = await fetch("/api/recipes");
      const data = await response.json();
      // Sort recipes: starred first, then by creation date
      const sortedRecipes = data.sort((a: Recipe, b: Recipe) => {
        if (a.starred && !b.starred) return -1;
        if (!a.starred && b.starred) return 1;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
      setRecipes(sortedRecipes);
    } catch (error) {
      console.error("Failed to fetch recipes:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStar = async (recipeId: number) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch("/api/rating", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipeId }),
      });

      if (response.ok) {
        // Update local state
        setRecipes((prev) =>
          prev.map((recipe) =>
            recipe.id === recipeId
              ? { ...recipe, starred: !recipe.starred }
              : recipe
          )
        );
      }
    } catch (error) {
      console.error("Failed to toggle star:", error);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {recipes.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No recipes saved yet
            </p>
          </CardContent>
        </Card>
      ) : (
        recipes.map((recipe) => (
          <Card
            key={recipe.id}
            className="hover:bg-accent/50 cursor-pointer transition-colors"
          >
            <CardHeader className="flex flex-row items-center gap-4">
              {recipe.image && (
                <div className="relative h-16 w-16 overflow-hidden rounded-md">
                  <Image
                    src={recipe.image}
                    alt={recipe.title || "Recipe image"}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex-1">
                <CardTitle className="line-clamp-1">{recipe.title}</CardTitle>
                {recipe.description && (
                  <CardDescription className="line-clamp-2">
                    {recipe.description}
                  </CardDescription>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleStar(recipe.id);
                }}
                className={`h-8 w-8 ${recipe.starred ? "text-yellow-500" : ""}`}
              >
                <Star
                  className="h-4 w-4"
                  fill={recipe.starred ? "currentColor" : "none"}
                />
              </Button>
            </CardHeader>
          </Card>
        ))
      )}
    </div>
  );
}
