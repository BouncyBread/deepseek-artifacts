import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/session";
import { deepseek } from "@/lib/deepseek";
import { getTheme } from "@/lib/themes";
import { supabase } from "@/lib/supabase";
import type { Recipe } from "@/types/recipe";

async function callLLM(prompt: string): Promise<string> {
  const response = await deepseek.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      { role: "system", content: "You are an expert chef. Return ONLY valid JSON, no markdown." },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 4096,
  });
  return response.choices[0]?.message?.content ?? "";
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
  return JSON.parse(cleaned);
}

function buildUpdatePrompt(existing: Record<string, unknown>, message: string): string {
  return `Update this recipe based on the follow-up request. Keep everything the same unless the change is asked for. If a change cascades (e.g. "gluten-free" → swap flour), update those fields too.

CURRENT RECIPE:
${JSON.stringify({
  title: existing.title,
  description: existing.description,
  cuisine: existing.cuisine,
  category: existing.category,
  prepTime: existing.prep_time,
  cookTime: existing.cook_time,
  totalTime: existing.total_time,
  difficulty: existing.difficulty,
  servings: existing.servings,
  ingredients: existing.ingredients,
  steps: existing.steps,
  equipment: existing.equipment,
  nutrition: existing.nutrition,
  tags: existing.tags,
  version: existing.version,
}, null, 2)}

FOLLOW-UP: "${message}"

Return the FULL updated recipe as JSON (no markdown):
{
  "title": "...",
  "description": "...",
  "cuisine": "...",
  "category": "...",
  "prepTime": number,
  "cookTime": number,
  "totalTime": number,
  "difficulty": "...",
  "servings": number,
  "ingredients": [{"name": "...", "amount": number, "unit": "...", "notes": "..."}],
  "steps": [{"order": 1, "instruction": "...", "duration": optional, "needsIllustration": false}],
  "equipment": ["..."],
  "nutrition": {"calories": number, "protein": number, "carbs": number, "fat": number, "fiber": optional},
  "tags": ["..."],
  "version": "home|restaurant"
}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data: existing, error: fetchError } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  try {
    const { message } = await request.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    await supabase.from("chat_messages").insert({
      recipe_id: id,
      role: "user",
      content: message,
    });

    const prompt = buildUpdatePrompt(existing as Record<string, unknown>, message);
    const responseText = await callLLM(prompt);
    const parsed = parseJSON(responseText);

    const stepsArr = (parsed.steps as Array<Record<string, unknown>>) ?? [];
    const nutritionObj = parsed.nutrition as Record<string, number> | undefined;
    const cuisineStr = (parsed.cuisine as string) ?? (existing.cuisine as string);
    const now = new Date().toISOString();

    const updated: Recipe = {
      id: existing.id as string,
      title: (parsed.title as string) ?? (existing.title as string),
      description: (parsed.description as string) ?? (existing.description as string),
      cuisine: cuisineStr,
      category: (parsed.category as string) ?? (existing.category as string),
      prepTime: (parsed.prepTime as number) ?? (existing.prep_time as number),
      cookTime: (parsed.cookTime as number) ?? (existing.cook_time as number),
      totalTime: (parsed.totalTime as number) ?? (existing.total_time as number),
      difficulty: (parsed.difficulty as Recipe["difficulty"]) ?? (existing.difficulty as string),
      servings: (parsed.servings as number) ?? (existing.servings as number),
      ingredients: (parsed.ingredients as Recipe["ingredients"]) ?? (existing.ingredients as Recipe["ingredients"]),
      steps: stepsArr.map((s) => ({
        order: (s.order as number) ?? 0,
        instruction: (s.instruction as string) ?? "",
        duration: s.duration as number | undefined,
      })),
      equipment: (parsed.equipment as string[]) ?? (existing.equipment as string[]),
      nutrition: {
        calories: nutritionObj?.calories ?? (existing.nutrition as Record<string, number>)?.calories ?? 0,
        protein: nutritionObj?.protein ?? (existing.nutrition as Record<string, number>)?.protein ?? 0,
        carbs: nutritionObj?.carbs ?? (existing.nutrition as Record<string, number>)?.carbs ?? 0,
        fat: nutritionObj?.fat ?? (existing.nutrition as Record<string, number>)?.fat ?? 0,
        fiber: nutritionObj?.fiber ?? (existing.nutrition as Record<string, number>)?.fiber,
      },
      tags: (parsed.tags as string[]) ?? (existing.tags as string[]),
      version: (parsed.version as "home" | "restaurant") ?? (existing.version as string),
      theme: getTheme(cuisineStr),
      svgIllustrations: (existing.svg_illustrations as Recipe["svgIllustrations"]) ?? [],
      sourceNotes: (existing.source_notes as string) ?? "",
      createdAt: existing.created_at as string,
      updatedAt: now,
    };

    await supabase.from("recipes").update({
      title: updated.title,
      description: updated.description,
      cuisine: updated.cuisine,
      category: updated.category,
      prep_time: updated.prepTime,
      cook_time: updated.cookTime,
      total_time: updated.totalTime,
      difficulty: updated.difficulty,
      servings: updated.servings,
      ingredients: updated.ingredients,
      steps: updated.steps,
      equipment: updated.equipment,
      nutrition: updated.nutrition,
      tags: updated.tags,
      version: updated.version,
      theme: updated.theme,
      svg_illustrations: updated.svgIllustrations,
      source_notes: updated.sourceNotes,
      updated_at: updated.updatedAt,
    }).eq("id", id);

    await supabase.from("chat_messages").insert({
      recipe_id: id,
      role: "assistant",
      content: JSON.stringify(updated),
    });

    return NextResponse.json({ recipe: updated });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: "Failed to process follow-up" }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("recipe_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }

  return NextResponse.json({ messages: data ?? [] });
}
