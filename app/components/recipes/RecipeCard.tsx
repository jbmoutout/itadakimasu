import { Recipe } from "@/types";
import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";

// Helper function to check if an ingredient is in season
const isIngredientInSeason = (
  seasons: Array<{ month: number }> | undefined
): boolean => {
  if (!seasons?.length) {
    console.log("No seasons data available");
    return false;
  }

  const currentMonth = new Date().getMonth() + 1; // 1-12
  const monthsToCheck = [
    (currentMonth - 2 + 12) % 12 || 12,
    (currentMonth - 1 + 12) % 12 || 12,
    currentMonth,
    (currentMonth + 1) % 12 || 12,
    (currentMonth + 2) % 12 || 12,
  ];

  const hasMatch = seasons.some((s) => monthsToCheck.includes(s.month));
  console.log("Checking seasons for ingredient:", {
    seasons: seasons.map((s) => s.month),
    currentMonth,
    monthsToCheck,
    hasMatch,
  });

  return hasMatch;
};

interface RecipeCardProps {
  recipe: Recipe;
  isSelected: boolean;
  onSelect: (id: number) => void;
}

export const RecipeCard = ({
  recipe,
  isSelected,
  onSelect,
}: RecipeCardProps) => {
  return (
    <div
      className={`p-2 transition-colors cursor-pointer relative ${
        isSelected ? "bg-yellow-300" : ""
      }`}
      onClick={() => onSelect(recipe.id)}
    >
      {recipe.starred && (
        <div className="absolute top-2 right-2 z-10 bg-white/90 p-1 shadow-md">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        </div>
      )}
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

      <div className="mt-4 text-sm">
        <p className="text-gray-500 mb-2">
          {recipe.ingredients?.length || 0} ingredients:
        </p>
        <div className="h-[70px] overflow-y-auto">
          <ul className="space-y-1">
            {recipe.ingredients?.map((ingredient, index) => {
              console.log("Ingredient:", ingredient);
              const isInSeason = isIngredientInSeason(
                ingredient.ingredient.seasons
              );
              console.log("Ingredient seasonality:", {
                name: ingredient.ingredient.name,
                seasons: ingredient.ingredient.seasons?.map((s) => s.month),
                isInSeason,
              });
              return (
                <li key={index} className="flex items-center">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2" />
                  <span className="truncate inline-flex items-center">
                    {ingredient.ingredient.name}
                    {isInSeason && <span className="ml-1">🌱</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
};
