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
  const [shoppingListData, setShoppingListData] =
    useState<ShoppingListData | null>(null);
  const [newRecipeUrl, setNewRecipeUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [showLogin, setShowLogin] = useState<boolean>(true);

  useEffect(() => {
    fetchLastShoppingList();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsLoggedIn(true);
      fetchLastShoppingList();
    }
  }, []);

  const fetchLastShoppingList = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
    }
  };

  const addRecipe = async (e: React.FormEvent) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    e.preventDefault();
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
      setNewRecipeUrl("");
      alert("Recipe added successfully!");
    } else if (
      res.status === 400 &&
      data.error === "Recipe with this URL already exists"
    ) {
      alert("This recipe URL already exists in your collection.");
    } else {
      alert("Failed to add recipe. Please try again.");
    }
  };

  const toggleIngredient = async (category: string, index: number) => {
    const token = localStorage.getItem("token");
    if (!shoppingListData || !token) return;

    const updatedShoppingList = { ...shoppingListData };
    updatedShoppingList.shoppingList[category][index].checked =
      !updatedShoppingList.shoppingList[category][index].checked;

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
        <Button onClick={handleLogout}>Logout</Button>
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
      {shoppingListData && !isLoading && (
        <div className="mt-4">
          <Accordion type="single" collapsible>
            <AccordionItem value="item-1">
              <div className="flex items-baseline justify-between">
                <AccordionTrigger>
                  {" "}
                  <h3 className="text-xl font-bold">Recipes</h3>
                </AccordionTrigger>
                <Button
                  variant="outline"
                  onClick={generateShoppingList}
                  disabled={isLoading}
                >
                  {isLoading ? "Generating..." : "New List"}
                </Button>
              </div>
              <AccordionContent>
                <ul>
                  {shoppingListData.selectedRecipes.map((recipe, index) => {
                    const urlMatch = recipe.match(/(https?:\/\/[^\s]+)/);
                    const url = urlMatch ? urlMatch[0] : "";
                    const recipeName = recipe.replace(url, "").trim();

                    return (
                      <li key={index}>
                        - {recipeName}{" "}
                        {url && (
                          <Link
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            (Link)
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <h3 className="text-xl font-bold mt-4">List</h3>

          {Object.entries(shoppingListData.shoppingList)
            .sort(([a], [b]) => {
              if (a.includes("Pantry")) return 1;
              if (b.includes("Pantry")) return -1;
              return a.localeCompare(b);
            })
            .map(
              ([category, items]) =>
                items.length > 0 && (
                  <div key={category} className="mt-2">
                    <p className="text-md font-bold">{category}</p>
                    <ul>
                      {items.map((item, index) => (
                        <>
                          <li
                            key={index}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              checked={item.checked}
                              onCheckedChange={() =>
                                toggleIngredient(category, index)
                              }
                            />
                            <span
                              className={
                                item.checked ? "line-through text-gray-500" : ""
                              }
                            >
                              {item.ingredient}
                              {item.quantity &&
                                item.quantity !== 0 &&
                                `: ${item.quantity} `}
                              {item.unit && `${item.unit}`}
                            </span>
                          </li>
                          <p className="text-xs italic">{item.recipes}</p>
                        </>
                      ))}
                    </ul>
                  </div>
                )
            )}
        </div>
      )}
    </div>
  );
}
