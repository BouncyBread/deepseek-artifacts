"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { RecipeCard } from "@/components/recipe/recipe-card";
import { ChatDrawer } from "@/components/chat/chat-drawer";
import { PromptBox } from "@/components/generate/prompt-box";
import { RecipeGrid } from "@/components/library/recipe-grid";
import { ChefHat, Plus } from "lucide-react";
import type { Recipe } from "@/types/recipe";

function SteamLoader({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6">
      <div className="relative flex items-center justify-center">
        <span
          className="absolute h-1 w-12 rounded-full bg-warmth/20 animate-steam"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="absolute h-1 w-10 rounded-full bg-warmth/20 animate-steam"
          style={{ animationDelay: "400ms" }}
        />
        <span
          className="absolute h-1 w-14 rounded-full bg-warmth/20 animate-steam"
          style={{ animationDelay: "800ms" }}
        />
        <ChefHat className="h-12 w-12 text-primary animate-simmer" />
      </div>
      <p className="text-base text-muted-foreground font-medium">{text}</p>
    </div>
  );
}

function AuthGate({
  passphrase,
  setPassphrase,
  login,
  authError,
}: {
  passphrase: string;
  setPassphrase: (v: string) => void;
  login: () => void;
  authError: string;
}) {
  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="w-full max-w-sm">
        <div className="paper rounded-2xl p-8 space-y-6 text-center">
          <div className="space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent">
              <ChefHat className="h-8 w-8 text-primary" />
            </div>
            <h1
              className="text-3xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              RecipeForge
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your family cookbook, crafted with care.
              <br />
              Enter the shared passphrase to continue.
            </p>
          </div>

          <div className="space-y-3">
            <Input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
              placeholder="Passphrase"
              className="text-base h-12 text-center"
            />
            {authError && (
              <p className="text-sm text-destructive animate-slide-up-in">
                {authError}
              </p>
            )}
            <Button
              onClick={login}
              disabled={!passphrase.trim()}
              className="w-full h-12 text-base font-semibold"
            >
              Open the Cookbook
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [passphrase, setPassphrase] = useState("");
  const [authError, setAuthError] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [generating, setGenerating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [generateOpen, setGenerateOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    fetch("/api/auth", { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setAuthenticated(data.authenticated))
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeout);
        setAuthLoading(false);
      });
  }, []);

  const login = async () => {
    setAuthError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      if (res.ok) {
        setAuthenticated(true);
        setPassphrase("");
      } else {
        setAuthError("That passphrase didn't work. Try again?");
      }
    } catch {
      setAuthError("Something went wrong on our end. Try once more?");
    }
  };

  const handleRecipeGenerated = useCallback((recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setRefreshKey((k) => k + 1);
    setGenerateOpen(false);

    // Poll for SVG updates if recipe has no illustrations yet
    if (!recipe.svgIllustrations?.length) {
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch(`/api/recipes/${recipe.id}`);
          const data = await res.json();
          if (data.recipe?.svgIllustrations?.length > 0) {
            setSelectedRecipe(data.recipe);
            clearInterval(poll);
          }
        } catch {}
        if (attempts >= 15) clearInterval(poll); // stop after 30s
      }, 2000);
    }
  }, []);

  const handleRecipeUpdate = useCallback((recipe: Recipe) => {
    setSelectedRecipe(recipe);
  }, []);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <SteamLoader text="Warming up..." />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <AuthGate
        passphrase={passphrase}
        setPassphrase={setPassphrase}
        login={login}
        authError={authError}
      />
    );
  }

  if (selectedRecipe) {
    if (selectedRecipe.html) {
      return (
        <div className="relative min-h-screen animate-page-enter flex flex-col">
          <div className="p-4 md:p-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedRecipe(null)}
              className="mb-3 text-muted-foreground hover:text-foreground"
            >
              &larr; Back to library
            </Button>
          </div>
          <iframe
            srcDoc={selectedRecipe.html}
            className="flex-1 w-full border-0"
            sandbox="allow-scripts"
            title={selectedRecipe.title}
          />
          <ChatDrawer recipeId={selectedRecipe.id} onRecipeUpdate={handleRecipeUpdate} />
        </div>
      );
    }

    return (
      <div className="relative min-h-screen animate-page-enter">
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedRecipe(null)}
            className="mb-3 text-muted-foreground hover:text-foreground"
          >
            &larr; Back to library
          </Button>
          <RecipeCard recipe={selectedRecipe} />
        </div>
        <ChatDrawer recipeId={selectedRecipe.id} onRecipeUpdate={handleRecipeUpdate} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pb-24 md:p-6 md:pb-28 max-w-6xl mx-auto">
      <header className="mb-6 pt-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent">
            <ChefHat className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1
              className="text-2xl font-bold text-foreground leading-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              RecipeForge
            </h1>
            <p className="text-sm text-muted-foreground">
              Your family cookbook
            </p>
          </div>
        </div>
      </header>

      <RecipeGrid onSelectRecipe={setSelectedRecipe} refreshKey={refreshKey} />

      <Sheet open={generateOpen} onOpenChange={setGenerateOpen}>
        <SheetTrigger className="fixed bottom-6 right-6 z-40 rounded-full shadow-lg h-16 w-16 p-0 bg-primary text-primary-foreground flex items-center justify-center animate-warm-pulse transition-transform hover:scale-105 active:scale-95">
          <Plus className="h-7 w-7" />
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[45vh] rounded-t-2xl">
          <SheetHeader>
            <SheetTitle
              className="text-xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              What shall we cook?
            </SheetTitle>
          </SheetHeader>
          <div className="pt-4">
            <PromptBox
              onRecipeGenerated={handleRecipeGenerated}
              onLoading={setGenerating}
            />
          </div>
        </SheetContent>
      </Sheet>

      {generating && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center z-50 animate-blur-in">
          <SteamLoader text="Brewing your recipe..." />
        </div>
      )}
    </div>
  );
}
