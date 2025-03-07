"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PantryItem, Ingredient } from "@prisma/client";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

type PantryItemWithIngredient = PantryItem & {
  ingredient: Ingredient;
};

export function PantryList() {
  const [items, setItems] = useState<PantryItemWithIngredient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await fetch("/api/pantry");
      const data = await response.json();
      setItems(data);
    } catch (error) {
      console.error("Failed to fetch pantry items:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async (id: number) => {
    try {
      await fetch(`/api/pantry?id=${id}`, {
        method: "DELETE",
      });
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Failed to delete pantry item:", error);
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
              No items in pantry
            </p>
          </CardContent>
        </Card>
      ) : (
        items.map((item) => (
          <Card key={item.id}>
            <CardHeader className="flex flex-row items-center gap-4 py-4">
              <div className="flex-1">
                <CardTitle className="text-base">
                  {item.ingredient.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {item.quantity} {item.unit}
                  {item.expiryDate && (
                    <span className="ml-2">
                      Expires: {new Date(item.expiryDate).toLocaleDateString()}
                    </span>
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteItem(item.id)}
                className="h-8 w-8"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
          </Card>
        ))
      )}
    </div>
  );
}
