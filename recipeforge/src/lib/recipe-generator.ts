import type { Recipe } from "@/types/recipe";
import { getTheme } from "@/lib/themes";
import { braveSearch, fetchPageContent } from "@/lib/brave-search";
import { deepseek } from "@/lib/deepseek";

const RESEARCH_MODEL = process.env.DEEPSEEK_RESEARCH_MODEL || "deepseek-v4-pro";
const FAST_MODEL = "deepseek-chat";

async function callLLM(
  system: string,
  prompt: string,
  opts?: { model?: string; maxTokens?: number }
): Promise<string> {
  const response = await deepseek.chat.completions.create({
    model: opts?.model ?? RESEARCH_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    temperature: opts?.model === FAST_MODEL ? 0.3 : 0.9,
    max_tokens: opts?.maxTokens ?? 16384,
  });
  return response.choices[0]?.message?.content ?? "";
}

const HTML_SYSTEM_PROMPT = `You are a James Beard award-winning chef, cookbook author, and graphic designer. You create beautiful, self-contained HTML recipe pages that feel like pages from a beloved cookbook.

Your recipe pages are:
- BEAUTIFUL: Custom typography, warm color palettes, paper textures (CSS-only), generous whitespace
- INSTRUCTIONAL: Hand-crafted SVGs at key steps showing techniques, comparisons, or visual cues
- PERSONAL: Warm, sensory writing — what does it smell like? look like? what texture are we after?
- CULTURALLY AUTHENTIC: Local names, cultural context, traditional techniques explained with respect
- COMPLETE: Ingredients, detailed steps with WHY, pro tips, storage, equipment guidance, alternative methods

You output a complete, standalone HTML file — no markdown wrapping, just the HTML.`;

function buildHtmlPrompt(
  userRequest: string,
  searchContext: string,
  version: "home" | "restaurant"
): string {
  const versionHint =
    version === "restaurant"
      ? "RESTAURANT-QUALITY version — chef techniques, premium ingredients, elevated plating, professional equipment."
      : "HOME-COOK version — practical kitchen, accessible ingredients, achievable techniques. Make the cook successful.";

  return `Create a beautiful, self-contained HTML recipe page.

USER REQUEST: "${userRequest}"
VERSION: ${versionHint}

${searchContext ? `RESEARCH FROM AUTHENTIC SOURCES:\n${searchContext}\n\nSynthesize these sources. Pull the best elements from each. Prefer the most traditional source.` : "Draw on deep culinary knowledge for this dish."}

PAGE STRUCTURE:
1. A hero section with the dish name (English + original language), a one-sentence description, a beautiful hand-crafted SVG illustration of the finished dish, and meta stats (time, servings, difficulty)
2. A warm cultural context / lede paragraph about the dish's origins and meaning
3. An interactive servings scaler (JavaScript) that adjusts ingredient quantities
4. Ingredients section with precise amounts, organized in groups
5. Equipment section with notes about specific gear
6. Detailed instructions — each step has:
   - Clear, sensory instruction
   - WHY this technique matters
   - A visual/sensory cue ("look for...")
   - An SVG illustration if the technique is complex or visual
   - A callout box for critical warnings or tips
7. Pro Tips section (3-5 things)
8. Storage & reheating guidance
9. Alternative method if applicable (different equipment, shortcut, etc.)

DESIGN REQUIREMENTS:
- Use <style> with a warm, cookbook-inspired palette — no black (#000), no pure white (#fff), no blue/gray defaults
- Use Google Fonts: Fraunces for headings, Newsreader or Source Serif for body
- Paper texture via CSS (radial gradients, subtle noise)
- SVGs must be hand-crafted and instructional — viewBox="0 0 520 200", warm natural colors, teach the cook something
- Typography treatments: the dish name large and elegant, steps clearly numbered, callout boxes that draw the eye
- Responsive: works on mobile (single column) and desktop
- Light mode only
- Include a <script> tag for interactive servings scaling (JavaScript)

IMPORTANT RULES:
- Return ONLY the complete HTML document (starting with <!doctype html>)
- No code fences, no markdown wrapping
- All CSS inline in a <style> tag in <head>
- All SVGs inline — no external images
- Every ingredient amount must be data-driven so the scaler JS can multiply them
- Keep total output under 16000 characters

Output the HTML now:`;
}

function buildMetadataPrompt(html: string): string {
  return `Extract recipe metadata from this HTML recipe page. Return ONLY valid JSON (no markdown, no code fences):

{
  "title": "English dish name",
  "description": "One warm, inviting sentence",
  "cuisine": "thai|italian|japanese|mexican|indian|chinese|french|korean|mediterranean|american|middle-eastern|other",
  "category": "curry|soup|salad|pasta|stir-fry|grill|roast|bake|dessert|breakfast|appetizer|fried-rice|porridge|other",
  "prepTime": number_minutes,
  "cookTime": number_minutes,
  "totalTime": number_minutes,
  "difficulty": "easy|medium|hard",
  "servings": number,
  "tags": ["tag1", "tag2"],
  "version": "${html.includes("RESTAURANT") ? "restaurant" : "home"}",
  "sourceNotes": "Brief note about authenticity and sources"
}

HTML:
${html.slice(0, 8000)}`;
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

function extractMetadata(parsed: Record<string, unknown>, html: string, id: string): Recipe {
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
  // 1. Search for authentic sources
  const searchResults = await braveSearch(`${userRequest} authentic recipe traditional`);

  // 2. Fetch top results for context
  const pages = await Promise.all(
    searchResults.slice(0, 4).map((r) => fetchPageContent(r.url))
  );
  const searchContext = pages.filter(Boolean).join("\n\n---\n\n");

  // 3. Generate the full HTML recipe page
  const html = await callLLM(
    HTML_SYSTEM_PROMPT,
    buildHtmlPrompt(userRequest, searchContext, version),
    { maxTokens: 16384 }
  );

  // 4. Extract metadata from the HTML (fast model is fine)
  const metadataJson = await callLLM(
    "You extract structured metadata from recipe HTML. Return ONLY valid JSON, no markdown.",
    buildMetadataPrompt(html),
    { model: FAST_MODEL, maxTokens: 2048 }
  );
  const metadata = parseJSON(metadataJson);

  const id = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return extractMetadata(metadata, html, id);
}
