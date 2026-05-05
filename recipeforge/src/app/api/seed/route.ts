import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  thaiGreenCurrySeed,
  thaiGreenCurryRestaurant,
} from "@/lib/seed-recipes";

export async function POST() {
  const toDb = (r: typeof thaiGreenCurrySeed) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    cuisine: r.cuisine,
    category: r.category,
    prep_time: r.prepTime,
    cook_time: r.cookTime,
    total_time: r.totalTime,
    difficulty: r.difficulty,
    servings: r.servings,
    ingredients: r.ingredients,
    steps: r.steps,
    equipment: r.equipment,
    nutrition: r.nutrition,
    tags: r.tags,
    version: r.version,
    theme: r.theme,
    svg_illustrations: r.svgIllustrations,
    source_notes: r.sourceNotes,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  });

  const { error } = await supabase.from("recipes").insert([
    toDb(thaiGreenCurrySeed),
    toDb(thaiGreenCurryRestaurant),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, seeded: 2 });
}
