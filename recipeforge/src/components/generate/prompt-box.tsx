"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Sparkles } from "lucide-react";
import type { Recipe } from "@/types/recipe";

const SUGGESTIONS = {
  cuisines: ["Thai", "Italian", "Japanese", "Mexican", "Indian", "Chinese", "French", "Korean", "Mediterranean"],
  proteins: ["Chicken", "Beef", "Pork", "Fish", "Shrimp", "Tofu", "Lamb", "Duck"],
  diets: ["Vegetarian", "Vegan", "Gluten-free", "Keto", "Low-carb", "Dairy-free"],
  style: ["Quick weeknight", "Restaurant quality", "Comfort food", "Healthy", "Meal prep"],
  type: ["Curry", "Soup", "Pasta", "Stir-fry", "Grill", "Salad", "Dessert", "Appetizer"],
};

interface PromptBoxProps {
  onRecipeGenerated: (recipe: Recipe) => void;
  onLoading: (loading: boolean) => void;
}

export function PromptBox({ onRecipeGenerated, onLoading }: PromptBoxProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSuggestions, setActiveSuggestions] = useState<string[]>([]);
  const [suggestionOpen, setSuggestionOpen] = useState(false);

  const addSuggestion = (value: string) => {
    setPrompt((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed} ${value}` : value;
    });
    setActiveSuggestions((prev) => [...prev, value]);
    setSuggestionOpen(false);
  };

  const generate = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    onLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to generate recipe");
      }

      const data = await res.json();
      onRecipeGenerated(data.recipe);
      setPrompt("");
      setActiveSuggestions([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
      onLoading(false);
    }
  };

  return (
    <div className="paper rounded-xl p-5 space-y-4">
      {activeSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeSuggestions.map((s) => (
            <Badge key={s} variant="secondary" className="text-xs font-medium">
              {s}
            </Badge>
          ))}
        </div>
      )}

      <Input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && generate()}
        placeholder="What are you in the mood to cook?"
        disabled={loading}
        className="text-base h-12 border-2"
      />

      {error && (
        <p className="text-sm text-destructive animate-slide-up-in">{error}</p>
      )}

      <div className="flex gap-2 flex-wrap">
        <Popover open={suggestionOpen} onOpenChange={setSuggestionOpen}>
          <PopoverTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium border-2 border-border bg-background h-10 px-4 py-2 hover:bg-accent transition-colors">
            + Add detail
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0 rounded-xl overflow-hidden" align="start">
            <Command>
              <CommandInput placeholder="Search suggestions..." />
              <CommandList>
                {Object.entries(SUGGESTIONS).map(([category, items]) => (
                  <div key={category}>
                    <p className="text-xs text-muted-foreground px-3 py-1.5 font-semibold capitalize">
                      {category}
                    </p>
                    {items.map((item) => (
                      <CommandItem
                        key={item}
                        onSelect={() => addSuggestion(item)}
                        className="text-sm"
                      >
                        {item}
                      </CommandItem>
                    ))}
                  </div>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Button
          onClick={generate}
          disabled={loading || !prompt.trim()}
          size="lg"
          className="flex-1 text-base font-semibold"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
              Brewing...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Generate Recipe
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
