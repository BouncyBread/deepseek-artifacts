import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/session";
import { generateRecipe } from "@/lib/recipe-generator";
import { supabase } from "@/lib/supabase";
import type { Recipe } from "@/types/recipe";

export async function POST(request: NextRequest) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { prompt } = await request.json();
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const recipe = await generateRecipe(prompt.trim());

    // Save to Supabase
    const { error: dbError } = await supabase.from("recipes").insert({
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      cuisine: recipe.cuisine,
      category: recipe.category,
      prep_time: recipe.prepTime,
      cook_time: recipe.cookTime,
      total_time: recipe.totalTime,
      difficulty: recipe.difficulty,
      servings: recipe.servings,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      equipment: recipe.equipment,
      nutrition: recipe.nutrition,
      tags: recipe.tags,
      version: recipe.version,
      theme: recipe.theme,
      svg_illustrations: recipe.svgIllustrations,
      source_notes: recipe.sourceNotes,
      created_at: recipe.createdAt,
      updated_at: recipe.updatedAt,
    });

    if (dbError) {
      console.error("Failed to save recipe:", dbError);
    }

    return NextResponse.json({ recipe }, { status: 201 });
  } catch (error) {
    console.error("Recipe generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate recipe" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const cuisine = searchParams.get("cuisine") ?? "";
  const tag = searchParams.get("tag") ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  let dbQuery = supabase
    .from("recipes")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (query) {
    dbQuery = dbQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
  }
  if (cuisine) {
    dbQuery = dbQuery.eq("cuisine", cuisine);
  }
  if (tag) {
    dbQuery = dbQuery.contains("tags", [tag]);
  }

  const { data, error } = await dbQuery;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch recipes" }, { status: 500 });
  }

  const recipes: Recipe[] = (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    description: r.description as string,
    cuisine: r.cuisine as string,
    category: r.category as string,
    prepTime: r.prep_time as number,
    cookTime: r.cook_time as number,
    totalTime: r.total_time as number,
    difficulty: r.difficulty as Recipe["difficulty"],
    servings: r.servings as number,
    ingredients: r.ingredients as Recipe["ingredients"],
    steps: r.steps as Recipe["steps"],
    equipment: r.equipment as string[],
    nutrition: r.nutrition as Recipe["nutrition"],
    tags: r.tags as string[],
    version: r.version as Recipe["version"],
    theme: r.theme as Recipe["theme"],
    svgIllustrations: (r.svg_illustrations as Recipe["svgIllustrations"]) ?? [],
    sourceNotes: (r.source_notes as string) ?? "",
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }));

  return NextResponse.json({ recipes });
}
