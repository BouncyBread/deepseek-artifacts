import type { Recipe } from "@/types/recipe";
import { getTheme } from "@/lib/themes";
import { braveSearch, fetchPageContent } from "@/lib/brave-search";
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
    max_tokens: opts?.maxTokens ?? 4096,
  });
  return response.choices[0]?.message?.content ?? "";
}

const RECIPE_SYSTEM_PROMPT = `You are a James Beard award-winning chef and cookbook author. Your recipes are:

WARM & PERSONAL: Write like you're teaching a friend. Sensory language — smell, texture, visual cues. Include the WHY behind techniques.

CULTURALLY AUTHENTIC: Include the local name. Describe the dish's place in its culture. Honor its origins.

PRECISE & TESTED: Every ingredient has a realistic amount. Every step is actionable. No vague instructions.

TEACHING: Explain techniques. Include sensory checkpoints. Warn about common pitfalls. A home cook should learn something.

Return ONLY valid JSON, no markdown, no code fences.`;

function buildRecipePrompt(
  userRequest: string,
  searchContext: string,
  version: "home" | "restaurant"
): string {
  const versionHint =
    version === "restaurant"
      ? "RESTAURANT-QUALITY: chef techniques, premium ingredients, elevated plating, professional equipment."
      : "HOME-COOK: practical kitchen, accessible ingredients, achievable techniques.";

  return `Create an authentic, meticulously researched recipe.

USER REQUEST: "${userRequest}"
VERSION: ${versionHint}

${searchContext ? `RESEARCH:\n${searchContext}\n\nSynthesize these sources critically. Pull the best elements from each.` : "Draw on your deep culinary knowledge."}

QUALITY REQUIREMENTS:
- Include the dish's local/original name where applicable
- Write a warm cultural context paragraph about the dish's origins and meaning
- Every ingredient needs a precise, realistic amount and unit
- Every step must be actionable with sensory cues ("until the edges turn translucent", "when it smells nutty")
- Explain WHY for key techniques
- Include sensoryCue on complex steps
- Include callout warnings on critical steps
- Flag steps needing SVG illustration: needsIllustration: true
- Add 3-5 pro tips a home cook wouldn't know
- Include storage and reheating guidance
- Include alternative cooking method if applicable
- Equipment notes if specific gear matters

Return ONLY valid JSON:
{
  "title": "Dish Name",
  "originalTitle": "Local name or null",
  "description": "One warm, inviting sentence",
  "culturalContext": "Warm paragraph about origins, cultural meaning, when it's eaten",
  "cuisine": "thai|italian|japanese|mexican|indian|chinese|french|korean|mediterranean|american|middle-eastern|other",
  "category": "curry|soup|salad|pasta|stir-fry|grill|roast|bake|dessert|breakfast|appetizer|fried-rice|porridge|other",
  "prepTime": number_minutes,
  "cookTime": number_minutes,
  "totalTime": number_minutes,
  "difficulty": "easy|medium|hard",
  "servings": number,
  "ingredients": [
    {"name": "ingredient", "amount": number, "unit": "tbsp|tsp|cup|g|ml|lb|oz|piece|clove|inch|to taste", "notes": "prep note or substitution"}
  ],
  "steps": [
    {
      "order": 1,
      "instruction": "Clear instruction with sensory cues",
      "why": "Why this technique matters",
      "sensoryCue": "What the cook should look for, smell, or feel",
      "duration": optional_minutes,
      "needsIllustration": true_if_visual_technique,
      "callout": "Important warning or tip — null if not needed"
    }
  ],
  "equipment": ["needed tools"],
  "equipmentNotes": "Guidance about specific equipment or null",
  "nutrition": {"calories": number, "protein": grams, "carbs": grams, "fat": grams, "fiber": optional_grams},
  "tags": ["cuisine", "dietary", "occasion"],
  "proTips": ["3-5 practical tips"],
  "storage": "How to store, how long, how to reheat",
  "alternativeMethods": [
    {"name": "Method name", "description": "When to use", "steps": ["step by step"]}
  ],
  "version": "${version}",
  "sourceNotes": "Sources used and key decisions"
}`;
}

function buildSvgPrompt(
  steps: Array<{ order: number; instruction: string }>
): string {
  return `Create instructional SVG illustrations for these steps. Each SVG should TEACH a technique or show a visual cue.

Return ONLY valid JSON:
{
  "illustrations": [
    {"id": "step-N", "label": "description", "svg": "<svg>...</svg>", "caption": "What the cook should notice"}
  ]
}

STEPS:
${JSON.stringify(steps, null, 2)}

SVG REQUIREMENTS:
- viewBox="0 0 520 200"
- Warm, natural cookbook-illustration style
- Show technique, comparison, or visual cue
- Include labels where helpful
- Under 3000 characters each`;
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

function assembleRecipe(
  parsed: Record<string, unknown>,
  svgData: {
    illustrations: Array<{
      id: string;
      label: string;
      svg: string;
      caption?: string;
    }>;
  }
): Recipe {
  const stepsArr = (parsed.steps as Array<Record<string, unknown>>) ?? [];
  const nutritionObj = parsed.nutrition as Record<string, number> | undefined;
  const cuisineStr = (parsed.cuisine as string) ?? "other";
  const now = new Date().toISOString();
  const altMethodsArr = (parsed.alternativeMethods as Array<Record<string, unknown>>) ?? [];

  return {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
    steps: stepsArr.map((s) => {
      const ill = svgData.illustrations.find((i) => i.id === `step-${s.order}`);
      return {
        order: (s.order as number) ?? 0,
        instruction: (s.instruction as string) ?? "",
        why: s.why as string | undefined,
        sensoryCue: s.sensoryCue as string | undefined,
        duration: s.duration as number | undefined,
        svg: ill?.svg,
        svgCaption: ill?.caption,
        callout: s.callout as string | undefined,
      };
    }),
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
    svgIllustrations: svgData.illustrations.map((ill) => ({
      id: ill.id,
      label: ill.label,
      svg: ill.svg,
    })),
    culturalContext: (parsed.culturalContext as string) ?? undefined,
    proTips: (parsed.proTips as string[]) ?? undefined,
    storage: (parsed.storage as string) ?? undefined,
    alternativeMethods:
      altMethodsArr.length > 0
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

export async function generateRecipe(
  userRequest: string,
  version: "home" | "restaurant" = "home"
): Promise<Recipe> {
  // 1. Search for authentic sources
  let searchContext = "";
  try {
    const results = await braveSearch(`${userRequest} authentic recipe`);
    if (results.length > 0) {
      // Fetch top 2 pages for richer context
      const pages = await Promise.all(
        results.slice(0, 2).map((r) => fetchPageContent(r.url))
      );
      searchContext = pages
        .filter(Boolean)
        .join("\n\n---\n\n")
        .slice(0, 6000);
    }
  } catch {
    // Non-critical — generation works without search
  }

  // 2. Generate recipe JSON
  const recipeJson = await callLLM(
    RECIPE_SYSTEM_PROMPT,
    buildRecipePrompt(userRequest, searchContext, version),
    { maxTokens: 3072 }
  );
  const parsed = parseJSON(recipeJson);

  // 3. Generate SVGs for flagged steps
  const stepsArr = (parsed.steps as Array<Record<string, unknown>>) ?? [];
  const stepsNeedingSvg = stepsArr
    .filter((s) => s.needsIllustration)
    .map((s) => ({ order: s.order as number, instruction: s.instruction as string }));

  let svgData: {
    illustrations: Array<{
      id: string;
      label: string;
      svg: string;
      caption?: string;
    }>;
  } = { illustrations: [] };

  if (stepsNeedingSvg.length > 0) {
    try {
      const svgJson = await callLLM(
        "You are a cookbook illustrator. Create instructional SVGs. Return ONLY valid JSON.",
        buildSvgPrompt(stepsNeedingSvg),
        { maxTokens: 3072 }
      );
      svgData = parseJSON(svgJson) as typeof svgData;
    } catch {
      // SVGs are non-critical
    }
  }

  return assembleRecipe(parsed, svgData);
}
