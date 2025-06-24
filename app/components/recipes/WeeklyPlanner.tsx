"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingOverlay } from "../common/LoadingOverlay";

interface RecipeWithAnalysis {
  id: number;
  title: string;
  description: string;
  image: string | null;
  url: string;
  starred: boolean;
  seasonalScore: number;
  healthScore: number;
  ingredientEfficiencyScore: number;
  reasoning: string;
  ingredients: Array<{
    name: string;
    englishName: string | null;
    isSeasonal: boolean;
  }>;
}

interface UsedRecipe {
  id: number;
  title: string;
  image: string | null;
  url: string;
  status: string;
  planDate: string;
}

interface WeeklyPlannerProps {
  onAddToSavedList: (recipeIds: number[]) => Promise<void>;
}

export const WeeklyPlanner = ({ onAddToSavedList }: WeeklyPlannerProps) => {
  const [weeklyPlan, setWeeklyPlan] = useState<RecipeWithAnalysis[]>([]);
  const [usedRecipes, setUsedRecipes] = useState<UsedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("plan");

  const getUserId = () => {
    const token = localStorage.getItem("token");
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.userId;
    } catch {
      return null;
    }
  };

  const generateWeeklyPlan = async () => {
    const userId = getUserId();
    if (!userId) {
      setError("User not authenticated");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/weekly-planner", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate weekly plan");
      }

      const data = await response.json();
      setWeeklyPlan(data.recipes);
    } catch (error) {
      console.error("Error generating weekly plan:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to generate weekly plan"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const fetchUsedRecipes = async () => {
    const userId = getUserId();
    if (!userId) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/weekly-planner/reset?userId=${userId}`
      );
      if (!response.ok) throw new Error("Failed to fetch used recipes");

      const data = await response.json();
      setUsedRecipes(data.usedRecipes);
    } catch (error) {
      console.error("Error fetching used recipes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetHistory = async () => {
    const userId = getUserId();
    if (!userId) return;

    if (
      !confirm(
        "Are you sure you want to reset your weekly plan history? This will clear all records of accepted, rejected, and suggested recipes."
      )
    ) {
      return;
    }

    try {
      const response = await fetch("/api/weekly-planner/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) throw new Error("Failed to reset history");

      const data = await response.json();
      alert(
        `History reset successfully! Deleted ${data.deletedCount} records.`
      );

      // Refresh the used recipes list
      await fetchUsedRecipes();
    } catch (error) {
      console.error("Error resetting history:", error);
      alert("Failed to reset history. Please try again.");
    }
  };

  const handleAcceptRecipe = async (recipeId: number) => {
    const userId = getUserId();
    if (!userId) return;

    try {
      // Record the acceptance
      await fetch("/api/weekly-plan-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, recipeId, status: "accepted" }),
      });

      // Add to saved list
      await onAddToSavedList([recipeId]);

      // Remove from current plan
      setWeeklyPlan((prev) => prev.filter((recipe) => recipe.id !== recipeId));

      alert("Recipe added to your saved list!");
    } catch (error) {
      console.error("Error accepting recipe:", error);
      alert("Failed to accept recipe. Please try again.");
    }
  };

  const handleRejectRecipe = async (recipeId: number) => {
    const userId = getUserId();
    if (!userId) return;

    try {
      // Record the rejection
      await fetch("/api/weekly-plan-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, recipeId, status: "rejected" }),
      });

      // Remove from current plan
      setWeeklyPlan((prev) => prev.filter((recipe) => recipe.id !== recipeId));

      alert("Recipe rejected. Generating alternative...");

      // Generate alternative recipe
      await generateWeeklyPlan();
    } catch (error) {
      console.error("Error rejecting recipe:", error);
      alert("Failed to reject recipe. Please try again.");
    }
  };

  useEffect(() => {
    fetchUsedRecipes();
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-100 text-green-800";
    if (score >= 60) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const renderRecipeCard = (recipe: RecipeWithAnalysis) => {
    return (
      <Card key={recipe.id} className="overflow-hidden">
        <div className="aspect-video relative bg-gray-200">
          {recipe.image ? (
            <img
              src={recipe.image}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              No image available
            </div>
          )}
        </div>
        <CardHeader>
          <CardTitle className="text-lg">{recipe.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="secondary"
              className={getScoreColor(recipe.seasonalScore * 100)}
            >
              Seasonal: {Math.round(recipe.seasonalScore * 100)}%
            </Badge>
            <Badge
              variant="secondary"
              className={getScoreColor(recipe.healthScore)}
            >
              Health: {recipe.healthScore}%
            </Badge>
            <Badge
              variant="secondary"
              className={getScoreColor(recipe.ingredientEfficiencyScore)}
            >
              Efficiency: {recipe.ingredientEfficiencyScore}%
            </Badge>
          </div>

          <p className="text-sm text-gray-600">{recipe.reasoning}</p>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Ingredients:</h4>
            <div className="flex flex-wrap gap-1">
              {recipe.ingredients.map((ingredient, index) => (
                <Badge
                  key={index}
                  variant={ingredient.isSeasonal ? "default" : "outline"}
                  className="text-xs"
                >
                  {ingredient.name}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => handleAcceptRecipe(recipe.id)}
              className="flex-1 bg-green-600 hover:bg-green-700"
              size="sm"
            >
              Accept
            </Button>
            <Button
              onClick={() => handleRejectRecipe(recipe.id)}
              variant="outline"
              size="sm"
            >
              Reject
            </Button>
            <Button asChild variant="outline" size="sm" className="px-2">
              <a
                href={recipe.url}
                target="_blank"
                rel="noopener noreferrer"
                title="View Recipe"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "suggested":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "accepted":
        return <CheckCircle className="w-4 h-4" />;
      case "rejected":
        return <XCircle className="w-4 h-4" />;
      case "suggested":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Weekly Planner</h1>
        </div>
        <Button
          onClick={generateWeeklyPlan}
          disabled={isGenerating}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isGenerating ? "Generating..." : "Generate Plan"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="plan">Weekly Plan</TabsTrigger>
          <TabsTrigger value="history">Recipe History</TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                </div>
              </div>
            </div>
          )}

          {weeklyPlan.length === 0 && !isGenerating && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No weekly plan generated yet
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Click &ldquo;Generate Plan&rdquo; to get personalized recipe
                    suggestions
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {isGenerating && <LoadingOverlay />}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {weeklyPlan.map((recipe) => renderRecipeCard(recipe))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Recipe History</h2>
            <Button
              onClick={resetHistory}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset History
            </Button>
          </div>

          {isLoading ? (
            <LoadingOverlay />
          ) : usedRecipes.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No recipe history yet
                  </h3>
                  <p className="text-gray-600">
                    Start using the weekly planner to build your recipe history
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {usedRecipes.map((recipe) => (
                <Card
                  key={`${recipe.id}-${recipe.planDate}`}
                  className="overflow-hidden"
                >
                  <div className="aspect-video relative bg-gray-200">
                    {recipe.image ? (
                      <img
                        src={recipe.image}
                        alt={recipe.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                        No image available
                      </div>
                    )}
                  </div>
                  <CardHeader>
                    <CardTitle className="text-lg">{recipe.title}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(recipe.status)}>
                        {getStatusIcon(recipe.status)}
                        {recipe.status}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {new Date(recipe.planDate).toLocaleDateString()}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <a
                        href={recipe.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View Recipe
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
