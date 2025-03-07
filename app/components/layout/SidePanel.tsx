import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MenuIcon, Star, Trash2, ShoppingCart } from "lucide-react";
import { Recipe, ShoppingList as ShoppingListType } from "@/types";
import { PantryList } from "../ingredients/PantryList";
import { Badge } from "../ui/badge";
import { Checkbox } from "../ui/checkbox";

interface SidePanelProps {
  savedRecipes?: Recipe[];
  gatheredIngredients?: Array<{
    ingredient: string;
    quantity: number;
    unit: string;
  }>;
  shoppingList?: ShoppingListType | null;
  onToggleRecipeStar: (recipeId: number) => Promise<void>;
  onRemoveRecipe: (recipeId: number) => Promise<void>;
  onToggleItem: (index: number) => void;
}

export function SidePanel({
  savedRecipes = [],
  gatheredIngredients = [],
  shoppingList,
  onToggleRecipeStar,
  onRemoveRecipe,
  onToggleItem,
}: SidePanelProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed top-4 right-4 z-50"
        >
          <MenuIcon className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[800px] sm:w-[1000px]">
        <SheetHeader>
          <SheetTitle>Your Kitchen</SheetTitle>
        </SheetHeader>
        <Tabs defaultValue="shopping" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="shopping">Shopping List</TabsTrigger>
            <TabsTrigger value="recipes">Recipes</TabsTrigger>
            <TabsTrigger value="gathered">To Gather</TabsTrigger>
            <TabsTrigger value="pantry">Pantry</TabsTrigger>
          </TabsList>
          <ScrollArea className="h-[calc(100vh-8rem)]">
            <TabsContent value="shopping" className="mt-4">
              <div className="space-y-6">
                {!shoppingList || shoppingList.items.length === 0 ? (
                  <p className="text-center text-muted-foreground">
                    No shopping list items
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {shoppingList.items.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={item.checked}
                            onCheckedChange={() => onToggleItem(index)}
                          />
                          <div>
                            <h3 className="font-medium">{item.ingredient}</h3>
                            <p className="text-sm text-muted-foreground">
                              {item.quantity} {item.unit}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {Array.isArray(item.recipes)
                                ? item.recipes.join(", ")
                                : item.recipes}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="recipes" className="mt-4">
              <div className="space-y-4">
                {savedRecipes.length === 0 ? (
                  <p className="text-center text-muted-foreground">
                    No saved recipes
                  </p>
                ) : (
                  savedRecipes.map((recipe) => (
                    <div
                      key={recipe.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <h3 className="font-medium">{recipe.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {recipe.url}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onToggleRecipeStar(recipe.id)}
                          className="h-8 w-8"
                        >
                          <Star
                            className={`h-4 w-4 ${
                              recipe.starred
                                ? "fill-yellow-400 text-yellow-400"
                                : ""
                            }`}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onRemoveRecipe(recipe.id)}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
            <TabsContent value="gathered" className="mt-4">
              <div className="space-y-6">
                {gatheredIngredients.length === 0 ? (
                  <p className="text-center text-muted-foreground">
                    No gathered ingredients
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {gatheredIngredients.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 border rounded-lg bg-secondary/50"
                      >
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <h3 className="font-medium">{item.ingredient}</h3>
                            <p className="text-sm text-muted-foreground">
                              {item.quantity} {item.unit}
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary">Gathered</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="pantry" className="mt-4">
              <PantryList />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
