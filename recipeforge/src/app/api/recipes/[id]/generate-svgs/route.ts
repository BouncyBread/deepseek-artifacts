import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { generateSvgsForRecipe } from "@/lib/recipe-generator-streaming";
import type { Recipe } from "@/types/recipe";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Fetch the recipe
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  // Build a minimal recipe object for SVG context
  const recipe: Recipe = {
    id: data.id as string,
    title: data.title as string,
    description: data.description as string,
    cuisine: data.cuisine as string,
    category: data.category as string,
    ingredients: data.ingredients as Recipe["ingredients"],
    steps: data.steps as Recipe["steps"],
    equipment: [],
    nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    tags: [],
    version: "home",
    theme: { primary: "", secondary: "", accent: "", background: "", text: "", muted: "", fontFamily: "" },
    svgIllustrations: [],
    prepTime: 0,
    cookTime: 0,
    totalTime: 0,
    difficulty: "medium",
    servings: 4,
    createdAt: "",
    updatedAt: "",
  };

  try {
    const svgs = await generateSvgsForRecipe(recipe);

    if (svgs.length > 0) {
      // Attach SVGs to steps
      const updatedSteps = (data.steps as Array<Record<string, unknown>>).map((step) => {
        const svg = svgs.find((s) => s.id === `step-${step.order}`);
        if (svg) {
          return { ...step, svg: svg.svg, svgCaption: svg.caption };
        }
        return step;
      });

      await supabase
        .from("recipes")
        .update({
          steps: updatedSteps,
          svg_illustrations: svgs.map((s) => ({ id: s.id, label: s.label, svg: s.svg })),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    }

    return NextResponse.json({ svgs });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "SVG generation failed" },
      { status: 500 }
    );
  }
}
