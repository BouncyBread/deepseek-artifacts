import type { Recipe } from "@/types/recipe";
import { getTheme } from "@/lib/themes";
import { braveSearch } from "@/lib/brave-search";
import { deepseek } from "@/lib/deepseek";

async function callLLM(
  system: string,
  prompt: string,
  opts?: { maxTokens?: number }
): Promise<string> {
  const response = await deepseek.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    temperature: 0.9,
    max_tokens: opts?.maxTokens ?? 8192,
  });
  return response.choices[0]?.message?.content ?? "";
}

const HTML_SYSTEM_PROMPT = `You are a James Beard award-winning chef and cookbook author who also designs beautiful HTML. You create self-contained recipe pages with warm typography, hand-crafted SVGs, and sensory writing.

Your pages use:
- Google Fonts: Fraunces for headings, Newsreader or Source Serif for body
- Warm, natural color palette (no #000, no #fff, no blue defaults)
- Paper texture via CSS gradients
- Hand-crafted inline SVGs that teach techniques or show visual cues
- Responsive layout that works on mobile and desktop
- Light mode only`;

function buildHtmlPrompt(
  userRequest: string,
  searchContext: string,
  version: "home" | "restaurant"
): string {
  const versionHint =
    version === "restaurant"
      ? "RESTAURANT-QUALITY: chef techniques, premium ingredients, elevated plating."
      : "HOME-COOK: practical kitchen, accessible ingredients, achievable techniques.";

  return `Create a beautiful, self-contained HTML recipe.

USER REQUEST: "${userRequest}"
VERSION: ${versionHint}

${searchContext ? `RESEARCH:\n${searchContext}\n\nSynthesize the best elements from these sources.` : "Draw on your culinary expertise."}

INCLUDE:
1. Hero with dish name, description, and a hand-crafted SVG of the finished dish
2. Cultural context paragraph about the dish's origins
3. Ingredients with precise amounts, organized in groups
4. Equipment list with notes about specific gear
5. Numbered instructions — each step includes the WHY behind the technique and a sensory cue
6. 3-5 pro tips
7. Storage guidance
8. Optional: alternative method

DESIGN:
- Warm, cookbook-inspired CSS in a <style> tag
- Hand-crafted SVGs at key steps (viewBox="0 0 520 200", warm natural colors)
- Responsive, light mode, generous typography
- Google Fonts via @import

Return ONLY the complete HTML (starts with <!doctype html>). No code fences.`;
}

function buildMetadataPrompt(html: string): string {
  return `Extract recipe metadata from this HTML. Return ONLY valid JSON (no markdown, no code fences):

{
  "title": "English dish name",
  "description": "One warm sentence",
  "cuisine": "thai|italian|japanese|mexican|indian|chinese|french|korean|mediterranean|american|middle-eastern|other",
  "category": "curry|soup|salad|pasta|stir-fry|grill|roast|bake|dessert|breakfast|appetizer|fried-rice|porridge|other",
  "prepTime": number_minutes,
  "cookTime": number_minutes,
  "totalTime": number_minutes,
  "difficulty": "easy|medium|hard",
  "servings": number,
  "tags": ["tag1", "tag2"],
  "sourceNotes": "Brief source note"
}

HTML START:
${html.slice(0, 6000)}`;
}

function parseJSON(text: string): Record<string, unknown> {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/```(?:json)?\n?/g, "").trim();
  }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("Failed to parse JSON from LLM response");
  }
}

function extractMetadata(
  parsed: Record<string, unknown>,
  html: string,
  id: string
): Recipe {
  const cuisineStr = (parsed.cuisine as string) ?? "other";
  const now = new Date().toISOString();

  return {
    id,
    title: (parsed.title as string) ?? "Untitled Recipe",
    description: (parsed.description as string) ?? "",
    cuisine: cuisineStr,
    category: (parsed.category as string) ?? "other",
    prepTime: (parsed.prepTime as number) ?? 0,
    cookTime: (parsed.cookTime as number) ?? 0,
    totalTime: (parsed.totalTime as number) ?? 0,
    difficulty: (parsed.difficulty as Recipe["difficulty"]) ?? "medium",
    servings: (parsed.servings as number) ?? 4,
    ingredients: [],
    steps: [],
    equipment: [],
    nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    tags: (parsed.tags as string[]) ?? [],
    version: (parsed.version as "home" | "restaurant") ?? "home",
    theme: getTheme(cuisineStr),
    svgIllustrations: [],
    html,
    sourceNotes: (parsed.sourceNotes as string) ?? "",
    createdAt: now,
    updatedAt: now,
  };
}

export async function generateRecipe(
  userRequest: string,
  version: "home" | "restaurant" = "home"
): Promise<Recipe> {
  // 1. Search for authentic sources (titles + descriptions only, no page fetch)
  let searchContext = "";
  try {
    const results = await braveSearch(`${userRequest} authentic recipe`);
    if (results.length > 0) {
      searchContext = results
        .map((r) => `${r.title}: ${r.description}`)
        .join("\n");
    }
  } catch {
    // Non-critical — generation works without search
  }

  // 2. Generate the full HTML recipe page
  const html = await callLLM(
    HTML_SYSTEM_PROMPT,
    buildHtmlPrompt(userRequest, searchContext, version),
    { maxTokens: 8192 }
  );

  // 3. Extract metadata from the HTML
  const metadataJson = await callLLM(
    "You extract metadata from recipe HTML. Return ONLY valid JSON.",
    buildMetadataPrompt(html),
    { maxTokens: 1024 }
  );
  const metadata = parseJSON(metadataJson);

  const id = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return extractMetadata(metadata, html, id);
}
