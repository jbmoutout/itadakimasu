"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { GatheredItem, Ingredient } from "@prisma/client";
import { useEffect, useState } from "react";

type GatheredItemWithIngredient = GatheredItem & {
  ingredient: Ingredient;
};

export function GatheredList() {
  const [items, setItems] = useState<GatheredItemWithIngredient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await fetch("/api/gathered");
      const data = await response.json();
      setItems(data);
    } catch (error) {
      console.error("Failed to fetch gathered items:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGathered = async (itemId: number, gathered: boolean) => {
    try {
      const response = await fetch("/api/gathered", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: itemId, gathered }),
      });
      const updatedItem = await response.json();
      setItems((prev) =>
        prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
      );
    } catch (error) {
      console.error("Failed to update gathered status:", error);
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
      {items.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No items to gather
            </p>
          </CardContent>
        </Card>
      ) : (
        items.map((item) => (
          <Card key={item.id}>
            <CardHeader className="flex flex-row items-center gap-4 py-4">
              <Checkbox
                checked={item.gathered}
                onCheckedChange={(checked) =>
                  toggleGathered(item.id, checked as boolean)
                }
              />
              <div className="flex-1">
                <CardTitle className="text-base">
                  {item.ingredient.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {item.quantity} {item.unit}
                </p>
              </div>
            </CardHeader>
          </Card>
        ))
      )}
    </div>
  );
}
