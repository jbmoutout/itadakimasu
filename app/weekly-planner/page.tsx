"use client";

import { useEffect, useState } from "react";
import { Header } from "../components/layout/Header";
import { WeeklyPlanner } from "../components/recipes/WeeklyPlanner";
import { LoadingOverlay } from "../components/common/LoadingOverlay";
import { AuthScreen } from "../components/auth/AuthScreen";
import { useRouter } from "next/navigation";
import type { SavedList } from "@/types";

export default function WeeklyPlannerPage() {
  const router = useRouter();
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [savedLists, setSavedLists] = useState<SavedList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSavedLists = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch("/api/saved-lists", {
        headers: { Authorization: `Bearer ${token}` },
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
    } catch (error) {
      console.error("Error fetching saved lists:", error);
      if (error instanceof Error && error.message.includes("Failed to fetch")) {
        handleLogout();
      }
    } finally {
      setIsLoading(false);
    }
  };

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
  }, [isLoggedIn]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
    setSavedLists([]);
  };

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleAddToSavedList = async (recipeIds: number[]) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      // Get the first saved list or create a new one
      let listId = savedLists[0]?.id;

      if (!listId) {
        // Create a new list if none exists
        const createResponse = await fetch("/api/saved-lists", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            recipeIds: [],
          }),
        });

        if (!createResponse.ok) throw new Error("Failed to create saved list");
        const newList = await createResponse.json();
        listId = newList.id;
        setSavedLists([newList]);
      }

      // Add recipes to the list
      const response = await fetch("/api/saved-lists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipeIds,
          listId,
        }),
      });

      if (!response.ok) throw new Error("Failed to add recipes to saved list");

      // Refresh the saved lists
      await fetchSavedLists();
    } catch (error) {
      console.error("Error adding recipes to saved list:", error);
      throw error;
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
      <div className="container mx-auto px-4 py-8">
        <WeeklyPlanner onAddToSavedList={handleAddToSavedList} />
      </div>
    </main>
  );
}
