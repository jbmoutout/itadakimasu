import { Recipe } from "@/types";
import Image from "next/image";
import Link from "next/link";

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
      className={`p-2 transition-colors cursor-pointer ${
        isSelected ? "bg-yellow-300" : ""
      }`}
      onClick={() => onSelect(recipe.id)}
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
        {recipe.ingredients.map((ingredient, index) => (
          <p key={index}>
            {ingredient.ingredient.name}
            {" / "}
          </p>
        ))}
      </div>
    </div>
  );
};
