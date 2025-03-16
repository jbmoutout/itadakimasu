import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";

interface BottomOverlayProps {
  onSave: () => void;
  onClearSelection: () => void;
  onToggleStar: () => void;
  onDelete: () => void;
  isSaving: boolean;
  hasSelectedRecipes: boolean;
  selectedCount: number;
  isStarred: boolean;
}

export const BottomOverlay = ({
  onSave,
  onClearSelection,
  onToggleStar,
  isSaving,
  hasSelectedRecipes,
  selectedCount,
  isStarred,
}: BottomOverlayProps) => {
  if (!hasSelectedRecipes) return null;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-40">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={onClearSelection}
                disabled={!hasSelectedRecipes}
                variant="ghost"
                className="hover:bg-gray-100"
                size="sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {selectedCount}
                  </span>
                  <span className="text-sm text-gray-600"> selected</span>
                </div>
              </Button>

              <div className="h-4 w-px bg-gray-200" />
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleStar}
                disabled={!hasSelectedRecipes}
                className="hover:bg-yellow-50"
              >
                {isStarred ? (
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                ) : (
                  <Star className="h-5 w-5" />
                )}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={onSave}
                disabled={!hasSelectedRecipes || isSaving}
                variant="outline"
                className="hover:bg-blue-50 hover:text-blue-600"
              >
                {isSaving ? "Adding..." : "Add to List"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
