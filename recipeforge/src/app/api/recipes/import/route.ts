import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/session";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { html, title, description, cuisine, category, prepTime, cookTime, totalTime, difficulty, servings, tags } = body;

    if (!html || !title) {
      return NextResponse.json({ error: "html and title are required" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await supabase.from("recipes").insert({
      id,
      title,
      description: description ?? "",
      cuisine: cuisine ?? "other",
      category: category ?? "other",
      prep_time: prepTime ?? 0,
      cook_time: cookTime ?? 0,
      total_time: totalTime ?? 0,
      difficulty: difficulty ?? "medium",
      servings: servings ?? 4,
      ingredients: [],
      steps: [],
      equipment: [],
      nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      tags: tags ?? [],
      version: "home",
      theme: { primary: "#8B2635", secondary: "#D4A373", accent: "#588157", background: "#FDF6EC", text: "#1C110A", muted: "#F3E5D2", fontFamily: "Georgia, serif" },
      svg_illustrations: [],
      html,
      source_notes: "Hand-crafted by Claude Opus",
      created_at: now,
      updated_at: now,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 }
    );
  }
}
