import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/session";
import { supabase } from "@/lib/supabase";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { status, recipe_id } = body as { status?: string; recipe_id?: string };

    if (!status && !recipe_id) {
      return NextResponse.json({ error: "status or recipe_id required" }, { status: 400 });
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) update.status = status;
    if (recipe_id) update.recipe_id = recipe_id;

    const { error } = await supabase
      .from("recipe_requests")
      .update(update)
      .eq("id", id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 500 }
    );
  }
}
