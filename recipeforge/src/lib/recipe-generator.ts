import type { Recipe } from "@/types/recipe";
import { getTheme } from "@/lib/themes";
import { braveSearch, fetchPageContent } from "@/lib/brave-search";
import { deepseek } from "@/lib/deepseek";

const RESEARCH_MODEL = process.env.DEEPSEEK_RESEARCH_MODEL || "deepseek-v4-pro";

async function callLLM(
  system: string,
  prompt: string,
  opts?: { research?: boolean }
): Promise<string> {
  const isResearch = opts?.research !== false;
  const response = await deepseek.chat.completions.create({
    model: isResearch ? RESEARCH_MODEL : "deepseek-chat",
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    temperature: isResearch ? 0.9 : 0.7,
    max_tokens: isResearch ? 8192 : 4096,
  });
  return response.choices[0]?.message?.content ?? "";
}

function buildRecipePrompt(
  userRequest: string,
  searchContext: string,
  version: "home" | "restaurant"
): string {
  const versionHint =
    version === "restaurant"
      ? "Create a RESTAURANT-QUALITY version — chef techniques, premium ingredients, elevated plating."
      : "Create a HOME-COOK version — practical for a home kitchen, accessible ingredients.";

  return `You are an expert chef and recipe developer. Create an authentic, meticulously researched recipe.

User request: "${userRequest}"

${versionHint}

${searchContext ? `RESEARCH FROM AUTHENTIC SOURCES:\n${searchContext}\n\nSYNTHESIZE the above sources critically. Note where they agree and where they differ. Pull the best elements from each. If sources conflict on key details (cooking time, spice ratios, core technique), explain your choice in sourceNotes. Prefer the most traditional or widely respected source.` : "Rely on your deep expertise for the most authentic version of this dish. Be specific about regional origins and traditional techniques."}

QUALITY REQUIREMENTS:
- Every ingredient must have a precise, realistic amount and unit
- Every step must be actionable — a home cook should be able to follow it
- Include sensory cues: what should it look like? smell like? what texture?
- Technique descriptions should teach, not just instruct
- Quantities must scale sensibly for the stated servings

Return ONLY valid JSON (no markdown, no code fences):
{
  "title": "Dish Name",
  "description": "One-sentence description",
  "cuisine": "thai|italian|japanese|mexican|indian|chinese|french|korean|mediterranean|american|middle-eastern|other",
  "category": "curry|soup|salad|pasta|stir-fry|grill|roast|bake|dessert|breakfast|appetizer|fried-rice|other",
  "prepTime": number_in_minutes,
  "cookTime": number_in_minutes,
  "totalTime": number_in_minutes,
  "difficulty": "easy|medium|hard",
  "servings": number,
  "ingredients": [
    {"name": "ingredient", "amount": number, "unit": "g|ml|tbsp|tsp|cup|piece|clove|inch|to taste", "notes": "optional prep note"}
  ],
  "steps": [
    {"order": 1, "instruction": "clear step", "duration": optional_minutes, "needsIllustration": true_if_complex_or_critical}
  ],
  "equipment": ["needed tools"],
  "nutrition": {"calories": number, "protein": number_g, "carbs": number_g, "fat": number_g, "fiber": optional_number_g},
  "tags": ["cuisine", "dietary", "occasion"],
  "version": "${version}",
  "sourceNotes": "Brief note about authenticity, sources used, and key decisions"
}`;
}

function buildSvgPrompt(
  steps: Array<{ order: number; instruction: string }>
): string {
  return `Create instructional SVG illustrations for these cooking steps. Return ONLY valid JSON (no markdown, no code fences):

{
  "illustrations": [
    {"id": "step-N", "label": "short description", "svg": "<svg>...</svg>"}
  ]
}

Steps:
${JSON.stringify(steps, null, 2)}

Requirements:
- viewBox="0 0 400 300"
- Simple, clear shapes for cooking instructions
- Warm, appetizing color palette
- Under 2000 characters each`;
}

function parseJSON(text: string): Record<string, unknown> {
  let cleaned = text.trim();
  // Strip code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/```(?:json)?\n?/g, "").trim();
  }
  // Find JSON object boundaries
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("Failed to parse JSON");
  }
}

function assembleRecipe(
  parsed: Record<string, unknown>,
  svgData: { illustrations: Array<{ id: string; label: string; svg: string }> },
): Recipe {
  const stepsArr = (parsed.steps as Array<Record<string, unknown>>) ?? [];
  const nutritionObj = parsed.nutrition as Record<string, number> | undefined;
  const cuisineStr = (parsed.cuisine as string) ?? "other";
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: (parsed.title as string) ?? "Untitled Recipe",
    description: (parsed.description as string) ?? "",
    cuisine: cuisineStr,
    category: (parsed.category as string) ?? "other",
    prepTime: (parsed.prepTime as number) ?? 0,
    cookTime: (parsed.cookTime as number) ?? 0,
    totalTime: (parsed.totalTime as number) ?? 0,
    difficulty: (parsed.difficulty as Recipe["difficulty"]) ?? "medium",
    servings: (parsed.servings as number) ?? 4,
    ingredients: (parsed.ingredients as Recipe["ingredients"]) ?? [],
    steps: stepsArr.map((s) => ({
      order: (s.order as number) ?? 0,
      instruction: (s.instruction as string) ?? "",
      duration: s.duration as number | undefined,
      svg: svgData.illustrations.find((ill) => ill.id === `step-${s.order}`)?.svg,
    })),
    equipment: (parsed.equipment as string[]) ?? [],
    nutrition: {
      calories: nutritionObj?.calories ?? 0,
      protein: nutritionObj?.protein ?? 0,
      carbs: nutritionObj?.carbs ?? 0,
      fat: nutritionObj?.fat ?? 0,
      fiber: nutritionObj?.fiber,
    },
    tags: (parsed.tags as string[]) ?? [],
    version: (parsed.version as "home" | "restaurant") ?? "home",
    theme: getTheme(cuisineStr),
    svgIllustrations: svgData.illustrations.map((ill) => ({
      id: ill.id,
      label: ill.label,
      svg: ill.svg,
    })),
    sourceNotes: (parsed.sourceNotes as string) ?? "",
    createdAt: now,
    updatedAt: now,
  };
}

export async function generateRecipe(
  userRequest: string,
  version: "home" | "restaurant" = "home"
): Promise<Recipe> {
  // 1. Search for authentic sources
  const searchResults = await braveSearch(`${userRequest} authentic recipe`);

  // 2. Fetch top results for context
  const pages = await Promise.all(
    searchResults.slice(0, 3).map((r) => fetchPageContent(r.url))
  );
  const searchContext = pages.filter(Boolean).join("\n\n---\n\n");

  // 3. Generate recipe JSON
  const recipePrompt = buildRecipePrompt(userRequest, searchContext, version);
  const recipeJson = await callLLM(
    "You are a James Beard award-winning chef and cookbook author. Your recipes are meticulously researched, culturally authentic, and written with warmth and precision. Every recipe must be genuinely cookable — no placeholder measurements, no vague instructions. Include specific techniques, visual cues (what to look for), and the WHY behind key steps. Quantities must be realistic and tested. Return ONLY valid JSON, no markdown.",
    recipePrompt
  );
  const parsed = parseJSON(recipeJson);

  // 4. Generate SVGs for flagged steps
  const stepsArr = (parsed.steps as Array<Record<string, unknown>>) ?? [];
  const stepsNeedingSvg = stepsArr
    .filter((s) => s.needsIllustration)
    .map((s) => ({ order: s.order as number, instruction: s.instruction as string }));

  let svgData: { illustrations: Array<{ id: string; label: string; svg: string }> } = {
    illustrations: [],
  };

  if (stepsNeedingSvg.length > 0) {
    try {
      const svgJson = await callLLM(
        "You are an SVG illustrator. Return ONLY valid JSON, no markdown.",
        buildSvgPrompt(stepsNeedingSvg),
        { research: false }
      );
      svgData = parseJSON(svgJson) as typeof svgData;
    } catch {
      // SVGs are non-critical
    }
  }

  return assembleRecipe(parsed, svgData);
}
