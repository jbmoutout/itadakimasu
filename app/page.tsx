"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Login from "@/components/Login";
import Signup from "@/components/Signup";
import { useRouter } from "next/navigation";

type ShoppingListData = {
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

export default function Home() {
  const router = useRouter(); // Add this line near other hooks

  const [shoppingListData, setShoppingListData] =
    useState<ShoppingListData | null>(null);
  const [newRecipeUrl, setNewRecipeUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true); // Add this line
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [showLogin, setShowLogin] = useState<boolean>(true);
  const [selectedRecipes, setSelectedRecipes] = useState<number[]>([]);
  const [recipes, setRecipes] = useState<
    Array<{
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
    }>
  >([]);
  const [previewMetadata, setPreviewMetadata] = useState<{
    title?: string;
    description?: string;
    image?: string;
  } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const fetchUrlMetadata = async (url: string, recipeId: number) => {
    setIsLoadingPreview(true);
    try {
      // Validate URL first
      try {
        new URL(url);
      } catch (urlError) {
        const errorMessage =
          urlError instanceof Error ? urlError.message : "Unknown error";
        throw new Error(`Invalid URL format: ${errorMessage}`);
      }

      const res = await fetch(
        `/api/preview-metadata?url=${encodeURIComponent(
          url
        )}&recipeId=${recipeId}`
      );

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error("Failed to parse response:", text);
        throw new Error(
          `Invalid JSON response: ${
            parseError instanceof Error ? parseError.message : "Unknown error"
          }`
        );
      }

      if (!res.ok) {
        throw new Error(
          `HTTP ${res.status}: ${data.error}${
            data.details ? ` - ${data.details}` : ""
          }`
        );
      }

      if (!data.title && !data.description && !data.image) {
        console.warn("No metadata found in response for URL:", url);
      }

      setPreviewMetadata(data);
    } catch (error) {
      console.error("Error fetching preview:", {
        message: error instanceof Error ? error.message : "Unknown error",
        url: url,
        recipeId: recipeId,
      });
      setPreviewMetadata(null);
    } finally {
      setIsLoadingPreview(false);
      setPreviewMetadata(null);
    }
  };

  useEffect(() => {
    fetchLastShoppingList();
    fetchRecipes();
  }, [isLoggedIn]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsLoggedIn(true);
      fetchLastShoppingList();
      router.refresh();
    }
    setIsAuthChecking(false);
  }, []);

  const fetchRecipes = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setIsLoggedIn(false);
      return;
    }
    try {
      const res = await fetch("/api/recipes", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to fetch recipes");
      }
      const data = await res.json();
      setRecipes(data.recipes);

      // Check each recipe for ingredients and metadata
      for (const recipe of data.recipes) {
        if (!recipe.image) {
          fetchUrlMetadata(recipe.url, recipe.id);
        }

        // If recipe has no ingredients, extract them
        if (!recipe.ingredients || recipe.ingredients.length === 0) {
          setIsLoading(true);
          setLogs([]);
          try {
            const extractRes = await fetch("/api/extract-ingredients", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ recipeId: recipe.id }),
            });

            if (!extractRes.ok) {
              throw new Error("Failed to extract ingredients");
            }

            const reader = extractRes.body?.getReader();
            if (!reader) {
              throw new Error("Failed to get response reader");
            }

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = new TextDecoder().decode(value);
              const lines = chunk
                .split("\n")
                .filter((line) => line.trim() !== "");

              for (const line of lines) {
                try {
                  const data = JSON.parse(line);
                  if (data.log) {
                    setLogs((prevLogs) => [...prevLogs, data.log]);
                  }
                } catch (error) {
                  console.error("Error parsing JSON:", error);
                }
              }
            }
          } catch (error) {
            console.error("Error extracting ingredients:", error);
          }
        }
      }
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching recipes:", error);
      setIsLoading(false);
    }
  };

  const fetchLastShoppingList = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setIsLoggedIn(false);
      return;
    }
    try {
      const res = await fetch("/api/last-shopping-list", {
        headers: {
          Authorization: `Bearer ${token}`, // token should be stored securely, e.g., in localStorage
        },
      });
      if (!res.ok) {
        throw new Error("Failed to fetch last shopping list");
      }
      const data = await res.json();
      setShoppingListData(data.shoppingList);
    } catch (error) {
      console.error("Error fetching last shopping list:", error);
    }
  };

  const generateShoppingList = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setIsLoading(true);
    setLogs([]);
    try {
      const response = await fetch("/api/generate-shopping-list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipeIds: selectedRecipes }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch shopping list");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to get response reader");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.log) {
              setLogs((prevLogs) => [...prevLogs, data.log]);
            } else if (data.shoppingList) {
              setShoppingListData(data.shoppingList);
            }
          } catch (error) {
            console.error("Error parsing JSON:", error);
          }
        }
      }
    } catch (error) {
      console.error("Error generating shopping list:", error);
    } finally {
      setIsLoading(false);
      setSelectedRecipes([]);
    }
  };

  const addRecipe = async (e: React.FormEvent) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    e.preventDefault();

    try {
      // Add recipe
      const res = await fetch("/api/add-recipe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: newRecipeUrl }),
      });

      const data = await res.json();

      if (data.success) {
        setIsLoading(true);
        setLogs([]);

        // Extract ingredients with streaming response
        const extractRes = await fetch("/api/extract-ingredients", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ recipeId: data.recipe.id }),
        });

        if (!extractRes.ok) {
          throw new Error("Failed to extract ingredients");
        }

        const reader = extractRes.body?.getReader();
        if (!reader) {
          throw new Error("Failed to get response reader");
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split("\n").filter((line) => line.trim() !== "");

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.log) {
                setLogs((prevLogs) => [...prevLogs, data.log]);
              }
            } catch (error) {
              console.error("Error parsing JSON:", error);
            }
          }
        }

        setNewRecipeUrl("");
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
      console.error("Error in add recipe flow:", error);
      alert("An error occurred while adding the recipe.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleIngredient = async (index: number) => {
    const token = localStorage.getItem("token");
    if (!shoppingListData || !token) return;

    const updatedShoppingList = { ...shoppingListData };
    updatedShoppingList.shoppingList[index].checked =
      !updatedShoppingList.shoppingList[index].checked;

    setShoppingListData(updatedShoppingList);

    try {
      const response = await fetch("/api/update-shopping-list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedShoppingList),
      });

      if (!response.ok) {
        throw new Error("Failed to update shopping list");
      }
    } catch (error) {
      console.error("Error updating shopping list:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
    setShoppingListData(null);
  };

  if (isAuthChecking) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Image
          src="/images/loading.gif"
          alt="Loading..."
          width={500}
          height={0}
          style={{ width: "500px", height: "auto" }}
        />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="p-10">
        <div className="flex align-middle justify-between">
          <div className="flex align-middle gap-2">
            <Image
              src="/images/udon.png"
              alt="udon"
              width={30}
              height={0}
              style={{ width: "30px", height: "auto" }}
            />
            <h1 className="text-3xl">Itadakimasu</h1>
          </div>
        </div>
        <div className="mt-4">
          {showLogin ? <Login /> : <Signup />}
          <Button onClick={() => setShowLogin(!showLogin)}>
            {showLogin
              ? "Need an account? Sign up"
              : "Already have an account? Log in"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4">
      <div className="flex align-middle justify-between fixed left-0 right-0 top-0 px-10 bg-white z-50 pt-4">
        <div className="flex align-middle gap-2">
          <p className="text-lg font-bold font-sans">itadakimasu</p>
        </div>
        <div className="flex justify-between items-center mb-4">
          <Button
            onClick={generateShoppingList}
            disabled={selectedRecipes.length === 0 || isLoading}
            variant="outline"
          >
            {isLoading ? "Generating..." : "Generate Shopping List"}
          </Button>
          <Button variant="ghost" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
      <div className="p-10 pt-20">
        {isLoading && (
          <div className="mt-4">
            <Image
              src="/images/loading.gif"
              alt="Loading..."
              width={500}
              height={0}
              style={{ width: "500px", height: "auto" }}
            />
            <div className="bg-gray-900 text-white p-6 mt-4 font-mono text-sm">
              <h3>Server Logs</h3>
              <ul className="mt-2">
                {logs.map((log, index) => (
                  <li key={index}>{log}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {previewMetadata && !isLoadingPreview && (
          <div className="rounded-lg border p-4">
            {previewMetadata.image && (
              <div className="relative w-full h-40 mb-3">
                <Image
                  src={previewMetadata.image}
                  alt={previewMetadata.title || "Recipe preview"}
                  fill
                  className="object-cover rounded-md"
                />
              </div>
            )}
            <h3 className="font-medium line-clamp-2">
              {previewMetadata.title || "No title available"}
            </h3>
            {previewMetadata.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                {previewMetadata.description}
              </p>
            )}
          </div>
        )}
        <div className="mt-8">
          {shoppingListData && !isLoading && (
            <div className="mt-4">
              <Accordion type="single" collapsible>
                <AccordionItem value="item-1">
                  <AccordionTrigger>
                    <div className="flex items-baseline justify-between">
                      {" "}
                      <h3 className="text-xl font-bold">Recipes</h3>
                      <Button
                        className="ml-10"
                        variant="outline"
                        onClick={generateShoppingList}
                        disabled={isLoading}
                      >
                        {isLoading ? "Generating..." : "New List"}
                      </Button>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul>
                      {shoppingListData.selectedRecipes.map((recipe, index) => {
                        // const urlMatch = recipe.match(/(https?:\/\/[^\s]+)/);
                        // const url = urlMatch ? urlMatch[0] : "";
                        // const recipeName = recipe.replace(url, "").trim();
                        // return null;
                        return (
                          <div
                            key={recipe.id}
                            className={`p-2 transition-colors cursor-pointer ${
                              selectedRecipes.includes(recipe.id)
                                ? "bg-yellow-300"
                                : ""
                            }`}
                            onClick={() =>
                              setSelectedRecipes((prev) =>
                                prev.includes(recipe.id)
                                  ? prev.filter((id) => id !== recipe.id)
                                  : [...prev, recipe.id]
                              )
                            }
                          >
                            {recipe.image && (
                              <div className="relative w-full h-40 mb-3">
                                <Image
                                  src={recipe.image}
                                  alt={recipe.title || "Recipe preview"}
                                  fill
                                  className="object-cover"
                                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                />
                              </div>
                            )}

                            <Link
                              href={recipe.url}
                              target="_blank"
                              className="text-sm font-sans font-bold break-words"
                            >
                              {recipe.title}
                            </Link>
                            <div className="mt-4 text-sm flex flex-wrap gap-1 h-[70px] overflow-scroll">
                              {recipe.ingredients.map((ingredient, index) => {
                                return (
                                  <p key={index}>
                                    {ingredient.ingredient.name} {" / "}
                                  </p>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              <Accordion type="single" collapsible>
                <AccordionItem value="item-1">
                  <AccordionTrigger>
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-xl font-bold">List</h3>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul>
                      {shoppingListData.items.map((item, index) => (
                        <li key={index}>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={item.checked}
                              onCheckedChange={() => toggleIngredient(index)}
                            />
                            <span
                              className={
                                item.checked ? "line-through text-gray-500" : ""
                              }
                            >
                              {item.ingredient}
                              {item.quantity !== 0 &&
                                `: ${parseFloat(item.quantity.toFixed(2))} `}
                              {item.unit &&
                                item.unit !== "unit" &&
                                `${item.unit}`}
                            </span>
                          </div>
                          <p className="text-xs italic ml-6">{item.recipes}</p>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}
          <Button onClick={() => setSelectedRecipes([])} variant="outline">
            Clear Selection
          </Button>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {recipes.map((recipe) => {
              return (
                <div
                  key={recipe.id}
                  className={`p-2 transition-colors cursor-pointer ${
                    selectedRecipes.includes(recipe.id) ? "bg-yellow-300" : ""
                  }`}
                  onClick={() =>
                    setSelectedRecipes((prev) =>
                      prev.includes(recipe.id)
                        ? prev.filter((id) => id !== recipe.id)
                        : [...prev, recipe.id]
                    )
                  }
                >
                  {recipe.image && (
                    <div className="relative w-full h-40 mb-3">
                      <Image
                        src={recipe.image}
                        alt={recipe.title || "Recipe preview"}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    </div>
                  )}

                  <Link
                    href={recipe.url}
                    target="_blank"
                    className="text-sm font-sans font-bold break-words"
                  >
                    {recipe.title}
                  </Link>
                  <div className="mt-4 text-sm flex flex-wrap gap-1 h-[70px] overflow-scroll">
                    {recipe.ingredients.map((ingredient, index) => {
                      return (
                        <p key={index}>
                          {ingredient.ingredient.name} {" / "}
                        </p>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <form onSubmit={addRecipe} className="flex align-middle gap-1">
            <Input
              type="url"
              value={newRecipeUrl}
              onChange={(e) => setNewRecipeUrl(e.target.value)}
              placeholder="Enter recipe URL"
              required
            />
            <div>
              <Button type="submit">Add Recipe</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
