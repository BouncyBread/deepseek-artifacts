"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Search, ChefHat, Trash2 } from "lucide-react";
import type { Recipe } from "@/types/recipe";

const CATEGORIES = [
  "All",
  "Curry",
  "Soup",
  "Pasta",
  "Stir-fry",
  "Grill",
  "Salad",
  "Dessert",
  "Breakfast",
];

interface RecipeGridProps {
  onSelectRecipe: (recipe: Recipe) => void;
  refreshKey: number;
}

export function RecipeGrid({ onSelectRecipe, refreshKey }: RecipeGridProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeTag, setActiveTag] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchRecipes = useCallback(async () => {
    // Only show full spinner on initial load; subsequent filters are backgrounded
    if (recipes.length === 0) setLoading(true);
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (activeCategory !== "All") params.set("category", activeCategory.toLowerCase());
    if (activeTag) params.set("tag", activeTag);

    try {
      const res = await fetch(`/api/recipes?${params.toString()}`);
      const data = await res.json();
      setRecipes(data.recipes ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, activeCategory, activeTag, recipes.length]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes, refreshKey]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/recipes/${deleteTarget.id}`, { method: "DELETE" });
      setRecipes((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    } catch {
      // silent
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (loading && recipes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="relative flex items-center justify-center">
          <span className="absolute h-1 w-10 rounded-full bg-warmth/20 animate-steam" style={{ animationDelay: "0ms" }} />
          <span className="absolute h-1 w-8 rounded-full bg-warmth/20 animate-steam" style={{ animationDelay: "400ms" }} />
          <span className="absolute h-1 w-12 rounded-full bg-warmth/20 animate-steam" style={{ animationDelay: "800ms" }} />
          <ChefHat className="h-8 w-8 text-primary/60 animate-simmer" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">Gathering recipes...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search recipes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 h-11 text-base"
            />
          </div>
        </div>

        <ScrollArea className="pb-2">
          <div className="flex gap-2">
            {CATEGORIES.map((cat) => (
              <Button
                key={cat}
                variant={activeCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory(cat)}
                className="shrink-0 rounded-full font-medium"
              >
                {cat}
              </Button>
            ))}
          </div>
        </ScrollArea>

        {recipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center mb-4">
              <ChefHat className="h-10 w-10 text-primary/50" />
            </div>
            <p className="text-lg font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
              No recipes yet
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Tap the + button to generate your first recipe. It will be warm and waiting for you here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger-children">
            {recipes.map((recipe) => (
              <div key={recipe.id} className="relative group/card">
                <Card
                  className="cursor-pointer paper rounded-xl transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] h-full"
                  onClick={() => onSelectRecipe(recipe)}
                >
                  <CardHeader className="p-4 pb-3">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <Badge variant="secondary" className="text-xs font-medium">
                        {recipe.cuisine}
                      </Badge>
                      <Badge variant="outline" className="text-xs font-medium">
                        {recipe.version === "home" ? "Home" : "Restaurant"}
                      </Badge>
                    </div>
                    <CardTitle
                      className="text-lg leading-snug"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {recipe.title}
                    </CardTitle>
                    <CardDescription className="text-sm line-clamp-2 mt-1 leading-relaxed">
                      {recipe.description}
                    </CardDescription>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-3 font-medium">
                      <span>{recipe.prepTime + recipe.cookTime} min</span>
                      <span>{recipe.difficulty}</span>
                      <span>{recipe.servings} servings</span>
                    </div>
                  </CardHeader>
                </Card>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(recipe);
                  }}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center bg-background/90 active:bg-destructive active:text-destructive-foreground text-muted-foreground shadow-sm transition-colors"
                  aria-label={`Delete ${recipe.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="rounded-xl max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>
              Delete recipe?
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              This will permanently remove <strong>{deleteTarget?.title}</strong>. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="flex-1"
            >
              Keep it
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1"
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
