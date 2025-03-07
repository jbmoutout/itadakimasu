import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface AddRecipeFormProps {
  onSubmit: (url: string) => Promise<void>;
  isLoading: boolean;
}

export const AddRecipeForm = ({ onSubmit, isLoading }: AddRecipeFormProps) => {
  const [url, setUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(url);
    setUrl("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex align-middle gap-1">
      <Input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Enter recipe URL"
        required
        disabled={isLoading}
      />
      <Button type="submit" disabled={isLoading}>
        Add Recipe
      </Button>
    </form>
  );
};
