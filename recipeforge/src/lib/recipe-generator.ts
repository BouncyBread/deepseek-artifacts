import type { Recipe } from "@/types/recipe";
import { getTheme } from "@/lib/themes";
import { braveSearch, fetchPageContent } from "@/lib/brave-search";
import { deepseek } from "@/lib/deepseek";

const RESEARCH_MODEL = process.env.DEEPSEEK_RESEARCH_MODEL || "deepseek-v4-pro";

async function callLLM(
  system: string,
  prompt: string,
  opts?: { research?: boolean; maxTokens?: number }
): Promise<string> {
  const isResearch = opts?.research !== false;
  const response = await deepseek.chat.completions.create({
    model: isResearch ? RESEARCH_MODEL : "deepseek-chat",
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    temperature: isResearch ? 0.9 : 0.7,
    max_tokens: opts?.maxTokens ?? (isResearch ? 8192 : 4096),
  });
  return response.choices[0]?.message?.content ?? "";
}

const RECIPE_SYSTEM_PROMPT = `You are a James Beard award-winning chef and cookbook author with decades of experience in home kitchens. Your recipes are:

WARM & PERSONAL — Write like you're teaching a friend in your kitchen. Use sensory language: what should it look like? smell like? what texture are we after? Include the WHY behind key techniques.

CULTURALLY AUTHENTIC — Honor the dish's origins. Include the local name where relevant. Describe its place in the culture: when is it eaten? who makes it? what does it mean?

PRECISE & TESTED — Every ingredient has a realistic amount and unit. Every step is genuinely actionable. No placeholder measurements. No vague instructions ("cook until done" is not a step).

TEACHING, NOT JUST INSTRUCTING — Explain techniques. Include visual cues and sensory checkpoints. Warn about common pitfalls. A home cook should learn something.

Return ONLY valid JSON (no markdown, no code fences):`;

function buildRecipePrompt(
  userRequest: string,
  searchContext: string,
  version: "home" | "restaurant"
): string {
  const versionHint =
    version === "restaurant"
      ? "Create a RESTAURANT-QUALITY version — chef techniques, premium ingredients, elevated plating, professional equipment. Include plating guidance."
      : "Create a HOME-COOK version — practical for a home kitchen, accessible ingredients, achievable techniques. Focus on making the cook successful.";

  return `Create an authentic, meticulously researched recipe.

USER REQUEST: "${userRequest}"

${versionHint}

${searchContext ? `AUTHENTIC SOURCE RESEARCH:\n${searchContext}\n\nCritically synthesize these sources. Note agreements and disagreements. Prefer the most traditional or authoritative source. Pull the best elements from each.` : "Draw on your deep culinary knowledge. Be specific about regional origins and traditional techniques."}

QUALITY REQUIREMENTS:
- Include the dish's local/original name where applicable
- Write a warm, personal lede about the dish's cultural context — where it comes from, who makes it, when it's eaten, what it means
- Every ingredient needs a precise, realistic amount and unit (no "to taste" as a cop-out for measurable ingredients)
- Every step must be actionable and specific — include visual cues ("until the edges turn translucent"), sounds ("when it stops sizzling"), smells ("when it smells nutty and toasty")
- Explain WHY for key techniques — not just "do X" but "do X because Y"
- Include a sensoryCue on complex steps: what should the cook look for?
- Include a callout box on critical steps where technique really matters
- Flag steps that need an instructional SVG illustration (needsIllustration: true) — complex techniques, equipment diagrams, consistency comparisons, visual cues
- Add 3-5 pro tips that a home cook wouldn't know
- Include storage and reheating guidance
- If there's a common alternative method, include it (different equipment, shortcut, etc.)
- Provide equipment notes if specific gear matters (e.g., "any rice cooker with a Porridge setting")

Return ONLY valid JSON (no markdown, no code fences):
{
  "title": "Dish Name",
  "originalTitle": "Local/original name if applicable, null otherwise",
  "description": "One warm, inviting sentence",
  "culturalContext": "A paragraph about the dish's cultural background — its origins, when it's eaten, who makes it, what it means. Write with warmth and personality.",
  "cuisine": "thai|italian|japanese|mexican|indian|chinese|french|korean|mediterranean|american|middle-eastern|other",
  "category": "curry|soup|salad|pasta|stir-fry|grill|roast|bake|dessert|breakfast|appetizer|fried-rice|porridge|other",
  "prepTime": number_in_minutes,
  "cookTime": number_in_minutes,
  "totalTime": number_in_minutes,
  "difficulty": "easy|medium|hard",
  "servings": number,
  "ingredients": [
    {"name": "ingredient name", "amount": number, "unit": "g|ml|tbsp|tsp|cup|piece|clove|inch|lb|oz|to taste", "notes": "optional prep note or substitution"}
  ],
  "steps": [
    {
      "order": 1,
      "instruction": "Clear, detailed instruction with sensory cues",
      "why": "Why this step matters or the technique behind it",
      "sensoryCue": "What the cook should look for, smell, or feel at this stage",
      "duration": optional_minutes,
      "needsIllustration": true_if_complex_technique_needs_visual,
      "callout": "Important warning, tip, or note for this step — null if not needed"
    }
  ],
  "equipment": ["needed tools and appliances"],
  "equipmentNotes": "Guidance about specific equipment if relevant (e.g., which setting on a rice cooker, what type of pan works best). Null if not applicable.",
  "nutrition": {"calories": number_per_serving, "protein": grams, "carbs": grams, "fat": grams, "fiber": optional_grams},
  "tags": ["cuisine_tag", "dietary_tag", "occasion_tag"],
  "proTips": ["3-5 practical tips a home cook wouldn't know"],
  "storage": "How to store leftovers, how long they keep, and how to reheat properly",
  "alternativeMethods": [
    {"name": "Alternative method name", "description": "When to use this method", "steps": ["step by step differences"]}
  ],
  "version": "${version}",
  "sourceNotes": "What sources were used, which elements came from which source, any interesting decisions made"
}`;
}

function buildSvgPrompt(
  steps: Array<{
    order: number;
    instruction: string;
    why?: string;
    sensoryCue?: string;
    callout?: string;
  }>
): string {
  return `Create beautiful, instructional SVG illustrations for these cooking steps.

Each SVG should TEACH something — show a technique, a comparison (too thin vs just right vs too thick), an equipment diagram, or a visual cue the cook needs to see.

Return ONLY valid JSON (no markdown, no code fences):

{
  "illustrations": [
    {
      "id": "step-N",
      "label": "Short description",
      "svg": "<svg>...</svg>",
      "caption": "One sentence explaining what the cook should notice"
    }
  ]
}

STEPS TO ILLUSTRATE:
${JSON.stringify(steps, null, 2)}

SVG REQUIREMENTS:
- viewBox="0 0 520 200" (wider format for instructional content)
- Warm, appetizing, cookbook-illustration style
- Show technique, comparison, or visual cue — not just decoration
- Use soft, natural colors that feel like a printed cookbook
- Include labels or annotations where helpful
- Under 3000 characters each
- Clean, readable composition — the cook should learn from looking at it`;
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
  const searchResults = await braveSearch(`${userRequest} authentic recipe traditional`);

  // 2. Fetch top results for context
  const pages = await Promise.all(
    searchResults.slice(0, 4).map((r) => fetchPageContent(r.url))
  );
  const searchContext = pages.filter(Boolean).join("\n\n---\n\n");

  // 3. Generate recipe JSON with research model
  const recipePrompt = buildRecipePrompt(userRequest, searchContext, version);
  const recipeJson = await callLLM(RECIPE_SYSTEM_PROMPT, recipePrompt, {
    maxTokens: 16384,
  });
  const parsed = parseJSON(recipeJson);

  // 4. Generate SVGs for flagged steps
  const stepsArr = (parsed.steps as Array<Record<string, unknown>>) ?? [];
  const stepsNeedingSvg = stepsArr
    .filter((s) => s.needsIllustration)
    .map((s) => ({
      order: s.order as number,
      instruction: s.instruction as string,
      why: s.why as string | undefined,
      sensoryCue: s.sensoryCue as string | undefined,
      callout: s.callout as string | undefined,
    }));

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
        "You are a technical illustrator for cookbooks. Create beautiful, instructional SVGs. Return ONLY valid JSON, no markdown.",
        buildSvgPrompt(stepsNeedingSvg),
        { research: false, maxTokens: 8192 }
      );
      svgData = parseJSON(svgJson) as typeof svgData;
    } catch {
      // SVGs are non-critical — recipe is still good without them
    }
  }

  return assembleRecipe(parsed, svgData);
}
