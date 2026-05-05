import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!serviceKey) {
      return NextResponse.json({ error: "Service key not configured" }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      serviceKey
    );

    const sql = `
      ALTER TABLE recipes ADD COLUMN IF NOT EXISTS cultural_context TEXT;
      ALTER TABLE recipes ADD COLUMN IF NOT EXISTS pro_tips TEXT[] DEFAULT '{}';
      ALTER TABLE recipes ADD COLUMN IF NOT EXISTS storage TEXT;
      ALTER TABLE recipes ADD COLUMN IF NOT EXISTS alternative_methods JSONB DEFAULT '[]';
      ALTER TABLE recipes ADD COLUMN IF NOT EXISTS equipment_notes TEXT;
      ALTER TABLE recipes ADD COLUMN IF NOT EXISTS original_title TEXT;
    `;

    const { error } = await supabaseAdmin.rpc("exec_sql", { sql_text: sql }).maybeSingle();

    // If rpc not available, try raw SQL via REST
    if (error) {
      // Fallback: execute statements individually via REST
      const baseUrl = process.env.SUPABASE_URL!;
      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);

      for (const stmt of statements) {
        await fetch(`${baseUrl}/rest/v1/rpc/exec_sql`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sql_text: stmt + ";" }),
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Migration failed" },
      { status: 500 }
    );
  }
}
