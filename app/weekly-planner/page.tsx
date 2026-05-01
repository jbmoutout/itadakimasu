"use client";

import { useEffect, useState } from "react";
import { Header } from "../components/layout/Header";
import { WeeklyPlanner } from "../components/recipes/WeeklyPlanner";
import { LoadingOverlay } from "../components/common/LoadingOverlay";
import { AuthScreen } from "../components/auth/AuthScreen";
import type { SavedList } from "@/types";
import { apiFetch } from "../lib/api-fetch";

export default function WeeklyPlannerPage() {
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [savedLists, setSavedLists] = useState<SavedList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    }
    setIsLoggedIn(false);
    setSavedLists([]);
  };

  const fetchSavedLists = async () => {
    try {
      const res = await apiFetch("/api/saved-lists");

      if (res.status === 401) {
        handleLogout();
        return;
      }

      if (!res.ok) throw new Error("Failed to fetch saved lists");

      const data = await res.json();
      setSavedLists(data);
    } catch (error) {
      console.error("Error fetching saved lists:", error);
    } finally {
      setIsLoading(false);
    }
  };

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
  }, [isLoggedIn]);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleAddToSavedList = async (recipeIds: number[]) => {
    try {
      let listId = savedLists[0]?.id;

      if (!listId) {
        const createResponse = await apiFetch("/api/saved-lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipeIds: [] }),
        });

        if (!createResponse.ok) throw new Error("Failed to create saved list");
        const newList = await createResponse.json();
        listId = newList.id;
        setSavedLists([newList]);
      }

      const response = await apiFetch("/api/saved-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeIds, listId }),
      });

      if (!response.ok) throw new Error("Failed to add recipes to saved list");

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
