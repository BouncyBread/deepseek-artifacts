import type { Recipe } from "@/types/recipe";
import { getTheme } from "@/lib/themes";
import { braveSearch, fetchPageContent } from "@/lib/brave-search";
import { deepseek } from "@/lib/deepseek";

const SYSTEM_PROMPT = `You are a James Beard award-winning chef and cookbook author. Create richly detailed, authentic recipes.

Your recipes include: warm cultural context, sensory language, WHY behind each technique, precise measurements, pro tips, storage guidance, and alternative methods.

Return ONLY valid JSON, no markdown wrapping.`;

function buildPrompt(
  userRequest: string,
  searchContext: string,
  version: "home" | "restaurant"
): string {
  const vh =
    version === "restaurant"
      ? "RESTAURANT-QUALITY: chef techniques, premium ingredients, professional equipment."
      : "HOME-COOK: practical kitchen, accessible ingredients, achievable techniques.";

  return `Create an authentic, richly detailed recipe.

USER REQUEST: "${userRequest}"
VERSION: ${vh}

${searchContext ? `RESEARCH:\n${searchContext}\n\nSynthesize these sources for authenticity.` : "Draw on your deep culinary expertise."}

Return ONLY valid JSON:
{
  "title": "English dish name",
  "originalTitle": "Local/original name or null",
  "description": "One warm, inviting sentence",
  "culturalContext": "Warm paragraph about the dish's origins, cultural meaning, when it's eaten, who makes it",
  "cuisine": "thai|italian|japanese|mexican|indian|chinese|french|korean|mediterranean|american|middle-eastern|other",
  "category": "curry|soup|salad|pasta|stir-fry|grill|roast|bake|dessert|breakfast|appetizer|fried-rice|porridge|other",
  "prepTime": int_minutes,
  "cookTime": int_minutes,
  "totalTime": int_minutes,
  "difficulty": "easy|medium|hard",
  "servings": int,
  "ingredients": [
    {"name": "ingredient", "amount": number, "unit": "tbsp|tsp|cup|g|ml|lb|oz|piece|clove|inch|to taste", "notes": "prep note or substitution"}
  ],
  "steps": [
    {
      "order": 1,
      "instruction": "Clear, sensory instruction",
      "why": "Why this technique matters",
      "sensoryCue": "What to look, smell, or feel for",
      "duration": optional_minutes,
      "callout": "Critical warning or tip — null if not needed"
    }
  ],
  "equipment": ["needed tools"],
  "equipmentNotes": "Specific gear guidance or null",
  "nutrition": {"calories": per_serving, "protein": g, "carbs": g, "fat": g, "fiber": optional_g},
  "tags": ["cuisine", "dietary", "occasion"],
  "proTips": ["3-5 things a home cook wouldn't know"],
  "storage": "How to store, how long, how to reheat properly",
  "alternativeMethods": [
    {"name": "Method name", "description": "When to use it", "steps": ["step by step"]}
  ],
  "version": "${version}",
  "sourceNotes": "Sources used and key decisions"
}`;
}

async function parseJSON(text: string): Promise<Record<string, unknown>> {
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
    const fixResponse = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "Fix this malformed JSON. Return ONLY corrected valid JSON, no markdown." },
        { role: "user", content: cleaned.slice(0, 12000) },
      ],
      temperature: 0,
      max_tokens: 4096,
    });
    const fixed = fixResponse.choices[0]?.message?.content ?? "";
    let reCleaned = fixed.trim();
    if (reCleaned.startsWith("```")) reCleaned = reCleaned.replace(/```(?:json)?\n?/g, "").trim();
    const fb = reCleaned.indexOf("{"), lb = reCleaned.lastIndexOf("}");
    if (fb !== -1 && lb > fb) reCleaned = reCleaned.slice(fb, lb + 1);
    return JSON.parse(reCleaned);
  }
}

function assembleRecipe(parsed: Record<string, unknown>): Recipe {
  const stepsArr = (parsed.steps as Array<Record<string, unknown>>) ?? [];
  const nutritionObj = parsed.nutrition as Record<string, number> | undefined;
  const cuisineStr = (parsed.cuisine as string) ?? "other";
  const now = new Date().toISOString();
  const altMethodsArr = (parsed.alternativeMethods as Array<Record<string, unknown>>) ?? [];

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: (parsed.title as string) ?? "Untitled",
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
      why: s.why as string | undefined,
      sensoryCue: s.sensoryCue as string | undefined,
      callout: s.callout as string | undefined,
    })),
    equipment: (parsed.equipment as string[]) ?? [],
    equipmentNotes: (parsed.equipmentNotes as string) ?? undefined,
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
    svgIllustrations: [],
    culturalContext: (parsed.culturalContext as string) ?? undefined,
    proTips: (parsed.proTips as string[]) ?? undefined,
    storage: (parsed.storage as string) ?? undefined,
    alternativeMethods: altMethodsArr.length > 0
      ? altMethodsArr.map((m) => ({
          name: (m.name as string) ?? "",
          description: (m.description as string) ?? "",
          steps: (m.steps as string[]) ?? [],
        }))
      : undefined,
    originalTitle: (parsed.originalTitle as string) ?? undefined,
    sourceNotes: (parsed.sourceNotes as string) ?? "",
    createdAt: now,
    updatedAt: now,
  };
}

// ── Main recipe generation (fast, no SVGs) ──

export async function generateRecipeStreaming(
  userRequest: string,
  version: "home" | "restaurant" = "home"
): Promise<Recipe> {
  let searchContext = "";
  try {
    const results = await braveSearch(`${userRequest} authentic recipe`);
    if (results.length > 0) {
      const pages = await Promise.all(
        results.slice(0, 2).map((r) => fetchPageContent(r.url))
      );
      searchContext = pages.filter(Boolean).join("\n\n---\n\n").slice(0, 6000);
    }
  } catch {}

  const stream = await deepseek.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildPrompt(userRequest, searchContext, version) },
    ],
    temperature: 0.9,
    max_tokens: 8192,
    stream: true,
  });

  let content = "";
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) content += delta;
  }

  const parsed = await parseJSON(content);
  return assembleRecipe(parsed);
}

// ── Async SVG generation (called separately after recipe is created) ──

export async function generateSvgsForRecipe(recipe: Recipe): Promise<
  Array<{ id: string; label: string; svg: string; caption?: string }>
> {
  const stepsArr = recipe.steps.map((s) => ({
    order: s.order,
    instruction: s.instruction,
  }));

  if (stepsArr.length === 0) return [];

  const keySteps = stepsArr.length <= 2
    ? stepsArr
    : [stepsArr[0], stepsArr[Math.floor(stepsArr.length / 2)], stepsArr[stepsArr.length - 1]]
        .filter((s, i, arr) => arr.findIndex((x) => x.order === s.order) === i);

  try {
    const response = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: "You are a cookbook illustrator. Create beautiful, realistic SVG illustrations of the actual dish being cooked. Use warm, appetizing colors. Return ONLY valid JSON.",
        },
        {
          role: "user",
          content: `Create instructional SVG illustrations for this recipe.

DISH: "${recipe.title}" (${recipe.cuisine})
DESCRIPTION: ${recipe.description}
FULL RECIPE CONTEXT: ${recipe.ingredients.map((i) => i.name).join(", ")}

Draw the ACTUAL DISH and its preparation — show the real ingredients, the real cooking process, the real finished plate. Make it look like the dish, not generic cooking clip-art.

STEPS TO ILLUSTRATE:
${JSON.stringify(keySteps)}

Return ONLY valid JSON: {"illustrations": [{"id": "step-N", "label": "description", "svg": "<svg>...</svg>", "caption": "What to notice"}]}

SVG REQUIREMENTS:
- viewBox="0 0 520 220"
- Beautiful, realistic food illustration style — warm, appetizing colors
- Show the actual dish and its ingredients, not generic shapes
- Each illustration should look like it belongs in a cookbook
- Under 4000 characters each`,
        },
      ],
      temperature: 0.8,
      max_tokens: 4096,
    });

    const text = response.choices[0]?.message?.content ?? "";
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) cleaned = cleaned.replace(/```(?:json)?\n?/g, "").trim();
    const fb = cleaned.indexOf("{"), lb = cleaned.lastIndexOf("}");
    if (fb !== -1 && lb > fb) cleaned = cleaned.slice(fb, lb + 1);
    const data = JSON.parse(cleaned);
    return (data.illustrations as Array<{ id: string; label: string; svg: string; caption?: string }>) ?? [];
  } catch {
    return [];
  }
}
