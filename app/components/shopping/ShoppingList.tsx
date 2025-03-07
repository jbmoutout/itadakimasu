import { ShoppingList as ShoppingListType } from "@/types";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { RecipeCard } from "../recipes/RecipeCard";

interface ShoppingListProps {
  data: ShoppingListType;
  selectedRecipes: number[];
  onSelectRecipe: (id: number) => void;
  onToggleItem: (index: number) => void;
  onGenerateNew: () => void;
  isLoading: boolean;
}

export const ShoppingList = ({
  data,
  selectedRecipes,
  onSelectRecipe,
  onToggleItem,
  onGenerateNew,
  isLoading,
}: ShoppingListProps) => {
  return (
    <div className="mt-4">
      <Accordion type="single" collapsible>
        <AccordionItem value="recipes">
          <AccordionTrigger>
            <div className="flex items-baseline justify-between">
              <h3 className="text-xl font-bold">Recipes</h3>
              <Button
                className="ml-10"
                variant="outline"
                onClick={onGenerateNew}
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Save"}
              </Button>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.selectedRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  isSelected={selectedRecipes.includes(recipe.id)}
                  onSelect={onSelectRecipe}
                />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {data.items.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xl font-bold mb-4">Shopping List</h3>
          <ul className="space-y-2">
            {data.items.map((item, index) => (
              <li key={index} className="p-4 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={item.checked}
                    onCheckedChange={() => onToggleItem(index)}
                  />
                  <span
                    className={item.checked ? "line-through text-gray-500" : ""}
                  >
                    {item.ingredient}
                    {item.quantity !== 0 &&
                      `: ${parseFloat(item.quantity.toFixed(2))} `}
                    {item.unit && item.unit !== "unit" && item.unit}
                  </span>
                </div>
                <p className="text-xs italic ml-6">
                  {Array.isArray(item.recipes)
                    ? item.recipes.join(", ")
                    : item.recipes}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
