import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecipeCard } from "@/components/recipe/recipe-card";
import type { Recipe } from "@/types/recipe";

const testRecipe: Recipe = {
  id: "test-1",
  title: "Chicken Tikka Masala",
  description: "A rich, creamy Indian curry.",
  cuisine: "indian",
  category: "curry",
  prepTime: 15,
  cookTime: 35,
  totalTime: 50,
  difficulty: "medium",
  servings: 4,
  ingredients: [
    { name: "chicken thighs", amount: 500, unit: "g" },
    { name: "tomato puree", amount: 400, unit: "ml" },
    { name: "heavy cream", amount: 200, unit: "ml" },
  ],
  steps: [
    { order: 1, instruction: "Marinate chicken for 2 hours." },
    { order: 2, instruction: "Grill chicken until charred.", svg: '<svg viewBox="0 0 400 300"><circle cx="200" cy="150" r="50" fill="red"/></svg>' },
    { order: 3, instruction: "Simmer in sauce for 15 minutes." },
  ],
  equipment: ["Large skillet", "Grill pan"],
  nutrition: { calories: 450, protein: 32, carbs: 18, fat: 28, fiber: 3 },
  tags: ["indian", "curry", "creamy"],
  version: "home",
  theme: {
    primary: "#D43615",
    secondary: "#F7C948",
    accent: "#2E7D32",
    background: "#FFFDF5",
    text: "#1A0D00",
    muted: "#FEF3C7",
    fontFamily: "Georgia, serif",
  },
  svgIllustrations: [],
  sourceNotes: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("RecipeCard", () => {
  it("renders the recipe title", () => {
    render(<RecipeCard recipe={testRecipe} />);
    expect(screen.getByText("Chicken Tikka Masala")).toBeInTheDocument();
  });

  it("renders the description", () => {
    render(<RecipeCard recipe={testRecipe} />);
    expect(screen.getByText("A rich, creamy Indian curry.")).toBeInTheDocument();
  });

  it("renders cuisine badge", () => {
    render(<RecipeCard recipe={testRecipe} />);
    const badges = screen.getAllByText("indian");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("renders ingredients with amounts", () => {
    render(<RecipeCard recipe={testRecipe} />);
    expect(screen.getByText(/chicken thighs/)).toBeInTheDocument();
    expect(screen.getByText(/500g/)).toBeInTheDocument();
    expect(screen.getByText(/tomato puree/)).toBeInTheDocument();
    expect(screen.getByText(/400ml/)).toBeInTheDocument();
  });

  it("renders steps in order", () => {
    render(<RecipeCard recipe={testRecipe} />);
    expect(screen.getByText(/Marinate chicken/)).toBeInTheDocument();
    expect(screen.getByText(/Grill chicken/)).toBeInTheDocument();
    expect(screen.getByText(/Simmer in sauce/)).toBeInTheDocument();
  });

  it("renders nutrition info", () => {
    render(<RecipeCard recipe={testRecipe} />);
    expect(screen.getByText("450")).toBeInTheDocument();
    expect(screen.getByText("32g")).toBeInTheDocument();
    expect(screen.getByText("protein")).toBeInTheDocument();
  });

  it("renders serving size", () => {
    render(<RecipeCard recipe={testRecipe} />);
    expect(screen.getByText(/4 servings/)).toBeInTheDocument();
  });

  it("applies theme colors", () => {
    render(<RecipeCard recipe={testRecipe} />);
    const card = screen.getByTestId("recipe-card");
    // Theme colors are applied as CSS variables on a style attribute
    expect(card.style.getPropertyValue("--primary")).toBe("#D43615");
  });

  it("renders version badge", () => {
    render(<RecipeCard recipe={testRecipe} />);
    expect(screen.getByText("Home Cook")).toBeInTheDocument();
  });
});
