import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import type { Recipe } from "@/types/recipe";

function dbToRecipe(r: Record<string, unknown>): Recipe {
  return {
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
    culturalContext: (r.cultural_context as string) ?? undefined,
    proTips: (r.pro_tips as string[]) ?? undefined,
    storage: (r.storage as string) ?? undefined,
    alternativeMethods: (r.alternative_methods as Recipe["alternativeMethods"]) ?? undefined,
    equipmentNotes: (r.equipment_notes as string) ?? undefined,
    originalTitle: (r.original_title as string) ?? undefined,
    html: (r.html as string) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
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
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  return NextResponse.json({ recipe: dbToRecipe(data) });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await supabase.from("recipes").delete().eq("id", id);
  await supabase.from("chat_messages").delete().eq("recipe_id", id);

  return NextResponse.json({ ok: true });
}
