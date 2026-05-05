import type { Recipe } from "@/types/recipe";
import { getTheme } from "@/lib/themes";
import { braveSearch, fetchPageContent } from "@/lib/brave-search";
import { deepseek } from "@/lib/deepseek";

const SYSTEM_PROMPT = `You are a James Beard award-winning chef and cookbook author. Create richly detailed, authentic recipes.

Your recipes include: warm cultural context, sensory language (smell, texture, visual cues), WHY behind each technique, precise measurements, instructional SVG illustrations, pro tips, storage guidance, and alternative methods.

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
      "needsIllustration": true_if_visual_technique,
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
}

BE THOROUGH: write detailed steps with context, include multiple pro tips, provide genuine storage guidance. This should feel like a complete cookbook entry.`;
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
    // Ask LLM to fix the malformed JSON
    const fixResponse = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "Fix the following malformed JSON. Return ONLY the corrected, valid JSON. No markdown, no explanation." },
        { role: "user", content: cleaned.slice(0, 12000) },
      ],
      temperature: 0,
      max_tokens: 4096,
    });
    const fixed = fixResponse.choices[0]?.message?.content ?? "";
    let reCleaned = fixed.trim();
    if (reCleaned.startsWith("```")) {
      reCleaned = reCleaned.replace(/```(?:json)?\n?/g, "").trim();
    }
    const fb = reCleaned.indexOf("{");
    const lb = reCleaned.lastIndexOf("}");
    if (fb !== -1 && lb > fb) {
      reCleaned = reCleaned.slice(fb, lb + 1);
    }
    return JSON.parse(reCleaned);
  }
}

function assemble(
  parsed: Record<string, unknown>,
  svgIllustrations: Array<{ id: string; label: string; svg: string; caption?: string }> = []
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
    steps: stepsArr.map((s) => {
      const ill = svgIllustrations.find((i) => i.id === `step-${s.order}`);
      return {
        order: (s.order as number) ?? 0,
        instruction: (s.instruction as string) ?? "",
        why: s.why as string | undefined,
        sensoryCue: s.sensoryCue as string | undefined,
        callout: s.callout as string | undefined,
        svg: ill?.svg,
        svgCaption: ill?.caption,
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
    svgIllustrations: svgIllustrations.map((ill) => ({
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

export async function generateRecipeStreaming(
  userRequest: string,
  version: "home" | "restaurant" = "home"
): Promise<Recipe> {
  // 1. Brave Search
  let searchContext = "";
  try {
    const results = await braveSearch(`${userRequest} authentic recipe`);
    if (results.length > 0) {
      const pages = await Promise.all(
        results.slice(0, 2).map((r) => fetchPageContent(r.url))
      );
      searchContext = pages
        .filter(Boolean)
        .join("\n\n---\n\n")
        .slice(0, 6000);
    }
  } catch {}

  // 2. Generate via streaming to keep connection alive
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

  // 3. Always generate SVGs for key steps (first, middle, last)
  const stepsArr = (parsed.steps as Array<Record<string, unknown>>) ?? [];
  const allSteps = stepsArr.map((s) => ({
    order: s.order as number,
    instruction: s.instruction as string,
  }));

  // Pick up to 3 representative steps: first, last, and one from the middle
  const keySteps = allSteps.length <= 2
    ? allSteps
    : [
        allSteps[0],
        allSteps[Math.floor(allSteps.length / 2)],
        allSteps[allSteps.length - 1],
      ].filter((s, i, arr) => arr.findIndex((x) => x.order === s.order) === i);

  let svgIllustrations: Array<{ id: string; label: string; svg: string; caption?: string }> = [];

  if (keySteps.length > 0) {
    try {
      const svgResponse = await deepseek.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are a cookbook illustrator. Create instructional SVGs. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Create SVG illustrations for these cooking steps. Each SVG should TEACH a technique.

Return ONLY valid JSON: {"illustrations": [{"id": "step-N", "label": "description", "svg": "<svg>...</svg>", "caption": "What the cook should notice"}]}

STEPS: ${JSON.stringify(keySteps)}

SVG REQUIREMENTS:
- viewBox="0 0 520 200"
- Warm, cookbook-illustration style
- Show technique, comparison, or visual cue
- Under 3000 characters each`,
          },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      });

      const svgText = svgResponse.choices[0]?.message?.content ?? "";
      let svgCleaned = svgText.trim();
      if (svgCleaned.startsWith("```")) {
        svgCleaned = svgCleaned.replace(/```(?:json)?\n?/g, "").trim();
      }
      const fb = svgCleaned.indexOf("{");
      const lb = svgCleaned.lastIndexOf("}");
      if (fb !== -1 && lb > fb) svgCleaned = svgCleaned.slice(fb, lb + 1);
      const svgData = JSON.parse(svgCleaned);
      svgIllustrations = (svgData.illustrations as typeof svgIllustrations) ?? [];
    } catch {
      // SVGs are non-critical
    }
  }

  return assemble(parsed, svgIllustrations);
}
