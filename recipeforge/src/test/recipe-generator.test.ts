import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/brave-search", () => ({
  braveSearch: vi.fn(),
  fetchPageContent: vi.fn(),
}));

vi.mock("@/lib/deepseek", () => ({
  deepseek: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
}));

import { generateRecipe } from "@/lib/recipe-generator";
import { braveSearch, fetchPageContent } from "@/lib/brave-search";
import { deepseek } from "@/lib/deepseek";

const mockRecipe = {
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
    { name: "chicken thighs", amount: 500, unit: "g", notes: "boneless" },
    { name: "yogurt", amount: 200, unit: "ml" },
  ],
  steps: [
    { order: 1, instruction: "Marinate chicken.", duration: 120, needsIllustration: false },
    { order: 2, instruction: "Grill until charred.", duration: 10, needsIllustration: true },
  ],
  equipment: ["Large skillet"],
  nutrition: { calories: 450, protein: 32, carbs: 18, fat: 28, fiber: 3 },
  tags: ["indian", "curry"],
  version: "home",
  sourceNotes: "Based on Madhur Jaffrey and Dishoom",
};

const mockSvgResponse = {
  illustrations: [
    { id: "step-2", label: "Grilling", svg: '<svg viewBox="0 0 400 300"><circle cx="200" cy="150" r="50" fill="red"/></svg>' },
  ],
};

describe("generateRecipe", () => {
  it("generates a recipe with authenticity research", async () => {
    vi.mocked(braveSearch).mockResolvedValueOnce([
      { title: "Source 1", url: "https://example.com/1", description: "Recipe 1" },
    ]);
    vi.mocked(fetchPageContent).mockResolvedValueOnce("Full recipe content from source");
    vi.mocked(deepseek.chat.completions.create)
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockRecipe) } }],
      } as never)
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockSvgResponse) } }],
      } as never);

    const result = await generateRecipe("chicken tikka masala");

    expect(result.title).toBe("Chicken Tikka Masala");
    expect(result.cuisine).toBe("indian");
    expect(result.ingredients.length).toBe(2);
    expect(result.steps.length).toBe(2);
    expect(result.steps[1].svg).toBeTruthy(); // step 2 gets the SVG
    expect(result.nutrition.calories).toBe(450);
    expect(result.tags).toContain("indian");
  });

  it("includes cuisine-matched theme", async () => {
    vi.mocked(braveSearch).mockResolvedValueOnce([]);
    vi.mocked(fetchPageContent).mockResolvedValueOnce("");
    vi.mocked(deepseek.chat.completions.create)
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ ...mockRecipe, cuisine: "thai" }) } }],
      } as never)
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ illustrations: [] }) } }],
      } as never);

    const result = await generateRecipe("pad thai");
    expect(result.theme.primary).toBeTruthy();
    expect(result.theme.accent).toBeTruthy();
  });

  it("throws on unparseable LLM response", async () => {
    vi.mocked(braveSearch).mockResolvedValueOnce([]);
    vi.mocked(fetchPageContent).mockResolvedValueOnce("");
    vi.mocked(deepseek.chat.completions.create).mockResolvedValueOnce({
      choices: [{ message: { content: "not valid json {{{" } }],
    } as never);

    await expect(generateRecipe("test")).rejects.toThrow("Failed to parse JSON");
  });

  it("handles missing SVGs gracefully", async () => {
    vi.mocked(braveSearch).mockResolvedValueOnce([]);
    vi.mocked(fetchPageContent).mockResolvedValueOnce("");
    vi.mocked(deepseek.chat.completions.create)
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockRecipe) } }],
      } as never)
      .mockResolvedValueOnce({
        choices: [{ message: { content: "not json" } }],
      } as never);

    // Should not throw — SVGs are non-critical
    const result = await generateRecipe("test");
    expect(result.title).toBe("Chicken Tikka Masala");
    expect(result.svgIllustrations.length).toBe(0);
  });
});
