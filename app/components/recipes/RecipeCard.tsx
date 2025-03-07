import { Recipe } from "@/types";
import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";

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
            {recipe.ingredients?.map((ingredient, index) => (
              <li key={index} className="flex items-center">
                <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2" />
                <span className="truncate">{ingredient.ingredient.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
